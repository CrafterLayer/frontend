/*
  Colour for `s.lib.creatures` (character art, 2026-11-05): a small first-party OKLCH harmony, so
  every palette a seed or a story picks stays pleasant. OKLCH keeps lightness perceptual, so "a
  lighter belly" and "a darker ink" mean the same step on every hue; chroma is pulled back until
  the colour fits sRGB instead of clipping a channel (which is what turns pastels muddy).

  Rules a palette keeps: the belly is lighter and calmer than the body, the accent sits about a
  complementary turn away, and the ink is a dark, low-chroma shade of the body's own hue — never
  pure black, which reads harsh beside soft shading.
*/

/** An OKLCH colour: lightness 0..1, chroma 0..~0.37, hue in degrees. */
export interface Lch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function toLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function toGamma(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** Linear-light sRGB for an OKLCH colour, unclamped (a channel outside 0..1 is out of gamut). */
function linearRgb({ l, c, h }: Lch): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1,
    -1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1,
    -0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1,
  ];
}

const inGamut = (rgb: readonly number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

/** 0xRRGGBB for an OKLCH colour; chroma shrinks (hue and lightness kept) until it fits sRGB. */
export function lchToNumber(input: Lch): number {
  const lch = { l: clamp01(input.l), c: Math.max(0, input.c), h: input.h };
  let rgb = linearRgb(lch);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = lch.c;
    for (let i = 0; i < 14; i += 1) {
      const mid = (lo + hi) / 2;
      if (inGamut(linearRgb({ ...lch, c: mid }))) lo = mid;
      else hi = mid;
    }
    rgb = linearRgb({ ...lch, c: lo });
  }
  const [r, g, b] = rgb.map((v) => Math.round(clamp01(toGamma(clamp01(v))) * 255)) as [
    number,
    number,
    number,
  ];
  return (r << 16) | (g << 8) | b;
}

