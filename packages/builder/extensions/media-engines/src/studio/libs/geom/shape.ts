/*
  Splines, arcs, pies and simplification in `s.lib.geom` 1.2.0 (mural libraries 2, 2026-10-13):

    G.spline([x0, y0, x1, y1, …], { curve: 'catmull', closed, steps })  // a smooth flat polyline
    G.arc({ cx, cy, inner, outer, start, end, corner, pad })            // a ring sector polygon
    G.pie([3, 1, 2], { pad: 0.02 }) → [{ index, value, start, end, mid, pad }]  // angle spans
    G.simplify(strokePoints, 2)                                          // fewer points, same line

  Curves and arcs are d3-shape 3.2.0's (ISC, © Mike Bostock; d3-path 3.1.0 comes with it),
  drawn into a path context of our own that samples every Bézier and circular arc into points —
  no DOM, no SVG string. Simplification is simplify-js 1.2.4 (BSD-2-Clause, © Vladimir
  Agafonkin): radial distance, then Douglas–Peucker. Angles are radians, 0 at 12 o'clock,
  clockwise on screen (d3's convention). As everywhere in s.lib.geom, polygons are flat
  [x0, y0, …] arrays in design units and bad input gives [] instead of throwing.
*/

import {
  arc as d3Arc,
  curveBasis,
  curveBasisClosed,
  curveCatmullRom,
  curveCatmullRomClosed,
  curveLinear,
  curveLinearClosed,
  curveMonotoneX,
  curveNatural,
  curveStep,
  line,
  pie as d3Pie,
  type CurveFactory,
  type ShapeContext,
} from 'd3-shape';
import simplifyPoints from 'simplify-js';

import { flatOf, PATH_LIMITS, type Flat } from './paths';

export const SPLINE_CURVES = Object.freeze([
  'catmull',
  'basis',
  'natural',
  'monotone',
  'step',
  'linear',
] as const);
export type SplineCurve = (typeof SPLINE_CURVES)[number];

export const SHAPE_LIMITS = Object.freeze({ maxSplineSteps: 64, maxArcSteps: 720, maxPie: 512 });

const TAU = Math.PI * 2;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * A d3 path context that keeps points instead of path text: Béziers become `steps` points each,
 * circular arcs `arcSteps` points per full turn, all offset by (ox, oy). Only the first subpath
 * is kept (a line or an arc sector draws one).
 */
class Sampler implements ShapeContext {
  readonly points: Flat = [];
  private subpaths = 0;
  private x = 0;
  private y = 0;

  constructor(
    private readonly steps: number,
    private readonly arcSteps: number,
    private readonly ox = 0,
    private readonly oy = 0,
  ) {}

  private push(x: number, y: number): void {
    this.x = x;
    this.y = y;
    if (this.subpaths > 1 || this.points.length >= PATH_LIMITS.maxPoints * 2) return;
    const px = x + this.ox;
    const py = y + this.oy;
    const n = this.points.length;
    if (
      n >= 2 &&
      Math.abs((this.points[n - 2] ?? 0) - px) < 1e-9 &&
      Math.abs((this.points[n - 1] ?? 0) - py) < 1e-9
    )
      return;
    this.points.push(px, py);
  }

  moveTo(x: number, y: number): void {
    this.subpaths += 1;
    this.push(x, y);
  }

  lineTo(x: number, y: number): void {
    this.push(x, y);
  }

  closePath(): void {
    // A closed ring is returned without repeating its first point.
    const n = this.points.length;
    if (n >= 4 && this.subpaths === 1) {
      const same =
        Math.abs((this.points[0] ?? 0) - (this.points[n - 2] ?? 0)) < 1e-6 &&
        Math.abs((this.points[1] ?? 0) - (this.points[n - 1] ?? 0)) < 1e-6;
      if (same) this.points.length = n - 2;
    }
  }

  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    const x0 = this.x;
    const y0 = this.y;
    for (let i = 1; i <= this.steps; i += 1) {
      const t = i / this.steps;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      this.push(a * x0 + b * c1x + c * c2x + d * x, a * y0 + b * c1y + c * c2y + d * y);
    }
  }

  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    const x0 = this.x;
    const y0 = this.y;
    for (let i = 1; i <= this.steps; i += 1) {
      const t = i / this.steps;
      const u = 1 - t;
      this.push(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y);
    }
  }

  /** Canvas semantics: a line to the arc's start, then the arc, the short way unless it is whole. */
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false): void {
    let sweep = a1 - a0;
    if (!ccw && sweep >= TAU) sweep = TAU;
    else if (ccw && -sweep >= TAU) sweep = -TAU;
    else if (!ccw) sweep = ((sweep % TAU) + TAU) % TAU;
    else sweep = -(((-sweep % TAU) + TAU) % TAU);
    if (this.subpaths === 0) this.subpaths = 1;
    this.push(x + r * Math.cos(a0), y + r * Math.sin(a0));
    const count = Math.max(1, Math.ceil((Math.abs(sweep) / TAU) * this.arcSteps));
    for (let i = 1; i <= count; i += 1) {
      const a = a0 + (sweep * i) / count;
      this.push(x + r * Math.cos(a), y + r * Math.sin(a));
    }
  }
}

export interface SplineOptions {
  /** 'catmull' (default: through every point), 'basis' (smoothest, near the points), 'natural',
   * 'monotone' (no overshoot along x), 'step' or 'linear'. */
  curve?: SplineCurve;
  /** A closed loop (natural and monotone close as catmull). */
  closed?: boolean;
  /** Points per curve piece; default 8. */
  steps?: number;
}

