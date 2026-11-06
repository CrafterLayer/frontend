/*
  Renderer-independent geometry for `s.lib.creatures` (character art, 2026-11-05). A creature is
  a tree of parts (the rig's joints); each part holds layers of primitives — ellipses, rounded
  rects and paths of lines, quadratic and cubic curves — with a solid or gradient fill and an
  optional line. Pixi Graphics and an SVG string both draw the same tree, so a thumbnail and the
  live character never disagree.

  Units: the character is drawn in a 120-unit square, x -60..60 and y -114..6, with its feet at
  (0, 0) and y growing down (Pixi's and SVG's convention). Gradients are in the shape's own
  bounding box (0..1), which is SVG's objectBoundingBox and Pixi v8's 'local' texture space.
*/

export const FRAME = Object.freeze({ left: -60, top: -114, width: 120, height: 120 });

export type Cmd =
  | readonly ['M', number, number]
  | readonly ['L', number, number]
  | readonly ['Q', number, number, number, number]
  | readonly ['C', number, number, number, number, number, number]
  | readonly ['Z'];

export type Shape =
  | {
      readonly t: 'ellipse';
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
    }
  | { readonly t: 'path'; readonly d: readonly Cmd[] };

/** A gradient stop: offset 0..1, colour, alpha. */
export type Stop = readonly [number, number, number];

export type Gradient =
  | {
      readonly type: 'linear';
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly stops: readonly Stop[];
    }
  | {
      readonly type: 'radial';
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
      readonly stops: readonly Stop[];
    };

export type Paint = number | Gradient;

export interface Line {
  readonly w: number;
  readonly c: number;
  readonly a?: number;
}

export interface Prim {
  readonly shape: Shape;
  readonly fill?: Paint;
  /** Fill opacity, 0..1. */
  readonly alpha?: number;
  /** A line drawn over the fill (details: mouths, lids, brows). */
  readonly line?: Line;
}

/**
 * Primitives drawn together. With `outline`, every primitive's line (twice the width, centred on
 * the edge) is drawn before any fill, so overlapping shapes merge into one silhouette with one
 * outer outline and no seams where they meet.
 */
export interface Layer {
  readonly kind: 'layer';
  readonly prims: readonly Prim[];
  readonly outline?: Line;
  /** Optional role, for the life runner (e.g. 'sparkle'). */
  readonly role?: string;
}

/** A joint: a container at an absolute pivot; its layers are drawn in figure coordinates. */
export interface Part {
  readonly kind: 'part';
  readonly name: string;
  /** The pivot in figure coordinates (the part rotates and scales about it). */
  readonly px: number;
  readonly py: number;
  readonly items: readonly (Layer | Part)[];
}

export type Pt = readonly [number, number];

const K = 0.5523;

export function ellipse(cx: number, cy: number, rx: number, ry = rx): Shape {
  return { t: 'ellipse', cx, cy, rx, ry };
}

export function path(d: readonly Cmd[]): Shape {
  return { t: 'path', d };
}

/** A closed polygon. */
export function poly(points: readonly Pt[]): Shape {
  const d: Cmd[] = [];
  points.forEach(([x, y], i) => d.push(i === 0 ? ['M', x, y] : ['L', x, y]));
  d.push(['Z']);
  return path(d);
}

/** An open polyline (for lines). */
export function polyline(points: readonly Pt[]): Shape {
  return path(points.map(([x, y], i) => (i === 0 ? ['M', x, y] : ['L', x, y]) as Cmd));
}

/** An open quadratic curve: from a through control c to b. */
export function curve(a: Pt, c: Pt, b: Pt): Shape {
  return path([
    ['M', a[0], a[1]],
    ['Q', c[0], c[1], b[0], b[1]],
  ]);
}

const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * A smooth closed curve around a control polygon: it passes through each edge's midpoint and is
 * pulled toward each vertex (a quadratic B-spline), so any rough outline comes out rounded.
 */
export function smooth(points: readonly Pt[]): Shape {
  const n = points.length;
  const at = (i: number): Pt => points[((i % n) + n) % n] ?? [0, 0];
  const start = mid(at(-1), at(0));
  const d: Cmd[] = [['M', start[0], start[1]]];
  for (let i = 0; i < n; i += 1) {
    const p = at(i);
    const m = mid(p, at(i + 1));
    d.push(['Q', p[0], p[1], m[0], m[1]]);
  }
  d.push(['Z']);
  return path(d);
}

