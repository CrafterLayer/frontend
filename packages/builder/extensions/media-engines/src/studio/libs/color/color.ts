/*
  `s.lib.color` (mural libraries 2, 2026-10-13): perceptual colour for murals that must stay in
  the page's palette, on culori 4.0.2 (MIT, © Dan Burzo) — only its tree-shakable `culori/fn`
  entry, with the four colour spaces a mural needs registered (sRGB, linear sRGB for WCAG
  luminance, OKLab, OKLCH; HSL is left out: 0.6 kB for strings a palette-bound scene never
  writes).

    const Co = s.lib.color, C = s.palette;
    Co.ramp(C.surface, C.accent, 7, { space: 'oklch' })  // 7 × 0xRRGGBB, perceptually even
    Co.shades(C.accent, 5)                              // lighter → darker, the hue kept
    Co.harmony(C.accent, 'triadic')                     // [accent, +120°, +240°] in OKLCH
    Co.readable(C.surface, [C.text, C.accent])          // the first ≥ 4.5:1, else the best

  Every colour in is a 0xRRGGBB number (what s.palette gives), a '#hex' / 'oklch(…)' /
  'oklab(…)' / 'rgb(…)' / named CSS string, or a culori object; every colour out is a 0xRRGGBB
  number for Pixi (toHex gives '#rrggbb'). OKLCH results are brought into sRGB by lowering chroma
  (lightness and hue kept). Nothing throws: an unreadable colour reads as mid grey and an
  unreadable list gives [], as s.lib.geom's helpers do (authored code is plain JavaScript).
*/

import {
  clampChroma,
  interpolate,
  modeLrgb,
  modeOklab,
  modeOklch,
  modeRgb,
  parse,
  useMode,
  wcagContrast,
  type Color,
  type Oklch,
} from 'culori/fn';

const toRgb = useMode(modeRgb);
useMode(modeLrgb);
useMode(modeOklab);
const toOklch = useMode(modeOklch);

export const COLOR_SPACES = Object.freeze(['oklab', 'oklch'] as const);
export const COLOR_HARMONIES = Object.freeze([
  'analogous',
  'complementary',
  'triadic',
  'split',
  'tetradic',
] as const);
export type ColorSpace = (typeof COLOR_SPACES)[number];
export type ColorHarmony = (typeof COLOR_HARMONIES)[number];
export type ColorInput = number | string | Color;

export const COLOR_LIMITS = Object.freeze({ maxColors: 256, maxStops: 32, maxText: 128 });

/** What an unreadable colour reads as: mid grey, visible on any palette and never a throw. */
export const COLOR_FALLBACK = 0x808080;

const HARMONY_TURNS: Readonly<Record<ColorHarmony, readonly number[]>> = {
  analogous: [0, -30, 30],
  complementary: [0, 180],
  triadic: [0, 120, 240],
  split: [0, 150, 210],
  tetradic: [0, 90, 180, 270],
};

const MODES = new Set(['rgb', 'lrgb', 'oklab', 'oklch']);

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** A culori colour, or undefined when the input is not one. */
export function colorOf(input: unknown): Color | undefined {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0 || input > 0xffffffff) return undefined;
    const n = Math.round(input) & 0xffffff;
    return {
      mode: 'rgb',
      r: ((n >> 16) & 255) / 255,
      g: ((n >> 8) & 255) / 255,
      b: (n & 255) / 255,
    };
  }
  if (typeof input === 'string') {
    return input.length <= COLOR_LIMITS.maxText ? parse(input.trim()) : undefined;
  }
  if (input !== null && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    if (typeof record['mode'] !== 'string' || !MODES.has(record['mode'])) return undefined;
    const channels = Object.entries(record).filter(([key]) => key !== 'mode' && key !== 'alpha');
    if (channels.some(([, value]) => value !== undefined && !Number.isFinite(value)))
      return undefined;
    return { ...record } as unknown as Color;
  }
  return undefined;
}

function grey(): Color {
  return { mode: 'rgb', r: 128 / 255, g: 128 / 255, b: 128 / 255 };
}

/** 0xRRGGBB of a colour, its sRGB channels clipped. */
function numberOf(color: Color): number {
  const rgb = toRgb(color);
  const channel = (value: number | undefined) => Math.round(clamp(finite(value, 0), 0, 1) * 255);
  return (channel(rgb.r) << 16) | (channel(rgb.g) << 8) | channel(rgb.b);
}

/** An OKLCH colour into sRGB by lowering its chroma; lightness and hue stay. */
function inGamut(color: Oklch): number {
  return numberOf(clampChroma(color, 'oklch'));
}

function lchOf(color: Color): { l: number; c: number; h: number } {
  const lch = toOklch(color);
  return { l: finite(lch.l, 0), c: Math.max(0, finite(lch.c, 0)), h: finite(lch.h, 0) };
}

function sizeOf(value: unknown, fallback: number): number {
  return clamp(Math.round(finite(value, fallback)), 1, COLOR_LIMITS.maxColors);
}

export function toNumber(input: unknown): number {
  const color = colorOf(input);
  return color === undefined ? COLOR_FALLBACK : numberOf(color);
}

export function toHex(input: unknown): string {
  return `#${toNumber(input).toString(16).padStart(6, '0')}`;
}

/** OKLCH as plain numbers: l 0..1, c 0..0.4, h degrees (0 for a grey). */
export function oklch(input: unknown): { l: number; c: number; h: number } {
  return lchOf(colorOf(input) ?? grey());
}

export interface RampOptions {
  /** 'oklab' (default: straight, no surprise hues) or 'oklch' (keeps chroma; hue the short way). */
  space?: ColorSpace;
}

