import type { Box, Ctx, Gfx, View } from './types';

/*
  Small drawing helpers every primitive shares (mural kit, 2026-10-14): seeded streams, child
  containers, smooth gradients (one FillGradient per colour pair, cached per mural and destroyed
  with it), soft additive lights and a seeded ridge line.
*/

/** mulberry32: a small, fast, seeded 0..1 stream. */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** list[i], wrapping; 0 for an empty list. */
export const at = (list: readonly number[], i: number): number =>
  list[((Math.floor(i) % list.length) + list.length) % list.length] ?? 0;

/** A seeded pick from a list of colours. */
export const pick = (r: () => number, list: readonly number[]): number =>
  at(list, r() * list.length);

/** The first two colours of a list. */
export const pair = (list: readonly number[]): [number, number] => [at(list, 0), at(list, 1)];

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Linear sRGB mix of two 0xRRGGBB colours (the fallback when s.palette.mix is missing). */
export function mixRgb(a: number, b: number, t: number): number {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const x = (a >> shift) & 255;
    out |= Math.round(x + (((b >> shift) & 255) - x) * t) << shift;
  }
  return out;
}

/** The Pixi namespace of the mural being built (set by compose / item before drawing). */
export const ctxP: { current: Ctx['P'] } = {
  current: undefined as unknown as Ctx['P'],
};

export function box(parent: Box, x = 0, y = 0): Box {
  const c = new ctxP.current.Container();
  c.position.set(x, y);
  parent.addChild(c);
  return c;
}

export function gfx(parent: Box, x = 0, y = 0): Gfx {
  const g = new ctxP.current.Graphics();
  g.position.set(x, y);
  parent.addChild(g);
  return g;
}

const hex = (c: number, a: number): string =>
  `#${(c & 0xffffff).toString(16).padStart(6, '0')}${Math.round(clamp(a, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const cache = new WeakMap<Ctx['fills'], Map<string, unknown>>();

function gradient(ctx: Ctx, key: string, options: () => unknown): unknown {
  const Fill = ctx.P.FillGradient;
  if (Fill === undefined) return undefined;
  let map = cache.get(ctx.fills);
  if (map === undefined) cache.set(ctx.fills, (map = new Map<string, unknown>()));
  let fill = map.get(key);
  if (fill === undefined) {
    const made = new Fill(options());
    ctx.fills.push(made);
    map.set(key, (fill = made));
  }
  return fill;
}

/** A vertical gradient top → bottom (an OKLab midpoint keeps dusk from going grey). */
export function vfill(
  ctx: Ctx,
  top: number,
  bottom: number,
  a = 1,
  b = a,
  across = false,
): unknown {
  return (
    gradient(
      ctx,
      `v${String(top)},${String(bottom)},${String(a)},${String(b)},${String(across)}`,
      () => ({
        type: 'linear',
        textureSpace: 'local',
        start: { x: 0, y: 0 },
        end: across ? { x: 1, y: 0 } : { x: 0, y: 1 },
        colorStops: [0, 0.5, 1].map((o) => ({
          offset: o,
          color: hex(ctx.mix(top, bottom, o), a + (b - a) * o),
        })),
      }),
    ) ?? { color: ctx.mix(top, bottom, 0.5), alpha: (a + b) / 2 }
  );
}

/** A radial fade from `color` at `alpha` to clear: lamps, windows at night, the sun's halo. */
export function rfill(ctx: Ctx, color: number, alpha: number): unknown {
  return (
    gradient(ctx, `r${String(color)},${String(alpha)}`, () => ({
      type: 'radial',
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: hex(color, alpha) },
        { offset: 0.45, color: hex(color, alpha * 0.35) },
        { offset: 1, color: hex(color, 0) },
      ],
    })) ?? { color, alpha: alpha * 0.3 }
  );
}

/** A soft additive light, centred at x, y in `parent`. */
export function glow(
  ctx: Ctx,
  parent: Box,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha = 0.7,
): Gfx {
  const g = gfx(parent, x, y);
  g.blendMode = 'add';
  return g.circle(0, 0, r).fill(rfill(ctx, color, alpha));
}

/** A seeded ridge line from x0 to x1: base y, amplitude, roughness (higher is more jagged). */
export function ridge(
  r: () => number,
  x0: number,
  x1: number,
  y: number,
  amp: number,
  step: number,
  rough = 0.5,
): number[] {
  const pts: number[] = [];
  const [p0, p1, p2] = [r() * 6, r() * 6, r() * 6];
  const f = 6.28 / (x1 - x0 + 1);
  for (let x = x0; x <= x1 + step; x += step) {
    const v =
      Math.sin(x * f * 1.3 + p0) * 0.55 +
      Math.sin(x * f * 4.1 + p1) * 0.3 +
      Math.sin(x * f * 11 + p2) * 0.15 * rough * 2;
    pts.push(Math.min(x, x1), y - amp * (0.5 + v * 0.5));
  }
  return pts;
}

/** Close a top line down to `bottom` and fill it. */
export function band(g: Gfx, top: number[], bottom: number, fill: unknown): Gfx {
  const x0 = top[0] ?? 0;
  const x1 = top[top.length - 2] ?? 0;
  return g.poly([x0, bottom, ...top, x1, bottom]).fill(fill);
}

/** Lit marks start dark: they turn on with the lights beat or at dusk. */
export function lit<T extends View>(view: T): T {
  view.alpha = 0;
  return view;
}

/** Spread `count` positions over [from, to] with seeded jitter. */
export function spread(r: () => number, count: number, from: number, to: number): number[] {
  const out: number[] = [];
  const step = (to - from) / Math.max(1, count);
  for (let i = 0; i < count; i += 1) out.push(from + step * (i + 0.15 + r() * 0.7));
  return out;
}

/** A crescent of a disc of radius r: the limb on `side` (-1 left, 1 right), the terminator at k·r. */
export function crescent(r: number, k: number, side: 1 | -1): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= 48; i += 1) {
    const j = i <= 24 ? i : 48 - i;
    const t = Math.PI / 2 + (Math.PI * j) / 24;
    pts.push(-side * Math.cos(t) * r * (i <= 24 ? 1 : k), Math.sin(t) * r);
  }
  return pts;
}