/** A polygon with each corner rounded by up to `radius` (per-corner radii allowed). */
export function rounded(points: readonly Pt[], radius: number | readonly number[]): Shape {
  const n = points.length;
  const at = (i: number): Pt => points[((i % n) + n) % n] ?? [0, 0];
  const d: Cmd[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = at(i - 1);
    const p = at(i);
    const next = at(i + 1);
    const r = typeof radius === 'number' ? radius : (radius[i] ?? 0);
    const lin = Math.hypot(p[0] - prev[0], p[1] - prev[1]) || 1;
    const lout = Math.hypot(next[0] - p[0], next[1] - p[1]) || 1;
    const rin = Math.min(r, lin / 2);
    const rout = Math.min(r, lout / 2);
    const a: Pt = [p[0] + ((prev[0] - p[0]) / lin) * rin, p[1] + ((prev[1] - p[1]) / lin) * rin];
    const b: Pt = [
      p[0] + ((next[0] - p[0]) / lout) * rout,
      p[1] + ((next[1] - p[1]) / lout) * rout,
    ];
    d.push(i === 0 ? ['M', a[0], a[1]] : ['L', a[0], a[1]]);
    d.push(['Q', p[0], p[1], b[0], b[1]]);
  }
  d.push(['Z']);
  return path(d);
}

/**
 * A soft blob around (x, y): `top` and `bottom` reach up and down, `rx` is the half width at the
 * widest line (`widest` below the centre). `k` is the curve's fullness: 0.55 is an ellipse,
 * 0.7 a squircle; kTop and kBottom set the two halves apart.
 */
export function blob(
  x: number,
  y: number,
  rx: number,
  top: number,
  bottom: number,
  widest = 0,
  kTop = K,
  kBottom = kTop,
  topWidth = 1,
): Shape {
  const ty = y - top;
  const by = y + bottom;
  const wy = y + widest;
  const tw = rx * kTop * topWidth;
  const bw = rx * kBottom;
  return path([
    ['M', x, ty],
    ['C', x + tw, ty, x + rx, wy - (wy - ty) * kTop, x + rx, wy],
    ['C', x + rx, wy + (by - wy) * kBottom, x + bw, by, x, by],
    ['C', x - bw, by, x - rx, wy + (by - wy) * kBottom, x - rx, wy],
    ['C', x - rx, wy - (wy - ty) * kTop, x - tw, ty, x, ty],
    ['Z'],
  ]);
}

/** A rounded rectangle as a path. */
export function rrect(x: number, y: number, w: number, h: number, r: number): Shape {
  const q = Math.min(r, w / 2, h / 2);
  const k = q * (1 - K);
  return path([
    ['M', x + q, y],
    ['L', x + w - q, y],
    ['C', x + w - k, y, x + w, y + k, x + w, y + q],
    ['L', x + w, y + h - q],
    ['C', x + w, y + h - k, x + w - k, y + h, x + w - q, y + h],
    ['L', x + q, y + h],
    ['C', x + k, y + h, x, y + h - k, x, y + h - q],
    ['L', x, y + q],
    ['C', x, y + k, x + k, y, x + q, y],
    ['Z'],
  ]);
}

/** Points along a quadratic spine a → c → b. */
export function spine(a: Pt, c: Pt, b: Pt, steps = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    ]);
  }
  return out;
}

