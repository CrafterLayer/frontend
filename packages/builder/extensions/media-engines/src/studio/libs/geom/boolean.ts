/*
  Polygon booleans for `s.lib.geom` (mural libraries, 2026-10-13): polybooljs 1.2.2 (MIT, Sean
  Connelly) cuts, joins and clips flat polygons — a sun cut out of a paper sky, hills merged into
  one silhouette, a mosaic trimmed to an arch. Only its four algorithm modules are imported: its
  entry file sets `window.PolyBool` and carries GeoJSON and debug-log helpers we do not need.

  A shape is a flat polygon [x0, y0, …], a list of them (read even-odd, so a ring inside another is
  a hole), or what `shapes()` / `G.bands` return ({ outer, holes }). Every result is a list of
  rings; `shapes(rings)` pairs each outer ring with its holes and `draw(g, …)` fills them on a
  Graphics, cutting the holes.
*/

import Epsilon from 'polybooljs/lib/epsilon.js';
import Intersecter, { type PolyBoolPoint } from 'polybooljs/lib/intersecter.js';
import SegmentChainer from 'polybooljs/lib/segment-chainer.js';
import SegmentSelector from 'polybooljs/lib/segment-selector.js';

import { area, contains, flatOf, type Flat } from './paths';

export const BOOLEAN_LIMITS = Object.freeze({ maxRings: 512, maxPoints: 20_000 });

export interface Shape {
  readonly outer: Flat;
  readonly holes: readonly Flat[];
}

export type ShapeInput = Flat | readonly Flat[] | Shape | readonly Shape[];

type Operation = 'union' | 'intersect' | 'difference' | 'xor';

const epsilon = Epsilon();

function isShape(value: unknown): value is Shape {
  return value !== null && typeof value === 'object' && Array.isArray((value as Shape).outer);
}

/** Every ring of a shape input, as flat arrays (holes included). */
export function ringsOf(input: unknown): Flat[] {
  const rings: Flat[] = [];
  const add = (ring: unknown): void => {
    const flat = flatOf(ring);
    if (flat.length >= 6 && rings.length < BOOLEAN_LIMITS.maxRings) rings.push(flat);
  };
  if (isShape(input)) {
    add(input.outer);
    for (const hole of input.holes) add(hole);
  } else if (Array.isArray(input) && input.length > 0) {
    if (typeof input[0] === 'number') add(input);
    else
      for (const item of input as readonly unknown[]) {
        if (isShape(item)) {
          add(item.outer);
          for (const hole of item.holes) add(hole);
        } else add(item);
      }
  }
  return rings;
}

function regionsOf(rings: readonly Flat[]): PolyBoolPoint[][] {
  let budget: number = BOOLEAN_LIMITS.maxPoints;
  const regions: PolyBoolPoint[][] = [];
  for (const ring of rings) {
    const points: PolyBoolPoint[] = [];
    for (let i = 0; i + 1 < ring.length && budget > 0; i += 2, budget -= 1)
      points.push([ring[i] ?? 0, ring[i + 1] ?? 0]);
    if (points.length >= 3) regions.push(points);
  }
  return regions;
}

function segmentsOf(rings: readonly Flat[]) {
  const intersecter = Intersecter(true, epsilon, false);
  for (const region of regionsOf(rings)) intersecter.addRegion(region);
  return intersecter.calculate(false);
}

function operate(operation: Operation, a: unknown, b: unknown): Flat[] {
  const first = segmentsOf(ringsOf(a));
  const second = segmentsOf(ringsOf(b));
  const combined = Intersecter(false, epsilon, false).calculate(first, false, second, false);
  const selected = SegmentSelector[operation](combined, false);
  return SegmentChainer(selected, epsilon, false).map((region) => region.flat());
}

export const union = (a: unknown, b: unknown): Flat[] => operate('union', a, b);
export const intersect = (a: unknown, b: unknown): Flat[] => operate('intersect', a, b);
export const difference = (a: unknown, b: unknown): Flat[] => operate('difference', a, b);
export const xor = (a: unknown, b: unknown): Flat[] => operate('xor', a, b);

