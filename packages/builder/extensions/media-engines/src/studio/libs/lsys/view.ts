/*
  Placing, growing and drawing a grown L-system (`s.lib.lsys`, 2026-10-13), all our own code:

    fit(result, { x, y, width, height }, { align: 'bottom' })  // a scaled copy inside a box
    upTo(result, 0.4)                                           // the first 40 % of the growth
    draw(g, view, { color, width, taper })                      // one stroke per branch depth

  `upTo` grows every branch at once, the way a plant does: a segment shows once the path from
  the root reaches it, and the last one shows in part. It reuses one buffer per result (call it
  each frame without allocating); its arrays are valid until the next upTo of the same result.
*/

import { boundsOf, emptyResult, type LsysBounds, type LsysResult } from './grow';

export interface LsysView {
  readonly segments: Float32Array;
  readonly depths: Uint8Array;
  readonly count: number;
  readonly tips: Float32Array;
}

export interface FitOptions {
  /** Where the system sits in the box: 'center' (default), 'bottom' (plants) or 'top'. */
  align?: 'center' | 'bottom' | 'top';
  /** Design units kept clear inside the box. */
  pad?: number;
}

export interface DrawOptions {
  /** 0xRRGGBB or a CSS string, or one per depth ([trunk, branch, twig…]; the last repeats). */
  color?: number | string | readonly (number | string)[];
  /** The trunk's stroke width; default 2. */
  width?: number;
  /** Width × taper per depth; default 0.72. */
  taper?: number;
  alpha?: number;
  /** No stroke thinner than this; default 0.6. */
  minWidth?: number;
}

interface StrokeTarget {
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  stroke(style: Record<string, unknown>): unknown;
}

const MAX_STROKE_DEPTH = 24;
const GREY = 0x808080;