/** A tapered tube along a polyline spine: width w0 at the start, w1 at the end, round ends. */
export function tube(points: readonly Pt[], w0: number, w1: number): Shape {
  const n = points.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const p = points[i] ?? [0, 0];
    const a = points[Math.max(0, i - 1)] ?? p;
    const b = points[Math.min(n - 1, i + 1)] ?? p;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * (i / Math.max(1, n - 1))) / 2;
    left.push([p[0] - (dy / len) * w, p[1] + (dx / len) * w]);
    right.push([p[0] + (dy / len) * w, p[1] - (dx / len) * w]);
  }
  const d: Cmd[] = [];
  left.forEach(([x, y], i) => d.push(i === 0 ? ['M', x, y] : ['L', x, y]));
  // Round the far end with a curve bulging past the last point.
  const last = points[n - 1] ?? [0, 0];
  const before = points[n - 2] ?? last;
  const ex = last[0] - before[0];
  const ey = last[1] - before[1];
  const el = Math.hypot(ex, ey) || 1;
  const cap = w1 * 0.75;
  const l = left[n - 1] ?? last;
  const r = right[n - 1] ?? last;
  d.push([
    'C',
    l[0] + (ex / el) * cap,
    l[1] + (ey / el) * cap,
    r[0] + (ex / el) * cap,
    r[1] + (ey / el) * cap,
    r[0],
    r[1],
  ]);
  for (let i = n - 2; i >= 0; i -= 1) {
    const p = right[i] ?? [0, 0];
    d.push(['L', p[0], p[1]]);
  }
  const first = points[0] ?? [0, 0];
  const second = points[1] ?? first;
  const sx = first[0] - second[0];
  const sy = first[1] - second[1];
  const sl = Math.hypot(sx, sy) || 1;
  const scap = w0 * 0.75;
  const r0 = right[0] ?? first;
  const l0 = left[0] ?? first;
  d.push([
    'C',
    r0[0] + (sx / sl) * scap,
    r0[1] + (sy / sl) * scap,
    l0[0] + (sx / sl) * scap,
    l0[1] + (sy / sl) * scap,
    l0[0],
    l0[1],
  ]);
  d.push(['Z']);
  return path(d);
}

/** Points sampled around an ellipse, clockwise from the right. */
export function ellipsePoints(cx: number, cy: number, rx: number, ry: number, n = 40): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

/** An ellipse cut to lie between two curves (`top(x)` ≤ y ≤ `bottom(x)`): lids over an eye. */
export function clipped(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  top: ((x: number) => number) | undefined,
  bottom: ((x: number) => number) | undefined,
): Shape {
  const pts = ellipsePoints(cx, cy, rx, ry, 48).map(([x, y]): Pt => {
    let v = y;
    if (top !== undefined) v = Math.max(v, top(x));
    if (bottom !== undefined) v = Math.min(v, bottom(x));
    return [x, v];
  });
  return top === undefined && bottom === undefined ? ellipse(cx, cy, rx, ry) : smoothPoly(pts);
}

/* A dense polygon drawn with curves through its midpoints (no visible facets when scaled up). */
function smoothPoly(points: readonly Pt[]): Shape {
  return smooth(points);
}

/** Every point of a shape (path control points bound the curve), for bounds. */
export function shapePoints(shape: Shape): Pt[] {
  if (shape.t === 'ellipse') {
    return [
      [shape.cx - shape.rx, shape.cy - shape.ry],
      [shape.cx + shape.rx, shape.cy + shape.ry],
    ];
  }
  const out: Pt[] = [];
  for (const c of shape.d) {
    if (c[0] === 'M' || c[0] === 'L') out.push([c[1], c[2]]);
    else if (c[0] === 'Q') out.push([c[1], c[2]], [c[3], c[4]]);
    else if (c[0] === 'C') out.push([c[1], c[2]], [c[3], c[4]], [c[5], c[6]]);
  }
  return out;
}

/** A shape moved, turned about (ox, oy) and optionally mirrored in x. Ellipses become paths when turned. */
export function transform(
  shape: Shape,
  dx: number,
  dy: number,
  angle = 0,
  ox = 0,
  oy = 0,
  flip = false,
): Shape {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const f = flip ? -1 : 1;
  const map = (x: number, y: number): Pt => {
    const lx = (x - ox) * f;
    const ly = y - oy;
    return [ox * f + lx * cos - ly * sin + dx, oy + lx * sin + ly * cos + dy];
  };
  if (shape.t === 'ellipse') {
    if (angle === 0) {
      return ellipse(shape.cx * f + dx, shape.cy + dy, shape.rx, shape.ry);
    }
    return transform(ellipsePath(shape), dx, dy, angle, ox, oy, flip);
  }
  return path(
    shape.d.map((c): Cmd => {
      if (c[0] === 'M' || c[0] === 'L') return [c[0], ...map(c[1], c[2])];
      if (c[0] === 'Q') return ['Q', ...map(c[1], c[2]), ...map(c[3], c[4])];
      if (c[0] === 'C') return ['C', ...map(c[1], c[2]), ...map(c[3], c[4]), ...map(c[5], c[6])];
      return c;
    }),
  );
}