/** Rings paired into outer rings and their holes, by nesting depth (even-odd); shapes pass through. */
export function shapes(input: unknown): Shape[] {
  if (isShape(input)) input = [input];
  if (Array.isArray(input) && input.length > 0 && input.every(isShape)) {
    return (input as readonly Shape[])
      .map((shape) => ({ outer: flatOf(shape.outer), holes: ringsOf(shape.holes) }))
      .filter((shape) => shape.outer.length >= 6);
  }
  const rings = ringsOf(input);
  // Rings from a boolean often touch (two L shapes meeting at a corner), so nesting is read from a
  // point just inside each ring, never from a vertex that may sit on another ring's edge.
  const probes = rings.map(interiorPoint);
  const depth = rings.map((_ring, i) =>
    rings.reduce((count, other, j) => {
      const [x, y] = probes[i] ?? [0, 0];
      return j !== i && contains(other, x, y) ? count + 1 : count;
    }, 0),
  );
  const out: { outer: Flat; holes: Flat[]; size: number }[] = [];
  rings.forEach((ring, i) => {
    if ((depth[i] ?? 0) % 2 === 0) out.push({ outer: ring, holes: [], size: area(ring) });
  });
  rings.forEach((ring, i) => {
    if ((depth[i] ?? 0) % 2 === 0) return;
    // The smallest outer ring that contains the hole owns it.
    const [x, y] = probes[i] ?? [0, 0];
    let best: { outer: Flat; holes: Flat[]; size: number } | undefined;
    for (const candidate of out)
      if (contains(candidate.outer, x, y) && (best === undefined || candidate.size < best.size))
        best = candidate;
    best?.holes.push(ring);
  });
  return out.map(({ outer, holes }) => ({ outer, holes }));
}

/** A point strictly inside a ring: an edge midpoint nudged a hair inward. */
function interiorPoint(ring: Flat): [number, number] {
  let size = 0;
  for (let i = 2; i < ring.length; i += 2)
    size = Math.max(
      size,
      Math.abs((ring[i] ?? 0) - (ring[0] ?? 0)),
      Math.abs((ring[i + 1] ?? 0) - (ring[1] ?? 0)),
    );
  const nudge = Math.max(1e-9, size * 1e-4);
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length;
    const ax = ring[i] ?? 0;
    const ay = ring[i + 1] ?? 0;
    const ex = (ring[j] ?? 0) - ax;
    const ey = (ring[j + 1] ?? 0) - ay;
    const length = Math.hypot(ex, ey);
    if (length === 0) continue;
    for (const side of [1, -1]) {
      const x = ax + ex / 2 - (ey / length) * nudge * side;
      const y = ay + ey / 2 + (ex / length) * nudge * side;
      if (contains(ring, x, y)) return [x, y];
    }
  }
  return [ring[0] ?? 0, ring[1] ?? 0];
}

interface GraphicsLike {
  poly(points: number[], close?: boolean): GraphicsLike;
  fill(style: unknown): GraphicsLike;
  stroke(style: unknown): GraphicsLike;
  cut(): GraphicsLike;
}

function isGraphics(value: unknown): value is GraphicsLike {
  const g = value as Partial<GraphicsLike> | null;
  return (
    g !== null &&
    typeof g === 'object' &&
    typeof g.poly === 'function' &&
    typeof g.fill === 'function' &&
    typeof g.cut === 'function'
  );
}

/**
 * Fills a shape input on a Pixi Graphics, holes cut out; an optional stroke outlines every ring.
 * Returns the Graphics for chaining.
 */
export function draw(graphics: unknown, input: unknown, fill: unknown, stroke?: unknown): unknown {
  if (!isGraphics(graphics))
    throw new TypeError('geom: draw(g, shape, fill) needs a PIXI.Graphics first');
  const list = shapes(input);
  for (const shape of list) {
    graphics.poly(shape.outer).fill(fill);
    for (const hole of shape.holes) graphics.poly(hole).cut();
  }
  if (stroke !== undefined && stroke !== null)
    for (const shape of list) {
      graphics.poly(shape.outer).stroke(stroke);
      for (const hole of shape.holes) graphics.poly(hole).stroke(stroke);
    }
  return graphics;
}
