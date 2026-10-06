/*
  A small, local OKLCH helper for palette ramps (style-manager DESIGN.md §C.5).

  The shell owns culori for the colour picker; the ai package (layer 2) does
  not depend on it, and a ramp needs only three things: read a colour, move
  its lightness in OKLCH, and bring the result back inside sRGB. The matrices
  are Björn Ottosson's published OKLab definition (public domain, 2020) and
  the sRGB transfer function from IEC 61966-2-1 — no code was copied.

  Ramp steps follow Tailwind 4's palette shape: lightness falls from ~97% at
  50 to ~27% at 950, chroma swells toward the middle and thins at both ends,
  and the hue is held. Each shade is gamut-mapped by lowering chroma (never
  lightness or hue) until it fits sRGB, then written as hex — the value every
  export target and every contrast check reads.
*/

export interface Oklch {
  /** 0–1 */
  readonly l: number;
  readonly c: number;
  /** degrees, 0–360 */
  readonly h: number;
}

type Rgb = readonly [number, number, number];

const toLinear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
const fromLinear = (channel: number): number =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;

function srgbToOklch([r, g, b]: Rgb): Oklch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: hue < 0 ? hue + 360 : hue };
}

/** Linear-light sRGB (may fall outside 0–1 when the colour is out of gamut). */
function oklchToLinearSrgb({ l: L, c, h }: Oklch): Rgb {
  const radians = (h * Math.PI) / 180;
  const A = c * Math.cos(radians);
  const B = c * Math.sin(radians);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const EPSILON = 0.0005;

function inGamut(linear: Rgb): boolean {
  return linear.every((channel) => channel >= -EPSILON && channel <= 1 + EPSILON);
}

/** Lower chroma until the colour fits sRGB (binary search, 20 steps ≈ 1e-6). */
export function clampToSrgb(colour: Oklch): Oklch {
  if (inGamut(oklchToLinearSrgb(colour))) return colour;
  let low = 0;
  let high = colour.c;
  for (let step = 0; step < 20; step += 1) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToLinearSrgb({ ...colour, c: mid }))) low = mid;
    else high = mid;
  }
  return { ...colour, c: low };
}

const hex2 = (channel: number): string =>
  Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, '0');

/** An in-gamut OKLCH colour as `#rrggbb`. */
export function oklchToHex(colour: Oklch): string {
  const linear = oklchToLinearSrgb(clampToSrgb(colour));
  return `#${linear.map((channel) => hex2(fromLinear(channel))).join('')}`;
}

function parseHex(text: string): Rgb | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{1,2})?$/iu.exec(text);
  const digits = match?.[1];
  if (digits === undefined) return undefined;
  const full = digits.length === 3 ? digits.replace(/[0-9a-f]/giu, (digit) => digit + digit) : digits;
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) / 255) as unknown as Rgb;
}

function number(text: string | undefined, percentScale: number): number | undefined {
  if (text === undefined) return undefined;
  const value = parseFloat(text);
  if (!Number.isFinite(value)) return undefined;
  return text.endsWith('%') ? (value / 100) * percentScale : value;
}

/** Read `#rgb`, `#rrggbb` (alpha ignored), `rgb(r g b)` / `rgb(r,g,b)` or `oklch(L C H)`. */
export function parseColour(text: string): Oklch | undefined {
  const value = text.trim().toLowerCase();
  const hex = parseHex(value);
  if (hex !== undefined) return srgbToOklch(hex);
  const fn = /^(rgba?|oklch)\(\s*([^()]*)\)$/u.exec(value);
  if (fn === null) return undefined;
  const parts = (fn[2] ?? '').split(/[\s,/]+/u).filter((part) => part !== '');
  if (fn[1] === 'oklch') {
    const l = number(parts[0], 1);
    const c = number(parts[1], 0.4);
    const h = number(parts[2]?.replace(/deg$/u, ''), 360);
    if (l === undefined || c === undefined || h === undefined) return undefined;
    return { l: l > 1 ? l / 100 : l, c, h: ((h % 360) + 360) % 360 };
  }
  const channels = parts.slice(0, 3).map((part) => number(part, 255));
  if (channels.length !== 3 || channels.some((channel) => channel === undefined)) return undefined;
  return srgbToOklch(channels.map((channel) => (channel ?? 0) / 255) as unknown as Rgb);
}

/** The eleven shade steps, Tailwind-shaped. */
export const RAMP_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;
export type RampStep = (typeof RAMP_STEPS)[number];

const LIGHTNESS: Readonly<Record<RampStep, number>> = {
  '50': 0.971,
  '100': 0.936,
  '200': 0.885,
  '300': 0.808,
  '400': 0.704,
  '500': 0.623,
  '600': 0.546,
  '700': 0.469,
  '800': 0.397,
  '900': 0.336,
  '950': 0.266,
};

/** Chroma relative to the base colour's: thin at the light end, full through the middle. */
const CHROMA: Readonly<Record<RampStep, number>> = {
  '50': 0.12,
  '100': 0.25,
  '200': 0.45,
  '300': 0.7,
  '400': 0.9,
  '500': 1,
  '600': 1,
  '700': 0.92,
  '800': 0.8,
  '900': 0.66,
  '950': 0.5,
};

/** 50–950 shades of one colour as hex, keyed by step; undefined when the colour is unreadable. */
export function oklchRamp(base: string): Readonly<Record<RampStep, string>> | undefined {
  const colour = parseColour(base);
  if (colour === undefined) return undefined;
  /* A near-grey keeps its hue meaningless: hold chroma tiny rather than amplify noise. */
  const chroma = colour.c < 0.02 ? colour.c : Math.max(colour.c, 0.08);
  const out = {} as Record<RampStep, string>;
  for (const step of RAMP_STEPS) {
    out[step] = oklchToHex({ l: LIGHTNESS[step], c: chroma * CHROMA[step], h: colour.h });
  }
  return out;
}