export function ellipsePath(e: { cx: number; cy: number; rx: number; ry: number }): Shape {
  return blob(e.cx, e.cy, e.rx, e.ry, e.ry, 0);
}

/** An ellipse turned by `angle` about its centre. */
export function tilted(cx: number, cy: number, rx: number, ry: number, angle: number): Shape {
  return transform(ellipse(cx, cy, rx, ry), 0, 0, angle, cx, cy);
}

/** Primitives mirrored in x (a left part from a right one). */
export function mirror(prims: readonly Prim[]): Prim[] {
  return prims.map((p) => ({ ...p, shape: transform(p.shape, 0, 0, 0, 0, 0, true) }));
}

/** Primitives turned by `angle` about (ox, oy). */
export function turn(prims: readonly Prim[], angle: number, ox: number, oy: number): Prim[] {
  return prims.map((p) => ({ ...p, shape: transform(p.shape, 0, 0, angle, ox, oy) }));
}

/** Primitives scaled by k about (ox, oy). */
export function scale(prims: readonly Prim[], k: number, ox: number, oy: number): Prim[] {
  if (k === 1) return [...prims];
  const map = (x: number, y: number): Pt => [ox + (x - ox) * k, oy + (y - oy) * k];
  return prims.map((p) => {
    const s = p.shape;
    const shape: Shape =
      s.t === 'ellipse'
        ? ellipse(...map(s.cx, s.cy), s.rx * k, s.ry * k)
        : path(
            s.d.map((c): Cmd => {
              if (c[0] === 'M' || c[0] === 'L') return [c[0], ...map(c[1], c[2])];
              if (c[0] === 'Q') return ['Q', ...map(c[1], c[2]), ...map(c[3], c[4])];
              if (c[0] === 'C')
                return ['C', ...map(c[1], c[2]), ...map(c[3], c[4]), ...map(c[5], c[6])];
              return c;
            }),
          );
    return { ...p, shape };
  });
}

/** Primitives moved by (dx, dy). */
export function shift(prims: readonly Prim[], dx: number, dy: number): Prim[] {
  return prims.map((p) => ({ ...p, shape: transform(p.shape, dx, dy) }));
}

export function layer(prims: readonly Prim[], outline?: Line, role?: string): Layer {
  return {
    kind: 'layer',
    prims,
    ...(outline === undefined ? {} : { outline }),
    ...(role === undefined ? {} : { role }),
  };
}

export function part(name: string, px: number, py: number, items: readonly (Layer | Part)[]): Part {
  return { kind: 'part', name, px, py, items };
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The figure-space bounds of a part tree (outline included). */
export function bounds(root: Part): Box {
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const visit = (p: Part) => {
    for (const item of p.items) {
      if (item.kind === 'part') {
        visit(item);
        continue;
      }
      const pad = (item.outline?.w ?? 0) + 0.5;
      for (const prim of item.prims) {
        const w = prim.line === undefined ? 0 : prim.line.w / 2;
        for (const [x, y] of shapePoints(prim.shape)) {
          box.minX = Math.min(box.minX, x - pad - w);
          box.minY = Math.min(box.minY, y - pad - w);
          box.maxX = Math.max(box.maxX, x + pad + w);
          box.maxY = Math.max(box.maxY, y + pad + w);
        }
      }
    }
  };
  visit(root);
  return box;
}

/** A shape as a dense polygon (curves flattened). */
export function flatten(shape: Shape): Pt[] {
  if (shape.t === 'ellipse') return ellipsePoints(shape.cx, shape.cy, shape.rx, shape.ry, 48);
  const out: Pt[] = [];
  let cur: Pt = [0, 0];
  for (const c of shape.d) {
    if (c[0] === 'M' || c[0] === 'L') {
      cur = [c[1], c[2]];
      out.push(cur);
    } else if (c[0] === 'Q') {
      const [, qx, qy, x, y] = c;
      for (let i = 1; i <= 8; i += 1) {
        const t = i / 8;
        const u = 1 - t;
        out.push([
          u * u * cur[0] + 2 * u * t * qx + t * t * x,
          u * u * cur[1] + 2 * u * t * qy + t * t * y,
        ]);
      }
      cur = [x, y];
    } else if (c[0] === 'C') {
      const [, ax, ay, bx, by, x, y] = c;
      for (let i = 1; i <= 12; i += 1) {
        const t = i / 12;
        const u = 1 - t;
        out.push([
          u * u * u * cur[0] + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x,
          u * u * u * cur[1] + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y,
        ]);
      }
      cur = [x, y];
    }
  }
  return out;
}

function area(points: readonly Pt[]): number {
  let a = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length] ?? p;
    a += p[0] * q[1] - q[0] * p[1];
  });
  return a / 2;
}

