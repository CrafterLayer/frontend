import type { Box, Ctx, Depth, Drawn, ItemOpts, MuralPixi, Palette, View } from './types';
import { LIGHT, resolvePalette } from './palette';
import { DEPTHS, normalize, type NItem, type NSpec } from './spec';
import { box, ctxP, gfx, mixRgb, rng, spread, vfill } from './util';
import { tell, type Built, type Placed } from './story';

/*
  `s.lib.mural.compose(s, spec)` (mural kit, 2026-10-14): a whole illustrated mural from a small
  spec. It composes at the 1280 × 720 design in s.world, mirrored for RTL (s.dir), in five depth
  layers that pan with the camera at their own pace (sky 0.04, far 0.3, mid 0.6, near 1, front
  1.3) and fade into the haze with distance; draws every item once (seeded, so the same spec is
  the same picture); then hands the placed items to `tell` (story.ts), which builds the one
  labelled s.lib.anim timeline from the beats and drives it.

  x is in panorama units (0..width): an item at x sits in the middle of the view when the camera
  is there, whatever its layer. Sky items use screen x (0..1280). Object sizes shrink with depth.
*/

export interface MuralScene {
  PIXI: unknown;
  world?: unknown;
  stage?: unknown;
  design?: unknown;
  width?: number;
  height?: number;
  dir?: number;
  editor?: boolean;
  reducedMotion?: boolean;
  palette?: { mix?(a: number, b: number, t: number): number; accent?: number; surface?: number };
  lib?: Record<string, unknown>;
  count?(n: number): number;
  params?: Record<string, unknown>;
  scroll?: { progress: number; velocity: number };
  tick?(fn: (time: { dt: number; t: number }) => void): void;
  dispose?(fn: () => void): void;
  onResize?(fn: (w: number, h: number) => void): void;
}

export const LAYER: Record<Depth, { f: number; fade: number; scale: number }> = {
  sky: { f: 0.04, fade: 0, scale: 1 },
  far: { f: 0.3, fade: 0.42, scale: 0.6 },
  mid: { f: 0.6, fade: 0.2, scale: 0.8 },
  near: { f: 1, fade: 0, scale: 1 },
  front: { f: 1.3, fade: -0.22, scale: 1.25 },
};

const hash = (...parts: number[]): number =>
  parts.reduce((h, p) => Math.imul(h ^ Math.round(p * 997), 0x5bd1e995) >>> 0, 0x811c9dc5);

/** The layer coordinate of a panorama x (sky: screen x as written). */
export function layerX(depth: Depth, x: number): number {
  return depth === 'sky' ? x : 640 + (x - 640) * LAYER[depth].f;
}

function baseY(n: NSpec, depth: Depth, item: NItem): number {
  if (
    item.entry.at !== undefined &&
    (depth === 'sky' || item.entry.group === 'sky' || item.entry.group === 'space')
  ) {
    return item.name === 'stars' ? n.horizon : item.entry.at;
  }
  if (item.name === 'sea' || item.name === 'river') return n.horizon;
  return depth === 'far'
    ? n.horizon
    : depth === 'mid'
      ? (n.horizon + n.ground) / 2
      : depth === 'front'
        ? 720
        : depth === 'sky'
          ? 300
          : n.ground;
}

