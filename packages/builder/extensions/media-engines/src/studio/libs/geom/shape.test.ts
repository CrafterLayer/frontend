import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createGeomLibrary, GEOM_VERSION } from '../geom-entry';
import { area, contains } from './paths';

const G = createGeomLibrary();
const TAU = Math.PI * 2;

function points(flat: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i] ?? 0, flat[i + 1] ?? 0]);
  return out;
}

function passesNear(line: readonly number[], x: number, y: number, tolerance = 1e-6): boolean {
  return points(line).some(([px, py]) => Math.hypot(px - x, py - y) <= tolerance);
}

const ZIGZAG = [0, 300, 200, 100, 400, 300, 600, 100, 800, 300];

describe('geom 1.2: splines, arcs, pies and simplification', () => {
  it('is version 1.2.0 and names d3-shape, d3-path and simplify-js from their manifests', () => {
    expect(GEOM_VERSION).toBe('1.2.0');
    expect(G.curves).toEqual(['catmull', 'basis', 'natural', 'monotone', 'step', 'linear']);
    const manifest = (name: string) =>
      JSON.parse(
        readFileSync(
          resolve(import.meta.dirname, `../../../../node_modules/${name}/package.json`),
          'utf8',
        ),
      ) as { version: string; license: string };
    expect(manifest('d3-shape')).toMatchObject({ version: '3.2.0', license: 'ISC' });
    expect(manifest('simplify-js')).toMatchObject({ version: '1.2.4', license: 'BSD-2-Clause' });
  });

  it('samples catmull, natural and monotone splines through every point', () => {
    for (const curve of ['catmull', 'natural', 'monotone'] as const) {
      const line = G.spline(ZIGZAG, { curve, steps: 10 });
      expect(line.length).toBe(2 + 4 * 10 * 2);
      for (const [x, y] of points(ZIGZAG)) expect(passesNear(line, x, y, 1e-3)).toBe(true);
    }
    // Monotone never overshoots between the points' y range.
    const monotone = points(G.spline(ZIGZAG, { curve: 'monotone' }));
    for (const [, y] of monotone) expect(y >= 100 - 1e-6 && y <= 300 + 1e-6).toBe(true);
  });

  it('keeps a basis spline inside the points and draws steps with right angles', () => {
    const basis = points(G.spline(ZIGZAG, { curve: 'basis' }));
    expect(basis[0]).toEqual([0, 300]);
    for (const [, y] of basis) expect(y > 100 && y <= 300).toBe(true);
    const step = points(G.spline([0, 0, 100, 50, 200, 0], { curve: 'step' }));
    expect(step).toEqual([
      [0, 0],
      [50, 0],
      [50, 50],
      [150, 50],
      [150, 0],
      [200, 0],
    ]);
  });

  it('closes a spline into a ring without repeating its first point', () => {
    const square = [100, 100, 300, 100, 300, 300, 100, 300];
    for (const curve of ['catmull', 'basis', 'natural', 'linear', 'step'] as const) {
      const ring = G.spline(square, { curve, closed: true, steps: 6 });
      expect(ring.length).toBeGreaterThanOrEqual(8);
      const last = ring.length - 2;
      const gap = Math.hypot(
        (ring[0] ?? 0) - (ring[last] ?? 0),
        (ring[1] ?? 0) - (ring[last + 1] ?? 0),
      );
      expect(gap).toBeGreaterThan(1e-6);
      expect(contains(ring, 200, 200)).toBe(true);
    }
    expect(G.spline(square, { curve: 'linear', closed: true })).toEqual(square);
  });

  it('gives [] for bad spline input instead of throwing', () => {
    expect(G.spline(null)).toEqual([]);
    expect(G.spline([1, 2, 3])).toEqual([1, 2]);
    expect(G.spline([0, 0, Number.NaN, 4, 10, 10], { curve: 'nope' as never })).toEqual([
      0, 0, 10, 10,
    ]);
    expect(G.spline(ZIGZAG, { steps: 1e9 }).length).toBeLessThanOrEqual(G.limits.maxPoints * 2);
  });

  it('builds ring sectors, wedges and whole rings as one polygon in screen angles', () => {
    // A quarter ring from 12 to 3 o'clock, clockwise on screen.
    const quarter = G.arc({ cx: 640, cy: 360, inner: 100, outer: 200, start: 0, end: Math.PI / 2 });
    const exact = (Math.PI * (200 ** 2 - 100 ** 2)) / 4;
    expect(area(quarter) / exact).toBeCloseTo(1, 2);
    expect(contains(quarter, 640 + 106, 360 - 106)).toBe(true);
    expect(contains(quarter, 640 - 106, 360 - 106)).toBe(false);
    // A wedge reaches the centre; a whole ring is one polygon with the hole left open.
    expect(contains(G.arc({ outer: 100, start: 0, end: 1 }), 641, 340)).toBe(true);
    const ring = G.arc({ cx: 0, cy: 0, inner: 50, outer: 100 });
    expect(area(ring) / (Math.PI * (100 ** 2 - 50 ** 2))).toBeCloseTo(1, 2);
    expect(contains(ring, 0, 0)).toBe(false);
    expect(contains(ring, 75, 0)).toBe(true);
    // Rounded corners and padding shrink the sector a little.
    const plain = area(G.arc({ inner: 100, outer: 200, start: 0, end: 1 }));
    expect(area(G.arc({ inner: 100, outer: 200, start: 0, end: 1, corner: 20 }))).toBeLessThan(
      plain,
    );
    expect(area(G.arc({ inner: 100, outer: 200, start: 0, end: 1, pad: 0.1 }))).toBeLessThan(plain);
    expect(G.arc({ outer: 0 })).toEqual([]);
    expect(G.arc(null)).toEqual([]);
  });

  it('lays values out as pie spans in their own order, mirrored on request', () => {
    const spans = G.pie([1, 2, 1]);
    expect(spans.map(({ index, value }) => [index, value])).toEqual([
      [0, 1],
      [1, 2],
      [2, 1],
    ]);
    expect(spans[0]?.start).toBe(0);
    expect(spans[1]?.end).toBeCloseTo((TAU * 3) / 4, 9);
    expect(spans[2]?.end).toBeCloseTo(TAU, 9);
    expect(spans[1]?.mid).toBeCloseTo(TAU / 2, 9);
    // RTL: the same spans counter-clockwise from 12 o'clock.
    const mirrored = G.pie([1, 2, 1], { dir: -1 });
    expect(mirrored[0]?.end).toBeCloseTo(0, 9);
    expect(mirrored[0]?.start).toBeCloseTo(-TAU / 4, 9);
    // Padding, a half-circle range, and bad values that take no angle.
    const half = G.pie([1, Number.NaN, -3, 1], {
      start: -Math.PI / 2,
      end: Math.PI / 2,
      pad: 0.05,
    });
    expect(half).toHaveLength(4);
    expect(half[3]?.end).toBeCloseTo(Math.PI / 2, 9);
    expect(half[0]?.pad).toBeCloseTo(0.05, 9);
    expect(G.pie('nope')).toEqual([]);
    // Spans feed G.arc directly.
    expect(G.arc({ outer: 100, ...spans[1] }).length).toBeGreaterThan(6);
  });

  it('simplifies a dense stroke within tolerance, keeping its ends', () => {
    const stroke: number[] = [];
    for (let i = 0; i <= 400; i += 1)
      stroke.push(i * 2, 300 + Math.sin(i / 20) * 80 + ((i * 7) % 3) * 0.2);
    const loose = G.simplify(stroke, 4);
    const tight = G.simplify(stroke, 0.5, true);
    expect(loose.length).toBeLessThan(stroke.length / 5);
    expect(tight.length).toBeGreaterThan(loose.length);
    expect(loose.slice(0, 2)).toEqual([0, stroke[1]]);
    expect(loose.slice(-2)).toEqual(stroke.slice(-2));
    expect(G.simplify(null)).toEqual([]);
    expect(G.simplify([0, 0, 5, 5])).toEqual([0, 0, 5, 5]);
  });
});