/** Sutherland–Hodgman: the part of `subject` inside the convex polygon `clip`. */
export function clipConvex(subject: readonly Pt[], clip: readonly Pt[]): Pt[] {
  const sign = area(clip) >= 0 ? 1 : -1;
  let out: Pt[] = [...subject];
  for (let i = 0; i < clip.length && out.length > 0; i += 1) {
    const a = clip[i] ?? [0, 0];
    const b = clip[(i + 1) % clip.length] ?? a;
    const inside = (p: Pt) =>
      sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0;
    const cross = (p: Pt, q: Pt): Pt => {
      const x1 = a[0];
      const y1 = a[1];
      const dx = b[0] - x1;
      const dy = b[1] - y1;
      const ex = q[0] - p[0];
      const ey = q[1] - p[1];
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) return q;
      const t = ((p[0] - x1) * ey - (p[1] - y1) * ex) / den;
      return [x1 + dx * t, y1 + dy * t];
    };
    const input = out;
    out = [];
    input.forEach((p, j) => {
      const prev = input[(j + input.length - 1) % input.length] ?? p;
      if (inside(p)) {
        if (!inside(prev)) out.push(cross(prev, p));
        out.push(p);
      } else if (inside(prev)) out.push(cross(prev, p));
    });
  }
  return out;
}

/** A marking cut to lie inside a convex silhouette (spots that wrap around an edge). */
export function within(mark: Shape, container: Shape, inset = 0.4): Shape | undefined {
  let clip = flatten(container);
  if (inset > 0) {
    const cx = clip.reduce((s, p) => s + p[0], 0) / clip.length;
    const cy = clip.reduce((s, p) => s + p[1], 0) / clip.length;
    clip = clip.map(([x, y]): Pt => {
      const d = Math.hypot(x - cx, y - cy) || 1;
      return [x - ((x - cx) / d) * inset, y - ((y - cy) / d) * inset];
    });
  }
  const pts = clipConvex(flatten(mark), clip);
  return pts.length < 3 || Math.abs(area(pts)) < 0.5 ? undefined : poly(pts);
}

/* ------------------------------------------------------------------ gradients */

/** Soft form shading: light from the upper left, a defined (not hard) terminator, a cool core shadow. */
export function formShade(
  light: number,
  base: number,
  shadeTone: number,
  deep: number,
  rim = deep,
): Gradient {
  return {
    type: 'radial',
    cx: 0.36,
    cy: 0.3,
    r: 0.82,
    stops: [
      [0, light, 1],
      [0.4, base, 1],
      [0.64, base, 1],
      [0.82, shadeTone, 1],
      [0.94, deep, 1],
      // A faint bounce light on the far rim keeps the shadow side from going flat.
      [1, rim, 1],
    ],
  };
}

export function linear(top: number, bottom: number, x1 = 0.5, y1 = 0, x2 = 0.5, y2 = 1): Gradient {
  return {
    type: 'linear',
    x1,
    y1,
    x2,
    y2,
    stops: [
      [0, top, 1],
      [1, bottom, 1],
    ],
  };
}

/** A soft glow: colour at `alpha` in the middle fading to nothing at the edge. */
export function glow(color: number, alpha: number): Gradient {
  return {
    type: 'radial',
    cx: 0.5,
    cy: 0.5,
    r: 0.5,
    stops: [
      [0, color, alpha],
      [0.55, color, alpha * 0.75],
      [1, color, 0],
    ],
  };
}
