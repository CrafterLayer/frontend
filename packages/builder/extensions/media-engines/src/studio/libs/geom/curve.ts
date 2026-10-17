/*
  Curves in `s.lib.geom` (2026-10-13, on the owner's word): quadratic and cubic Bézier curves on
  Bezier.js 6.1.4 (MIT, © Pomax), vendored verbatim under vendor/bezier-js with its licence (the
  npm tarball has none). What a mural draws with a curve:

    const c = s.lib.geom.curve([80, 600, 400, 80, 900, 700, 1200, 120]); // 6 numbers: quadratic
    g.poly(c.outline([4, 40]), true).fill(ink);  // a brush stroke that swells from 4 to 40 wide
    g.poly(c.points(64)).stroke(...);            // the curve itself, as a polyline
    c.at(t) / c.normal(t) / c.length() / c.project(x, y) / c.offset(d) / c.split(t)

  Every polygon is a flat [x0, y0, …] array in design units for `Graphics.poly`, as in the rest of
  s.lib.geom. Bad input never throws: it gives an empty curve whose methods return nothing, as
  geom's other helpers return [] (authored code is plain JavaScript and must keep running).
*/
import { Bezier, type BezierPoint } from '../../../../vendor/bezier-js/bezier.js';

import { flatOf, type Flat } from './paths';

export const CURVE_LIMITS = Object.freeze({ maxSteps: 512, maxWidth: 4000 });

export interface CurvePoint {
  readonly x: number;
  readonly y: number;
}

export interface GeomCurve {
  /** `steps` + 1 points along the curve (default 32), a flat polyline. */
  points(steps?: number): Flat;
  length(): number;
  at(t: number): CurvePoint;
  /** The unit normal at t (left of the direction of travel). */
  normal(t: number): CurvePoint;
  /** The nearest point on the curve to (x, y), its t and its distance d. */
  project(x: number, y: number): CurvePoint & { readonly t: number; readonly d: number };
  /** A line `d` units beside the curve (negative: the other side), as a flat polyline. */
  offset(d: number, steps?: number): Flat;
  /** The curve with a width as ONE closed polygon: a number, or [start, end] to taper or swell. */
  outline(width: number | readonly [number, number], steps?: number): Flat;
  /** The two halves at t. */
  split(t: number): readonly [GeomCurve, GeomCurve];
  bbox(): {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stepsOf(steps: unknown, fallback: number): number {
  return Math.min(CURVE_LIMITS.maxSteps, Math.max(1, Math.round(finite(steps, fallback))));
}

function widthOf(value: unknown): number {
  return Math.min(CURVE_LIMITS.maxWidth, Math.max(0, finite(value, 0)));
}

/** Points of several curves joined end to end, a shared joint written once. */
function joined(curves: readonly Bezier[], steps: number): Flat {
  const out: Flat = [];
  for (const piece of curves) {
    for (const point of piece.getLUT(steps)) {
      const n = out.length;
      if (
        n >= 2 &&
        Math.abs((out[n - 2] ?? 0) - point.x) < 1e-6 &&
        Math.abs((out[n - 1] ?? 0) - point.y) < 1e-6
      )
        continue;
      out.push(point.x, point.y);
    }
  }
  return out;
}

function flatPoints(points: readonly BezierPoint[]): Flat {
  return points.flatMap(({ x, y }) => [x, y]);
}

const ORIGIN: CurvePoint = Object.freeze({ x: 0, y: 0 });

const EMPTY: GeomCurve = Object.freeze({
  points: () => [],
  length: () => 0,
  at: () => ORIGIN,
  normal: () => ORIGIN,
  project: () => Object.freeze({ x: 0, y: 0, t: 0, d: 0 }),
  offset: () => [],
  outline: () => [],
  split: () => [EMPTY, EMPTY] as const,
  bbox: () => Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
});

function wrap(curve: Bezier): GeomCurve {
  const point = (p: BezierPoint): CurvePoint => Object.freeze({ x: p.x, y: p.y });
  return Object.freeze({
    points: (steps?: number) => flatPoints(curve.getLUT(stepsOf(steps, 32))),
    length: () => curve.length(),
    at: (t: number) => point(curve.get(Math.min(1, Math.max(0, finite(t, 0))))),
    normal: (t: number) => point(curve.normal(Math.min(1, Math.max(0, finite(t, 0))))),
    project: (x: number, y: number) => {
      const p = curve.project({ x: finite(x, 0), y: finite(y, 0) });
      return Object.freeze({ x: p.x, y: p.y, t: p.t ?? 0, d: p.d ?? 0 });
    },
    offset: (d: number, steps?: number) => {
      try {
        return joined(curve.offset(finite(d, 0)), stepsOf(steps, 12));
      } catch {
        return [];
      }
    },
    outline: (width: number | readonly [number, number], steps?: number) => {
      const [start, end] = Array.isArray(width) ? width : [width, width];
      const a = widthOf(start) / 2;
      const b = widthOf(end) / 2;
      try {
        const shape = a === b ? curve.outline(a) : curve.outline(a, a, b, b);
        return joined(shape.curves, stepsOf(steps, 8));
      } catch {
        // Bezier.js cannot outline a degenerate curve (all points in one place): nothing to draw.
        return [];
      }
    },
    split: (t: number) => {
      const halves = curve.split(Math.min(1, Math.max(0, finite(t, 0.5))));
      return Object.freeze([wrap(halves.left), wrap(halves.right)] as const);
    },
    bbox: () => {
      const box = curve.bbox();
      return Object.freeze({
        x: box.x.min,
        y: box.y.min,
        width: box.x.max - box.x.min,
        height: box.y.max - box.y.min,
      });
    },
  });
}

/** A quadratic (6 numbers) or cubic (8 numbers) Bézier from a flat [x0, y0, …] array. */
export function curve(input: unknown): GeomCurve {
  const coords = flatOf(input);
  if (coords.length !== 6 && coords.length !== 8) return EMPTY;
  try {
    return wrap(new Bezier(...coords));
  } catch {
    return EMPTY;
  }
}
