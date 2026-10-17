/*
  Contours for `s.lib.geom` (mural libraries, 2026-10-13): d3-contour 4.0.2 (ISC) runs marching
  squares over a sampled grid — `s.lib.noise` grids, or any { values, cols, rows, cell, x, y } —
  and this file turns its GeoJSON (grid units, closed rings) into flat polygons in design units.

    G.bands(grid, 8)  // 8 nested regions, low to high: paint them in order for terraced elevation
    G.lines(grid, 12) // the isolines as open polylines, without the runs along the grid's border

  Bands are painted in order (painter's algorithm), so band k covers band k − 1: each band is the
  region where the field is at least its value, with holes where it dips back below. Band 0 is the
  whole grid. Coordinates map a value at (col, row) to (x + col·cell, y + row·cell).
*/

import { contours as d3Contours, type ContourRing } from 'd3-contour';

import type { Flat } from './paths';

export const CONTOUR_LIMITS = Object.freeze({ maxLevels: 64, maxSamples: 160_000 });

export interface GridLike {
  readonly values: ArrayLike<number>;
  readonly cols: number;
  readonly rows: number;
  readonly cell?: number;
  readonly x?: number;
  readonly y?: number;
}

export interface BandShape {
  readonly outer: Flat;
  readonly holes: readonly Flat[];
}

export interface Band {
  readonly index: number;
  readonly value: number;
  readonly shapes: readonly BandShape[];
}

export interface Isoline {
  readonly index: number;
  readonly value: number;
  readonly lines: readonly Flat[];
}

interface Frame {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly x: number;
  readonly y: number;
  readonly values: Float64Array;
  readonly min: number;
  readonly max: number;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function frameOf(input: unknown): Frame {
  const grid = (input ?? {}) as Partial<GridLike>;
  const cols = Math.round(finite(grid.cols, 0));
  const rows = Math.round(finite(grid.rows, 0));
  const source = grid.values;
  if (
    cols < 2 ||
    rows < 2 ||
    cols * rows > CONTOUR_LIMITS.maxSamples ||
    source === undefined ||
    typeof source.length !== 'number' ||
    source.length < cols * rows
  ) {
    throw new TypeError(
      'geom: a grid is { values, cols, rows, cell?, x?, y? } with cols, rows ≥ 2 (s.lib.noise field.grid() makes one)',
    );
  }
  const values = new Float64Array(cols * rows);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const value = finite(source[i], 0);
    values[i] = value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return {
    cols,
    rows,
    cell: Math.max(1e-6, finite(grid.cell, 1)),
    x: finite(grid.x, 0),
    y: finite(grid.y, 0),
    values,
    min,
    max,
  };
}

/** `count` evenly spaced thresholds over the grid's range, or the given ones, sorted. */
function thresholdsOf(frame: Frame, levels: unknown, bands: boolean): number[] {
  if (Array.isArray(levels)) {
    return levels
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .slice(0, CONTOUR_LIMITS.maxLevels)
      .sort((a, b) => a - b);
  }
  const count = Math.min(CONTOUR_LIMITS.maxLevels, Math.max(1, Math.round(finite(levels, 8))));
  const span = frame.max - frame.min || 1;
  const out: number[] = [];
  // Bands start with the whole grid (just under the minimum); lines skip both ends.
  for (let k = 0; k < count; k += 1) {
    out.push(
      bands ? frame.min - 1e-9 + (span * k) / count : frame.min + (span * (k + 1)) / (count + 1),
    );
  }
  return out;
}

/*
  d3-contour puts sample i at pixel centre i + 0.5; ours sits at x + i·cell. A polygon drops the
  repeated closing point (Graphics.poly closes it); a polyline keeps it, so a loop stays closed.
*/
function project(frame: Frame, ring: ContourRing, polygon = true): Flat {
  const out: Flat = [];
  const last = ring.length - 1;
  const closed =
    polygon && last > 0 && ring[0]?.[0] === ring[last]?.[0] && ring[0]?.[1] === ring[last]?.[1];
  const end = closed ? last : ring.length;
  for (let i = 0; i < end; i += 1) {
    const point = ring[i];
    if (point === undefined) continue;
    out.push(frame.x + (point[0] - 0.5) * frame.cell, frame.y + (point[1] - 0.5) * frame.cell);
  }
  return out;
}

function generate(frame: Frame, thresholds: number[]) {
  return d3Contours().size([frame.cols, frame.rows]).smooth(true).thresholds(thresholds)(
    frame.values,
  );
}

/** Nested regions for terraced fills: band k is where the field is ≥ its value. */
export function bands(grid: unknown, levels?: number | readonly number[]): Band[] {
  const frame = frameOf(grid);
  const thresholds = thresholdsOf(frame, levels, true);
  return generate(frame, thresholds).map((multi, index) => ({
    index,
    value: multi.value,
    shapes: multi.coordinates
      .map(([outer, ...holes]) => ({
        outer: outer === undefined ? [] : project(frame, outer),
        holes: holes.map((hole) => project(frame, hole)),
      }))
      .filter((shape) => shape.outer.length >= 6),
  }));
}

function onBorder(frame: Frame, point: ContourRing[number] | undefined): 0 | 1 | 2 | 3 | 4 {
  if (point === undefined) return 0;
  if (point[0] <= 0) return 1;
  if (point[0] >= frame.cols) return 2;
  if (point[1] <= 0) return 3;
  if (point[1] >= frame.rows) return 4;
  return 0;
}

/** The isolines at each level as open polylines; segments running along the grid edge are dropped. */
export function lines(grid: unknown, levels?: number | readonly number[]): Isoline[] {
  const frame = frameOf(grid);
  const thresholds = thresholdsOf(frame, levels, false);
  return generate(frame, thresholds).map((multi, index) => {
    const runs: Flat[] = [];
    for (const polygon of multi.coordinates) {
      for (const ring of polygon) {
        let run: ContourRing = [];
        for (let i = 1; i < ring.length; i += 1) {
          const a = ring[i - 1];
          const b = ring[i];
          if (a === undefined || b === undefined) continue;
          const side = onBorder(frame, a);
          if (side !== 0 && side === onBorder(frame, b)) {
            if (run.length > 1) runs.push(project(frame, run, false));
            run = [];
            continue;
          }
          if (run.length === 0) run.push(a);
          run.push(b);
        }
        if (run.length > 1) runs.push(project(frame, run, false));
      }
    }
    return { index, value: multi.value, lines: runs };
  });
}