function curveOf(name: SplineCurve, closed: boolean): CurveFactory {
  if (closed) {
    if (name === 'basis') return curveBasisClosed;
    if (name === 'linear') return curveLinearClosed;
    if (name === 'step') return curveStep;
    return curveCatmullRomClosed.alpha(0.5);
  }
  switch (name) {
    case 'basis':
      return curveBasis;
    case 'natural':
      return curveNatural;
    case 'monotone':
      return curveMonotoneX;
    case 'step':
      return curveStep;
    case 'linear':
      return curveLinear;
    default:
      return curveCatmullRom.alpha(0.5);
  }
}

/** A smooth curve through (or near) the points, as a flat polyline (a ring when closed). */
export function spline(points: unknown, options: unknown = {}): Flat {
  const flat = flatOf(points);
  if (flat.length < 4) return flat.length === 2 ? flat : [];
  const opts = (options !== null && typeof options === 'object' ? options : {}) as SplineOptions;
  const name = SPLINE_CURVES.find((curve) => curve === opts.curve) ?? 'catmull';
  const closed = opts.closed === true;
  const steps = clamp(Math.round(finite(opts.steps, 8)), 1, SHAPE_LIMITS.maxSplineSteps);
  const pairs: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) pairs.push([flat[i] ?? 0, flat[i + 1] ?? 0]);
  if (closed && name === 'step') pairs.push(pairs[0] ?? [0, 0]);
  const sampler = new Sampler(steps, 96);
  line().curve(curveOf(name, closed)).context(sampler)(pairs);
  // Closed catmull and basis curves end on their first point without a closePath of their own.
  if (closed) sampler.closePath();
  return sampler.points;
}

export interface ArcOptions {
  cx?: number;
  cy?: number;
  /** Inner radius; 0 (default) makes a pie wedge. */
  inner?: number;
  outer?: number;
  /** Radians, 0 at 12 o'clock, clockwise; default 0 → a full turn. */
  start?: number;
  end?: number;
  /** Rounded corners' radius. */
  corner?: number;
  /** The gap between neighbouring sectors, radians (as G.pie gives it). */
  pad?: number;
  /** Points per full turn of a circle; default 96. */
  steps?: number;
}

/** A ring sector (or a whole ring, a wedge, a disc) as one flat polygon. */
export function arc(options: unknown): Flat {
  const o = (options !== null && typeof options === 'object' ? options : {}) as ArcOptions;
  const outer = Math.max(0, finite(o.outer, 0));
  const inner = clamp(finite(o.inner, 0), 0, outer);
  if (outer <= 0) return [];
  const start = finite(o.start, 0);
  let end = finite(o.end, start + TAU);
  // A whole ring stays ONE polygon: a hairline short of a full turn.
  if (Math.abs(end - start) >= TAU) end = start + Math.sign(end - start) * (TAU - 1e-4);
  const steps = clamp(Math.round(finite(o.steps, 96)), 8, SHAPE_LIMITS.maxArcSteps);
  const sampler = new Sampler(8, steps, finite(o.cx, 640), finite(o.cy, 360));
  d3Arc()
    .innerRadius(inner)
    .outerRadius(outer)
    .startAngle(start)
    .endAngle(end)
    .cornerRadius(Math.max(0, finite(o.corner, 0)))
    .padAngle(Math.max(0, finite(o.pad, 0)))
    .context(sampler)();
  sampler.closePath();
  return sampler.points.length >= 6 ? sampler.points : [];
}

export interface PieOptions {
  /** Radians, 0 at 12 o'clock; default 0. */
  start?: number;
  /** Default start + a full turn. */
  end?: number;
  /** The gap between sectors, radians. */
  pad?: number;
  /** -1 lays the sectors out counter-clockwise (pass s.dir for right-to-left pages). */
  dir?: number;
}

export interface PieSpan {
  readonly index: number;
  readonly value: number;
  readonly start: number;
  readonly end: number;
  /** The bisecting angle: where a label or an ornament goes. */
  readonly mid: number;
  readonly pad: number;
}

/** Angle spans for values in their own order (negative or bad values get none), for G.arc. */
export function pie(values: unknown, options: unknown = {}): PieSpan[] {
  if (!Array.isArray(values)) return [];
  const data = values.slice(0, SHAPE_LIMITS.maxPie).map((value) => Math.max(0, finite(value, 0)));
  if (data.length === 0) return [];
  const o = (options !== null && typeof options === 'object' ? options : {}) as PieOptions;
  const start = finite(o.start, 0);
  const layout = d3Pie()
    .sortValues(null)
    .startAngle(start)
    .endAngle(finite(o.end, start + TAU))
    .padAngle(Math.max(0, finite(o.pad, 0)));
  const mirror = o.dir === -1;
  return layout(data).map((span, index) => {
    const a = mirror ? 2 * start - span.endAngle : span.startAngle;
    const b = mirror ? 2 * start - span.startAngle : span.endAngle;
    return { index, value: span.value, start: a, end: b, mid: (a + b) / 2, pad: span.padAngle };
  });
}

/** Fewer points along the same line (brush strokes, traced paths); tolerance in design units. */
export function simplify(points: unknown, tolerance?: unknown, highQuality?: unknown): Flat {
  const flat = flatOf(points);
  if (flat.length < 6 || typeof simplifyPoints !== 'function') return flat;
  const list: { x: number; y: number }[] = [];
  for (let i = 0; i < flat.length; i += 2) list.push({ x: flat[i] ?? 0, y: flat[i + 1] ?? 0 });
  const kept = simplifyPoints(list, Math.max(0, finite(tolerance, 1)), highQuality === true);
  return kept.flatMap(({ x, y }) => [x, y]);
}
