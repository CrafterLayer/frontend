/*
  `G.mosaic(s, …)` (mural libraries, 2026-10-13): a stained-glass or tessera layout in one call —
  points from the scene's seeded random, Lloyd-relaxed through the kit's own `s.delaunay(…).voronoi`
  (no second Voronoi), each cell inset by the grout `gap`, optionally trimmed to a mask such as
  `G.arch(…)`: cells wholly inside stay as they are, cells across the edge are intersected with it.
*/

import { intersect } from './boolean';
import { area, centroid, contains, flatOf, inset, type Flat } from './paths';

export const MOSAIC_LIMITS = Object.freeze({ maxCells: 2000, maxRelax: 6 });

export interface MosaicOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** How many tiles; default 160 (before s.count: pass s.count(n) to follow density and quality). */
  cells?: number;
  /** Lloyd passes, 0..6: 0 is raw scatter, 2 (default) even, 6 nearly a honeycomb. */
  relax?: number;
  /** Grout between tiles in design units; default 3. */
  gap?: number;
  /** A flat polygon the mosaic is trimmed to (an arch, a circle, a letterform outline). */
  clip?: Flat;
}

export interface MosaicTile {
  readonly index: number;
  /** The Voronoi cell (trimmed to `clip`). */
  readonly cell: Flat;
  /** The cell inset by `gap`: what to fill. */
  readonly tile: Flat;
  readonly cx: number;
  readonly cy: number;
  /** A stable value in [0, 1) per tile, for picking a palette colour. */
  readonly tone: number;
}

interface SceneLike {
  random(): number;
  delaunay(points: readonly (readonly [number, number])[]): {
    voronoi(bounds?: readonly [number, number, number, number]): number[][];
  };
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sceneOf(value: unknown): SceneLike {
  const scene = value as Partial<SceneLike> | null;
  if (scene === null || typeof scene.random !== 'function' || typeof scene.delaunay !== 'function')
    throw new TypeError('geom: mosaic(s, options) needs the scene (s) first');
  return scene as SceneLike;
}

export function mosaic(scene: unknown, input?: unknown): MosaicTile[] {
  const s = sceneOf(scene);
  const options = (input !== null && typeof input === 'object' ? input : {}) as MosaicOptions;
  const x = finite(options.x, 0);
  const y = finite(options.y, 0);
  const width = Math.max(1, finite(options.width, 1280));
  const height = Math.max(1, finite(options.height, 720));
  const count = Math.min(
    MOSAIC_LIMITS.maxCells,
    Math.max(3, Math.round(finite(options.cells, 160))),
  );
  const relax = Math.min(MOSAIC_LIMITS.maxRelax, Math.max(0, Math.round(finite(options.relax, 2))));
  const gap = Math.max(0, finite(options.gap, 3));
  const clip = options.clip === undefined ? [] : flatOf(options.clip);
  const bounds = [x, y, x + width, y + height] as const;
  let points: [number, number][] = [];
  for (let i = 0; i < count; i += 1) points.push([x + s.random() * width, y + s.random() * height]);
  let cells: number[][] = [];
  for (let pass = 0; pass <= relax; pass += 1) {
    cells = s.delaunay(points).voronoi(bounds);
    if (pass < relax)
      points = points.map((point, i) => {
        const cell = cells[i];
        return cell !== undefined && cell.length >= 6 ? centroid(cell) : point;
      });
  }
  const tiles: MosaicTile[] = [];
  cells.forEach((raw, index) => {
    let cell = flatOf(raw);
    if (cell.length < 6) return;
    if (clip.length >= 6) {
      let inside = 0;
      for (let i = 0; i < cell.length; i += 2)
        if (contains(clip, cell[i] ?? 0, cell[i + 1] ?? 0)) inside += 1;
      if (inside < cell.length / 2) {
        // Across (or outside) the mask: keep the largest piece of the intersection, if any.
        const pieces = intersect(cell, clip).filter((piece) => piece.length >= 6);
        if (pieces.length === 0) return;
        cell = pieces.reduce((best, piece) => (area(piece) > area(best) ? piece : best));
      }
    }
    const tile = gap > 0 ? inset(cell, gap / 2) : cell;
    if (tile.length < 6) return;
    const [cx, cy] = centroid(cell);
    tiles.push({ index, cell, tile, cx, cy, tone: s.random() });
  });
  return tiles;
}
