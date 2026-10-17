import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { delaunay } from '../../kit/delaunay';
import { createRandom } from '../../kit/random';
import { createGeomLibrary, GEOM_VERSION } from '../geom-entry';
import { createNoiseLibrary } from '../noise-entry';
import { fakePixi } from '../shared/fake-pixi.test-util';
import { difference, draw, intersect, shapes, union, xor } from './boolean';
import { bands, lines } from './contours';
import { mosaic } from './mosaic';
import { arch, area, centroid, contains, inset, ribbon, signedArea, smooth } from './paths';

const G = createGeomLibrary();

function square(x: number, y: number, size: number): number[] {
  return [x, y, x + size, y, x + size, y + size, x, y + size];
}

function totalArea(rings: readonly number[][]): number {
  // Even-odd: holes subtract.
  return shapes(rings).reduce(
    (sum, shape) => sum + area(shape.outer) - shape.holes.reduce((h, hole) => h + area(hole), 0),
    0,
  );
}

/* A scene stand-in: the seeded random and the kit's own Delaunay. */
function scene(seed: number | string = 5) {
  const random = createRandom(seed);
  return { random: () => random.random(), delaunay };
}

/* A cone: 1 at the centre of a 21 × 21 grid falling to 0 at the corners. */
function cone(cell = 10) {
  const cols = 21;
  const rows = 21;
  const values = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r += 1)
    for (let c = 0; c < cols; c += 1)
      values[r * cols + c] = 1 - Math.hypot(c - 10, r - 10) / Math.hypot(10, 10);
  return { values, cols, rows, cell, x: 0, y: 0 };
}