/** Draw one normalised item (and its repeats) into a layer; errors become warnings. */
function place(
  b: Built,
  n: NSpec,
  item: NItem,
  index: number,
  ctxBase: Omit<Ctx, 'art' | 'glow' | 'c' | 'r' | 'span' | 'depth'>,
  warn: (m: string) => void,
): void {
  const depth = item.depth;
  const L = b.layers[depth];
  const overlay = item.entry.overlay === true;
  const span = 1280 + (n.width - 1280) * (depth === 'sky' || overlay ? 0 : LAYER[depth].f);
  const haze =
    n.mood === 'reef' ? ctxBase.mix(b.pal.water[0], b.pal.water[1], 0.45) : b.pal.sky.day[1];
  const fade = LAYER[depth].fade;
  const c = (color: number) =>
    fade > 0
      ? ctxBase.mix(color, haze, fade)
      : fade < 0
        ? ctxBase.mix(color, b.pal.ink, -fade)
        : color;
  const art = overlay ? b.overlay : L.art;
  const from = item.from === undefined ? -60 : layerX(depth, item.from);
  const to = item.to === undefined ? span + 60 : layerX(depth, item.to);
  const scale = item.entry.wide === true ? 1 : LAYER[depth].scale;
  const size = item.size ?? item.entry.size * scale;
  // Wide items, and items whose count is their own (a train's carriages), are drawn once.
  const repeat = item.entry.wide === true || item.entry.count !== undefined ? 1 : (item.count ?? 1);
  const xs =
    repeat > 1
      ? spread(rng(hash(n.seed, index, 7)), repeat, from, to)
      : [item.x === undefined ? (from + to) / 2 : layerX(depth, item.x)];
  xs.forEach((x, i) => {
    const r = rng(item.seed === undefined ? hash(n.seed, index, i) : hash(item.seed, i));
    const opts: ItemOpts = {
      x,
      y: item.y ?? baseY(n, depth, item),
      size: repeat > 1 ? size * (1 - item.vary + r() * item.vary * 2) : size,
      from,
      to,
      kind: item.kind,
      count: item.count ?? item.entry.count ?? 1,
      seed: item.seed ?? n.seed,
      flag: item.flag,
      ...(item.color === undefined ? {} : { color: item.color }),
      ...(item.colors === undefined ? {} : { colors: item.colors }),
    };
    let drawn: Drawn | undefined;
    try {
      drawn = item.entry.draw({ ...ctxBase, art, glow: L.glow, c, r, span, depth }, opts);
    } catch (error) {
      warn(`${item.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (drawn === undefined) return;
    const placed: Placed = { drawn, item, x, sy: drawn.view.scale.y };
    b.placed.push(placed);
    if (item.id !== undefined) (b.ids[item.id] ??= []).push(placed);
  });
}

function skies(b: Built, n: NSpec, ctx: Ctx): void {
  const times = [...new Set(n.times)];
  times.forEach((time, i) => {
    const g = gfx(b.back);
    const [top, bottom] = b.pal.sky[time];
    g.rect(-60, -60, 1400, n.horizon + 140)
      .fill(vfill(ctx, top, bottom))
      .rect(-60, n.horizon + 79, 1400, 800)
      .fill(bottom);
    g.alpha = i === 0 ? 1 : 0;
    b.skies[time] = g;
  });
}

/** An Open Peeps head when s.lib.peeps is loaded: a sprite whose texture arrives later. */
function peepHook(s: MuralScene, P: MuralPixi, warn: (m: string) => void): Pick<Ctx, 'peep'> {
  const peeps = s.lib?.['peeps'] as
    { texture?: (t: unknown, o: unknown) => Promise<unknown> } | undefined;
  const texture = peeps?.texture;
  const Sprite = P.Sprite;
  if (typeof texture !== 'function' || Sprite === undefined) return {};
  return {
    peep: (seed, size) => {
      const sprite = new Sprite(P.Texture?.EMPTY);
      sprite.anchor?.set(0.5, 0.62);
      texture(s, { seed, size: 96 }).then(
        (made) => {
          if (sprite.destroyed === true) return;
          (sprite as unknown as { texture: unknown }).texture = made;
          sprite.scale.set(size / 60);
        },
        () => {
          warn(`peep "${seed}" did not load; the drawn head shows`);
        },
      );
      return sprite;
    },
  };
}

/** Build a mural from a spec into the scene; returns its handle (see mural-entry.ts). */
export function compose(s: MuralScene, input: unknown) {
  const warnings: string[] = [];
  const warn = (m: string) => {
    if (warnings.length < 40) warnings.push(m);
  };
  const n = normalize(input, warnings);
  const P = s.PIXI as MuralPixi;
  ctxP.current = P;
  const mix = typeof s.palette?.mix === 'function' ? s.palette.mix.bind(s.palette) : mixRgb;
  const theme =
    n.theme && typeof s.palette?.accent === 'number'
      ? { accent: s.palette.accent, surface: s.palette.surface ?? 0xffffff }
      : undefined;
  const pal: Palette = resolvePalette(n.mood, n.colors, mix, theme);
  const parent = (s.world ?? s.stage) as Box;
  const root = new P.Container();
  parent.addChild(root);
  const dir = s.dir === -1 ? -1 : 1;
  const fit = (w: number, h: number) => {
    const k = s.design ? 1 : Math.max(w / 1280, h / 720);
    root.scale.set(dir * k, k);
    root.position.set(
      (dir < 0 ? 1280 * k : 0) + (s.design ? 0 : (w - 1280 * k) / 2),
      s.design ? 0 : (h - 720 * k) / 2,
    );
  };
  if (!s.design)
    warn(
      "compose draws at a 1280 × 720 design: ck.scene({design:{width:1280,height:720,fit:'cover'}})",
    );
  fit(s.width ?? 1280, s.height ?? 720);
  if (!s.design) s.onResize?.(fit);
  const b: Built = {
    root,
    back: box(root),
    layers: {} as Built['layers'],
    overlay: undefined as unknown as Box,
    pal,
    skies: {},
    placed: [],
    ids: {},
    fills: [],
    n,
  };
  for (const depth of DEPTHS) {
    const container = box(root);
    b.layers[depth] = { container, art: box(container), glow: box(container), f: LAYER[depth].f };
  }
  b.overlay = box(root);
  const ctxBase = {
    P,
    pal,
    mix,
    n: (count: number) =>
      Math.max(1, Math.round(typeof s.count === 'function' ? s.count(count) : count)),
    fills: b.fills,
    ...peepHook(s, P, warn),
  };
  const skyCtx: Ctx = {
    ...ctxBase,
    art: b.back,
    glow: b.back,
    c: (x) => x,
    r: rng(n.seed),
    span: 1280,
    depth: 'sky',
  };
  if (n.sky && !n.items.some((item) => item.name === 'underwater')) skies(b, n, skyCtx);
  n.items.forEach((item, i) => {
    place(b, n, item, i, ctxBase, warn);
  });
  const tint = LIGHT[n.times[0] ?? 'day'].tint;
  for (const depth of DEPTHS) b.layers[depth].art.tint = tint;
  b.overlay.tint = tint;
  const handle = tell(s, b, warn);
  if (warnings.length > 0 && typeof console !== 'undefined')
    console.warn(`s.lib.mural: ${warnings.join('; ')}`);
  return Object.assign(handle, { warnings });
}

export type { View };