/** A colour Pixi takes as it is (a finite 0xRRGGBB number or a string), else mid grey. */
function strokeColor(value: unknown): number | string {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
    ? value
    : GREY;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isResult(value: unknown): value is LsysResult {
  const r = value as Partial<LsysResult> | null;
  return (
    r !== null &&
    typeof r === 'object' &&
    r.segments instanceof Float32Array &&
    r.depths instanceof Uint8Array &&
    r.dists instanceof Float32Array &&
    r.tips instanceof Float32Array &&
    r.tipDists instanceof Float32Array &&
    typeof r.count === 'number'
  );
}

function isView(value: unknown): value is LsysView {
  const v = value as Partial<LsysView> | null;
  return (
    v !== null &&
    typeof v === 'object' &&
    v.segments instanceof Float32Array &&
    v.depths instanceof Uint8Array &&
    typeof v.count === 'number'
  );
}

/** A copy scaled uniformly to fit the box (bad input: the input itself, or an empty result). */
export function fit(result: unknown, box: unknown, options: FitOptions = {}): LsysResult {
  if (!isResult(result)) return emptyResult();
  const b = (box !== null && typeof box === 'object' ? box : {}) as Partial<LsysBounds>;
  const pad = Math.max(0, finite(options.pad, 0));
  const width = finite(b.width, 0) - pad * 2;
  const height = finite(b.height, 0) - pad * 2;
  const from = result.bounds;
  if (result.count === 0 || width <= 0 || height <= 0) return result;
  const scale = Math.min(
    from.width > 1e-9 ? width / from.width : Infinity,
    from.height > 1e-9 ? height / from.height : Infinity,
  );
  const k = Number.isFinite(scale) ? scale : 1;
  const left = finite(b.x, 0) + pad + (width - from.width * k) / 2;
  const align = options.align;
  const top =
    finite(b.y, 0) +
    pad +
    (align === 'bottom'
      ? height - from.height * k
      : align === 'top'
        ? 0
        : (height - from.height * k) / 2);
  const move = (values: Float32Array) => {
    const out = new Float32Array(values.length);
    for (let i = 0; i < values.length; i += 2) {
      out[i] = left + ((values[i] ?? 0) - from.x) * k;
      out[i + 1] = top + ((values[i + 1] ?? 0) - from.y) * k;
    }
    return out;
  };
  const segments = move(result.segments);
  return {
    ...result,
    segments,
    tips: move(result.tips),
    dists: result.dists.map((d) => d * k),
    tipDists: result.tipDists.map((d) => d * k),
    length: result.length * k,
    bounds: boundsOf(segments, result.count),
    scale: result.scale * k,
  };
}

interface Scratch {
  segments: Float32Array;
  depths: Uint8Array;
  tips: Float32Array;
}

const SCRATCH = new WeakMap<LsysResult, Scratch>();

/** The part of the growth reached at `fraction` (0 → nothing, 1 → all of it). */
export function upTo(result: unknown, fraction: unknown): LsysView {
  if (!isResult(result))
    return {
      segments: new Float32Array(0),
      depths: new Uint8Array(0),
      count: 0,
      tips: new Float32Array(0),
    };
  let scratch = SCRATCH.get(result);
  if (scratch === undefined) {
    scratch = {
      segments: new Float32Array(result.count * 4),
      depths: new Uint8Array(result.count),
      tips: new Float32Array(result.tips.length),
    };
    SCRATCH.set(result, scratch);
  }
  const limit = Math.min(1, Math.max(0, finite(fraction, 1))) * result.length;
  const { segments, depths, dists } = result;
  let n = 0;
  for (let i = 0; i < result.count && limit > 0; i += 1) {
    const start = dists[i] ?? 0;
    if (start >= limit) continue;
    const at = i * 4;
    const x0 = segments[at] ?? 0;
    const y0 = segments[at + 1] ?? 0;
    const x1 = segments[at + 2] ?? 0;
    const y1 = segments[at + 3] ?? 0;
    const length = Math.hypot(x1 - x0, y1 - y0);
    const part = length > 0 && start + length > limit ? (limit - start) / length : 1;
    const out = n * 4;
    scratch.segments[out] = x0;
    scratch.segments[out + 1] = y0;
    scratch.segments[out + 2] = x0 + (x1 - x0) * part;
    scratch.segments[out + 3] = y0 + (y1 - y0) * part;
    scratch.depths[n] = depths[i] ?? 0;
    n += 1;
  }
  let m = 0;
  for (let j = 0; j < result.tipDists.length; j += 1) {
    if ((result.tipDists[j] ?? 0) > limit) continue;
    scratch.tips[m * 2] = result.tips[j * 2] ?? 0;
    scratch.tips[m * 2 + 1] = result.tips[j * 2 + 1] ?? 0;
    m += 1;
  }
  return {
    segments: scratch.segments.subarray(0, n * 4),
    depths: scratch.depths.subarray(0, n),
    count: n,
    tips: scratch.tips.subarray(0, m * 2),
  };
}

function isStrokeTarget(value: unknown): value is StrokeTarget {
  const g = value as Partial<StrokeTarget> | null;
  return (
    g !== null &&
    typeof g === 'object' &&
    typeof g.moveTo === 'function' &&
    typeof g.lineTo === 'function' &&
    typeof g.stroke === 'function'
  );
}

/** Stroke a result or an upTo view into a PIXI.Graphics: one round-capped stroke per depth. */
export function draw(g: unknown, view: unknown, options: DrawOptions = {}): unknown {
  if (!isStrokeTarget(g))
    throw new TypeError('lsys: draw(g, result, options) needs a PIXI.Graphics first');
  if (!isView(view) || view.count === 0) return g;
  const colors: readonly unknown[] = Array.isArray(options.color) ? options.color : [options.color];
  const width = Math.max(0, finite(options.width, 2));
  const taper = Math.min(1, Math.max(0.05, finite(options.taper, 0.72)));
  const minWidth = Math.max(0, finite(options.minWidth, 0.6));
  const alpha = Math.min(1, Math.max(0, finite(options.alpha, 1)));
  const count = Math.min(view.count, view.depths.length, Math.floor(view.segments.length / 4));
  let deepest = 0;
  for (let i = 0; i < count; i += 1) deepest = Math.max(deepest, view.depths[i] ?? 0);
  for (let depth = 0; depth <= Math.min(deepest, MAX_STROKE_DEPTH); depth += 1) {
    let any = false;
    for (let i = 0; i < count; i += 1) {
      const d = Math.min(MAX_STROKE_DEPTH, view.depths[i] ?? 0);
      if (d !== depth) continue;
      const at = i * 4;
      g.moveTo(view.segments[at] ?? 0, view.segments[at + 1] ?? 0);
      g.lineTo(view.segments[at + 2] ?? 0, view.segments[at + 3] ?? 0);
      any = true;
    }
    if (!any) continue;
    g.stroke({
      width: Math.max(minWidth, width * taper ** depth),
      color: strokeColor(colors[Math.min(depth, colors.length - 1)]),
      alpha,
      cap: 'round',
      join: 'round',
    });
  }
  return g;
}