describe('geom library', () => {
  it('is frozen and names the packages it bundles, read from their manifests', () => {
    expect(Object.isFrozen(G)).toBe(true);
    expect(G.version).toBe(GEOM_VERSION);
    expect(G.arches).toEqual(['round', 'pointed', 'horseshoe']);
    const manifest = (name: string) =>
      JSON.parse(
        readFileSync(
          resolve(import.meta.dirname, `../../../../node_modules/${name}/package.json`),
          'utf8',
        ),
      ) as { version: string; license: string };
    expect(manifest('d3-contour')).toMatchObject({ version: '4.0.2', license: 'ISC' });
    expect(manifest('polybooljs')).toMatchObject({ version: '1.2.2', license: 'MIT' });
  });

  it('bands a field into nested terraces: band 0 is the whole grid, each next one smaller', () => {
    const result = bands(cone(), 5);
    expect(result).toHaveLength(5);
    const areas = result.map((band) =>
      band.shapes.reduce((sum, shape) => sum + area(shape.outer), 0),
    );
    // The whole grid, in design units: samples at 0..200, half a cell beyond each edge (d3 rounds
    // the four corners by a hair).
    expect(areas[0]).toBeGreaterThan(210 * 210 * 0.99);
    expect(areas[0]).toBeLessThanOrEqual(210 * 210);
    for (let i = 1; i < areas.length; i += 1) expect(areas[i]).toBeLessThan(areas[i - 1] ?? 0);
    // The top band sits around the peak at (100, 100).
    const [cx, cy] = centroid(result[4]?.shapes[0]?.outer ?? []);
    expect(cx).toBeCloseTo(100, 0);
    expect(cy).toBeCloseTo(100, 0);
    expect(result.map((band) => band.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('takes explicit levels, and cuts a hole where the field dips back down', () => {
    const grid = cone();
    // A ring: high around the middle, low at the very centre.
    grid.values[10 * 21 + 10] = 0;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      grid.values[(10 + dr) * 21 + 10 + dc] = 0;
    const [band] = bands(grid, [0.6]);
    expect(band?.value).toBe(0.6);
    expect(band?.shapes).toHaveLength(1);
    expect(band?.shapes[0]?.holes).toHaveLength(1);
    expect(contains(band?.shapes[0]?.holes[0] ?? [], 100, 100)).toBe(true);
  });

  it('traces isolines as open polylines, never along the grid border', () => {
    const result = lines(cone(), 3);
    expect(result).toHaveLength(3);
    for (const level of result) {
      expect(level.lines.length).toBeGreaterThan(0);
      for (const line of level.lines) {
        for (let i = 0; i < line.length; i += 2) {
          const onEdge = (line[i] ?? 0) <= -5 || (line[i] ?? 0) >= 205;
          expect(onEdge && i > 0 && i < line.length - 2).toBe(false);
        }
      }
    }
    // A closed loop around the peak keeps its closing point.
    const loop = result[2]?.lines[0] ?? [];
    expect(loop.slice(0, 2)).toEqual(loop.slice(-2));
  });

  it('refuses a grid it cannot read, naming the shape it wants', () => {
    expect(() => bands({ values: [1, 2], cols: 1, rows: 2 }, 2)).toThrow(/s\.lib\.noise/u);
    expect(() => lines(null, 2)).toThrow(/cols, rows/u);
  });

  it('joins, cuts, clips and xors flat polygons', () => {
    const a = square(0, 0, 100);
    const b = square(50, 50, 100);
    expect(totalArea(union(a, b))).toBeCloseTo(17_500, 3);
    expect(totalArea(intersect(a, b))).toBeCloseTo(2500, 3);
    expect(totalArea(difference(a, b))).toBeCloseTo(7500, 3);
    expect(totalArea(xor(a, b))).toBeCloseTo(15_000, 3);
    // A hole: the inner square cut out of the outer one.
    const ring = difference(square(0, 0, 100), square(25, 25, 50));
    const paired = shapes(ring);
    expect(paired).toHaveLength(1);
    expect(paired[0]?.holes).toHaveLength(1);
    expect(totalArea(ring)).toBeCloseTo(7500, 3);
    expect(union([], [])).toEqual([]);
  });

  it('fills shapes on the scene Graphics with their holes cut', () => {
    const { PIXI } = fakePixi();
    const g = new PIXI.Graphics() as unknown as { ops: string[] };
    G.draw(g, difference(square(0, 0, 100), square(25, 25, 50)), 0xff0000, { width: 2 });
    expect(g.ops).toEqual([
      'poly(1)',
      'fill(1)',
      'poly(1)',
      'cut(0)',
      'poly(1)',
      'stroke(1)',
      'poly(1)',
      'stroke(1)',
    ]);
    expect(() => draw({}, square(0, 0, 1), 0)).toThrow(/PIXI\.Graphics/u);
  });

  it('lays a seeded, relaxed mosaic inside its box, with grout, and trims it to an arch', () => {
    const tiles = mosaic(scene(), { width: 400, height: 300, cells: 60, gap: 4 });
    expect(tiles.length).toBeGreaterThan(55);
    for (const tile of tiles) {
      expect(area(tile.tile)).toBeLessThan(area(tile.cell));
      expect(tile.cx).toBeGreaterThanOrEqual(0);
      expect(tile.cx).toBeLessThanOrEqual(400);
      expect(tile.tone).toBeGreaterThanOrEqual(0);
      expect(tile.tone).toBeLessThan(1);
    }
    const whole = tiles.reduce((sum, tile) => sum + area(tile.cell), 0);
    expect(whole).toBeCloseTo(400 * 300, -1);
    expect(mosaic(scene(), { width: 400, height: 300, cells: 60 })[7]?.cell).toEqual(
      mosaic(scene(), { width: 400, height: 300, cells: 60 })[7]?.cell,
    );
    const window = arch(50, 20, 300, 260, 'pointed');
    const framed = mosaic(scene(), { width: 400, height: 300, cells: 80, gap: 0, clip: window });
    const covered = framed.reduce((sum, tile) => sum + area(tile.cell), 0);
    expect(covered).toBeLessThan(area(window) * 1.02);
    expect(covered).toBeGreaterThan(area(window) * 0.9);
    expect(() => mosaic({}, {})).toThrow(/the scene/u);
  });

  it('draws round, pointed and horseshoe arches inside their box, symmetric about the centre', () => {
    for (const kind of G.arches) {
      const outline = arch(100, 50, 200, 300, kind);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      for (let i = 0; i < outline.length; i += 2) {
        minX = Math.min(minX, outline[i] ?? 0);
        maxX = Math.max(maxX, outline[i] ?? 0);
        minY = Math.min(minY, outline[i + 1] ?? 0);
      }
      expect(minX).toBeGreaterThanOrEqual(100 - (kind === 'horseshoe' ? 40 : 1e-6));
      expect(maxX).toBeLessThanOrEqual(300 + (kind === 'horseshoe' ? 40 : 1e-6));
      expect(minY).toBeCloseTo(50, 0);
      const [cx] = centroid(outline);
      expect(cx).toBeCloseTo(200, 3);
      expect(contains(outline, 200, 300)).toBe(true);
      expect(contains(outline, 105, 52)).toBe(false);
    }
  });

  it('makes ribbons, smooth lines and insets', () => {
    const line = [0, 100, 100, 100, 200, 100];
    const band = ribbon(line, 20);
    expect(band).toHaveLength(12);
    expect(area(band)).toBeCloseTo(200 * 20, 6);
    const tapered = ribbon(line, (t) => 20 * (1 - t));
    expect(area(tapered)).toBeLessThan(area(band));
    expect(ribbon([0, 0], 10)).toEqual([]);
    const curve = smooth([0, 0, 100, 0, 100, 100], { iterations: 2 });
    expect(curve.slice(0, 2)).toEqual([0, 0]);
    expect(curve.slice(-2)).toEqual([100, 100]);
    expect(curve.length).toBeGreaterThan(6);
    expect(smooth(square(0, 0, 10), { closed: true, iterations: 1 })).toHaveLength(16);
    const shrunk = inset(square(0, 0, 100), 10);
    expect(area(shrunk)).toBeCloseTo(80 * 80, 6);
    expect(Math.sign(signedArea(shrunk))).toBe(Math.sign(signedArea(square(0, 0, 100))));
    expect(inset(square(0, 0, 100).reverse(), 10).length).toBe(8);
    expect(inset(square(0, 0, 10), 6)).toEqual([]);
  });

  it('turns a noise grid into bands end to end', () => {
    const random = createRandom(3);
    const field = createNoiseLibrary().create({ random: () => random.random() }, { scale: 300 });
    const result = G.bands(field.grid({ width: 640, height: 360, cell: 20 }), 6);
    expect(result).toHaveLength(6);
    expect(result.every((band) => band.shapes.length > 0)).toBe(true);
  });
});