/**
 * n colours evenly from `a` to `b` — or along a list of stops, `ramp([c0, c1, c2], n, options)`.
 * Unreadable stops are skipped; none readable gives [].
 */
export function ramp(a: unknown, b?: unknown, n?: unknown, options?: RampOptions): number[] {
  const list = Array.isArray(a);
  const stops = (list ? (a as unknown[]) : [a, b]).slice(0, COLOR_LIMITS.maxStops);
  const size = sizeOf(list ? b : n, 5);
  const opts = (list ? n : options) as RampOptions | undefined;
  const colors = stops.map(colorOf).filter((color): color is Color => color !== undefined);
  const first = colors[0];
  if (first === undefined) return [];
  if (colors.length === 1) return Array.from({ length: size }, () => numberOf(first));
  const space: ColorSpace = opts?.space === 'oklch' ? 'oklch' : 'oklab';
  const at = interpolate(colors, space);
  const out: number[] = [];
  for (let i = 0; i < size; i += 1) {
    const color = at(size === 1 ? 0 : i / (size - 1));
    out.push(space === 'oklch' ? inGamut(color as Oklch) : numberOf(color));
  }
  return out;
}

export interface ShadeOptions {
  /** OKLCH lightness of the first (lightest) shade; default 0.95. */
  light?: number;
  /** OKLCH lightness of the last (darkest) shade; default 0.22. */
  dark?: number;
}

/** n shades of one colour, lighter → darker in OKLCH, its hue and (in gamut) its chroma kept. */
export function shades(input: unknown, n?: unknown, options: ShadeOptions = {}): number[] {
  const color = colorOf(input);
  if (color === undefined) return [];
  const size = sizeOf(n, 5);
  const { c, h } = lchOf(color);
  const light = clamp(finite(options.light, 0.95), 0, 1);
  const dark = clamp(finite(options.dark, 0.22), 0, 1);
  return Array.from({ length: size }, (_, i) =>
    inGamut({
      mode: 'oklch',
      l: size === 1 ? light : light + ((dark - light) * i) / (size - 1),
      c,
      h,
    }),
  );
}

/** The colour and its partners around the OKLCH hue wheel, lightness and chroma kept. */
export function harmony(input: unknown, kind?: unknown): number[] {
  const color = colorOf(input);
  if (color === undefined) return [];
  const turns =
    HARMONY_TURNS[
      COLOR_HARMONIES.includes(kind as ColorHarmony) ? (kind as ColorHarmony) : 'analogous'
    ];
  const { l, c, h } = lchOf(color);
  return turns.map((turn) =>
    turn === 0
      ? numberOf(color)
      : inGamut({ mode: 'oklch', l, c, h: (((h + turn) % 360) + 360) % 360 }),
  );
}

/** OKLab mix: t = 0 is a, t = 1 is b. */
export function mix(a: unknown, b: unknown, t?: unknown): number {
  const from = colorOf(a);
  const to = colorOf(b);
  if (from === undefined || to === undefined) return toNumber(from ?? to);
  return numberOf(interpolate([from, to], 'oklab')(clamp(finite(t, 0.5), 0, 1)));
}

/** The WCAG 2 contrast ratio, 1 to 21 (1 when either colour is unreadable). */
export function contrast(a: unknown, b: unknown): number {
  const one = colorOf(a);
  const two = colorOf(b);
  return one === undefined || two === undefined ? 1 : wcagContrast(one, two);
}

export interface AdjustDelta {
  /** Add to OKLCH lightness (0..1 scale): 0.1 is lighter, -0.1 darker. */
  l?: number;
  /** Add to OKLCH chroma (0..0.4 scale): negative mutes. */
  c?: number;
  /** Turn the hue by degrees. */
  h?: number;
}

/** The colour moved in OKLCH by deltas, then into sRGB by chroma. */
export function adjust(input: unknown, delta: unknown = {}): number {
  const color = colorOf(input);
  if (color === undefined) return COLOR_FALLBACK;
  const lch = lchOf(color);
  const d = (delta !== null && typeof delta === 'object' ? delta : {}) as AdjustDelta;
  return inGamut({
    mode: 'oklch',
    l: clamp(lch.l + finite(d.l, 0), 0, 1),
    c: clamp(lch.c + finite(d.c, 0), 0, 0.4),
    h: (((lch.h + finite(d.h, 0)) % 360) + 360) % 360,
  });
}

export interface ReadableOptions {
  /** The ratio to reach; default 4.5 (WCAG AA body text); 3 for large text and marks. */
  min?: number;
}

/**
 * The first candidate that reaches `min` (4.5:1) on `bg`, else the best of them. Without
 * candidates: a near-white and a near-black in bg's own hue, whichever reads better.
 */
export function readable(bg: unknown, candidates?: unknown, options: ReadableOptions = {}): number {
  const back = colorOf(bg) ?? grey();
  const min = clamp(finite(options.min, 4.5), 1, 21);
  let list = (Array.isArray(candidates) ? candidates : [])
    .slice(0, COLOR_LIMITS.maxColors)
    .map(colorOf)
    .filter((color): color is Color => color !== undefined);
  const given = list.length > 0;
  if (!given) {
    const { c, h } = lchOf(back);
    list = [
      { mode: 'oklch', l: 0.98, c: Math.min(c, 0.02), h },
      { mode: 'oklch', l: 0.16, c: Math.min(c, 0.04), h },
    ];
  }
  let best: Color | undefined;
  let bestRatio = 0;
  for (const candidate of list) {
    const ratio = wcagContrast(back, candidate);
    if (given && ratio >= min) return numberOf(candidate);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best === undefined ? COLOR_FALLBACK : numberOf(best);
}