export function numberToLch(value: number): Lch {
  const r = toLinear(((value >> 16) & 255) / 255);
  const g = toLinear(((value >> 8) & 255) / 255);
  const bl = toLinear((value & 255) / 255);
  const l1 = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
  const m1 = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
  const s1 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
  const l = 0.2104542553 * l1 + 0.793617785 * m1 - 0.0040720468 * s1;
  const a = 1.9779984951 * l1 - 2.428592205 * m1 + 0.4505937099 * s1;
  const b = 0.0259040371 * l1 + 0.7827717662 * m1 - 0.808675766 * s1;
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

export function hex(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, '0')}`;
}

/* Kid-friendly colour words an author (or the agent) may write instead of a hex code. */
const NAMED: Readonly<Record<string, Lch>> = {
  red: { l: 0.66, c: 0.17, h: 25 },
  coral: { l: 0.74, c: 0.13, h: 35 },
  orange: { l: 0.77, c: 0.14, h: 55 },
  gold: { l: 0.84, c: 0.13, h: 85 },
  yellow: { l: 0.9, c: 0.14, h: 98 },
  lime: { l: 0.86, c: 0.15, h: 125 },
  green: { l: 0.75, c: 0.13, h: 145 },
  mint: { l: 0.87, c: 0.08, h: 165 },
  teal: { l: 0.72, c: 0.1, h: 190 },
  aqua: { l: 0.84, c: 0.09, h: 205 },
  sky: { l: 0.82, c: 0.08, h: 235 },
  blue: { l: 0.68, c: 0.13, h: 255 },
  navy: { l: 0.5, c: 0.1, h: 265 },
  purple: { l: 0.62, c: 0.15, h: 305 },
  lilac: { l: 0.8, c: 0.08, h: 310 },
  lavender: { l: 0.84, c: 0.07, h: 295 },
  pink: { l: 0.82, c: 0.1, h: 350 },
  rose: { l: 0.72, c: 0.13, h: 5 },
  brown: { l: 0.6, c: 0.07, h: 55 },
  tan: { l: 0.78, c: 0.06, h: 70 },
  cream: { l: 0.95, c: 0.03, h: 90 },
  white: { l: 0.97, c: 0.01, h: 260 },
  grey: { l: 0.75, c: 0.01, h: 260 },
  gray: { l: 0.75, c: 0.01, h: 260 },
  black: { l: 0.36, c: 0.02, h: 280 },
};

/** A colour an author wrote: 0xRRGGBB, '#rgb', '#rrggbb' or a NAMED word; undefined otherwise. */
export function parseColor(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= 0xffffff ? value : undefined;
  }
  if (typeof value !== 'string' || value.length > 32) return undefined;
  const text = value.trim().toLowerCase();
  const named = NAMED[text];
  if (named !== undefined) return lchToNumber(named);
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/u.exec(text);
  if (short !== null) {
    const [, r = '0', g = '0', b = '0'] = short;
    return Number.parseInt(r + r + g + g + b + b, 16);
  }
  const long = /^#([0-9a-f]{6})$/u.exec(text);
  return long?.[1] === undefined ? undefined : Number.parseInt(long[1], 16);
}

/** The colour `amount` of the way from a to b, mixed in OKLab (perceptually even). */
export function mix(a: number, b: number, amount: number): number {
  const p = numberToLch(a);
  const q = numberToLch(b);
  const t = clamp01(amount);
  const ax = p.c * Math.cos((p.h * Math.PI) / 180);
  const ay = p.c * Math.sin((p.h * Math.PI) / 180);
  const bx = q.c * Math.cos((q.h * Math.PI) / 180);
  const by = q.c * Math.sin((q.h * Math.PI) / 180);
  const x = ax + (bx - ax) * t;
  const y = ay + (by - ay) * t;
  return lchToNumber({
    l: p.l + (q.l - p.l) * t,
    c: Math.hypot(x, y),
    h: (Math.atan2(y, x) * 180) / Math.PI,
  });
}

/** Lighter (dl > 0) or darker; darker shades turn slightly cooler and richer, like real shadow. */
export function shade(value: number, dl: number, dc = 0, dh = 0): number {
  const lch = numberToLch(value);
  const cool = dl < 0 ? lch.h + coolTurn(lch.h) * Math.min(1, -dl * 6) : lch.h;
  return lchToNumber({ l: lch.l + dl, c: Math.max(0, lch.c + dc), h: cool + dh });
}

/* Shadows lean toward blue-violet (h ≈ 280): the turn that gets there the short way, at most 18°. */
function coolTurn(h: number): number {
  const d = ((280 - h + 540) % 360) - 180;
  return Math.max(-18, Math.min(18, d * 0.2));
}

export interface Palette {
  readonly body: number;
  readonly belly: number;
  readonly accent: number;
  readonly eyes: number;
  readonly ink: number;
}

/** The colours the art uses beyond the five an author sets: shading, blush, mouth and tongue. */
export interface Tones extends Palette {
  readonly bodyLight: number;
  readonly bodyShade: number;
  readonly bodyDeep: number;
  readonly bellyShade: number;
  readonly accentLight: number;
  readonly accentShade: number;
  readonly blush: number;
  readonly mouth: number;
  readonly tongue: number;
  readonly pupil: number;
  readonly white: number;
  /** Beaks and bird feet: a warm orange that suits every body colour. */
  readonly warm: number;
}

export function bellyOf(body: number): number {
  const b = numberToLch(body);
  return lchToNumber({ l: Math.min(0.975, Math.max(b.l + 0.13, 0.9)), c: b.c * 0.4, h: b.h + 6 });
}

/**
 * Yellows and yellow-greens (hue ~70-135) only look clean when light: at mid lightness they
 * turn mustard and olive. Such colours are lifted to a clear pastel.
 */
export function unmuddy(lch: Lch): Lch {
  const h = ((lch.h % 360) + 360) % 360;
  if (h < 70 || h > 135 || lch.l >= 0.86) return lch;
  return { l: 0.87, c: Math.min(0.15, Math.max(lch.c, 0.11)), h };
}

export function accentOf(body: number): number {
  const b = numberToLch(body);
  return lchToNumber(
    unmuddy({
      l: Math.max(0.7, Math.min(0.86, b.l + 0.02)),
      c: Math.max(0.1, Math.min(0.15, b.c + 0.02)),
      h: b.h + 160,
    }),
  );
}

export function inkOf(body: number): number {
  const b = numberToLch(body);
  return lchToNumber({ l: 0.3, c: Math.min(0.07, b.c * 0.5 + 0.025), h: b.h + coolTurn(b.h) });
}

/** Every tone the drawing needs, from a palette. */
export function tonesOf(p: Palette): Tones {
  const body = numberToLch(p.body);
  const ink = numberToLch(p.ink);
  return {
    ...p,
    bodyLight: shade(p.body, 0.06, -0.01),
    bodyShade: shade(p.body, -0.1, 0.01),
    bodyDeep: shade(p.body, -0.2, 0),
    bellyShade: shade(p.belly, -0.05, 0.01),
    accentLight: shade(p.accent, 0.08, -0.01),
    accentShade: shade(p.accent, -0.11, 0.01),
    // Blush leans toward the body's warmth but stays pink on cool bodies.
    blush: lchToNumber({ l: 0.74, c: 0.13, h: body.h > 20 && body.h < 80 ? 22 : 8 }),
    mouth: lchToNumber({ l: 0.36, c: 0.11, h: 18 }),
    tongue: lchToNumber({ l: 0.72, c: 0.13, h: 12 }),
    pupil: lchToNumber({ l: Math.min(0.24, ink.l * 0.8), c: ink.c * 0.7, h: ink.h }),
    white: 0xffffff,
    warm: lchToNumber({ l: 0.8, c: 0.13, h: 62 }),
  };
}
