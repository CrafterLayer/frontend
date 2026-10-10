/*
  The scene palette (pixi-studio §B.2: s.palette), mixed in OKLab.

  Roles come from the page's theme tokens, site token first and chrome token second, through the
  SAME `PALETTE_TOKENS` table the canvas scenes use (../../palette.ts), so a scene script and a
  built-in scene agree on colours. `params.palette` overrides: 'theme' (the tokens) or an array
  of '#hex' strings.

  OKLab conversion follows Björn Ottosson's published formulas ("A perceptual color space for
  image processing", 2020); this is our own implementation (DESIGN D3: no culori duplicate).
*/

import { PALETTE_DEFAULTS, PALETTE_TOKENS, luminance, parseColor } from '../../palette';

export interface Oklab {
  L: number;
  a: number;
  b: number;
}

export interface ScenePaletteApi {
  /** 5 x 0xRRGGBB: accent, accent-2 (lighter), text, muted, accent-3 (darker). */
  colors: number[];
  accent: number;
  text: number;
  muted: number;
  surface: number;
  /** The surface is dark (luminance below 0.4). */
  dark: boolean;
  /** '#rrggbb' of colors[i] (wraps around). */
  hex(index: number): string;
  /** OKLab mix of two 0xRRGGBB colours, t in [0, 1]. */
  mix(a: number, b: number, t: number): number;
  /** n colours evenly along colors[] in OKLab (n >= 1). */
  ramp(n: number): number[];
}

export type PaletteRoles = Partial<Record<keyof typeof PALETTE_DEFAULTS, number>>;

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
  const v = value <= 0.003_130_8 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

export function rgbToOklab(color: number): Oklab {
  const r = toLinear((color >> 16) & 0xff);
  const g = toLinear((color >> 8) & 0xff);
  const b = toLinear(color & 0xff);
  const l = Math.cbrt(0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b);
  const m = Math.cbrt(0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b);
  const s = Math.cbrt(0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b);
  return {
    L: 0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
    a: 1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
    b: 0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
  };
}

export function oklabToRgb(lab: Oklab): number {
  const l = (lab.L + 0.396_337_777_4 * lab.a + 0.215_803_757_3 * lab.b) ** 3;
  const m = (lab.L - 0.105_561_345_8 * lab.a - 0.063_854_172_8 * lab.b) ** 3;
  const s = (lab.L - 0.089_484_177_5 * lab.a - 1.291_485_548 * lab.b) ** 3;
  const r = fromLinear(4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s);
  const g = fromLinear(-1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s);
  const b = fromLinear(-0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s);
  return (r << 16) | (g << 8) | b;
}

/** Perceptual mix: t = 0 is a, t = 1 is b. */
export function mixOklab(a: number, b: number, t: number): number {
  const amount = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const from = rgbToOklab(a);
  const to = rgbToOklab(b);
  return oklabToRgb({
    L: from.L + (to.L - from.L) * amount,
    a: from.a + (to.a - from.a) * amount,
    b: from.b + (to.b - from.b) * amount,
  });
}

/** Shift lightness in OKLab (positive = lighter), keeping hue and chroma. */
export function shiftLightness(color: number, delta: number): number {
  const lab = rgbToOklab(color);
  return oklabToRgb({ ...lab, L: Math.max(0, Math.min(1, lab.L + delta)) });
}

/** n colours evenly spaced along `stops` (OKLab, piecewise). */
export function rampOklab(stops: readonly number[], n: number): number[] {
  const size = Math.max(1, Math.floor(n));
  if (stops.length === 0) return Array.from({ length: size }, () => 0);
  if (stops.length === 1 || size === 1) return Array.from({ length: size }, () => stops[0] as number);
  const out: number[] = [];
  for (let index = 0; index < size; index += 1) {
    const position = (index / (size - 1)) * (stops.length - 1);
    const left = Math.min(stops.length - 2, Math.floor(position));
    out.push(mixOklab(stops[left] as number, stops[left + 1] as number, position - left));
  }
  return out;
}

export function toHex(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** Parse a params.palette override: an array of '#hex' (1..12) or anything else = theme. */
export function paletteOverride(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const colors: number[] = [];
  for (const item of value.slice(0, 12)) {
    if (typeof item !== 'string' || !/^#[0-9a-f]{3,8}$/iu.test(item.trim())) continue;
    const parsed = parseColor(item);
    if (parsed !== undefined) colors.push(parsed);
  }
  return colors.length > 0 ? colors : undefined;
}

/** Build the scene palette from resolved roles plus an optional override (pure). */
export function buildScenePalette(roles: PaletteRoles, override?: readonly number[]): ScenePaletteApi {
  const accent = roles.accent ?? PALETTE_DEFAULTS.accent;
  const text = roles.text ?? PALETTE_DEFAULTS.text;
  const surface = roles.surface ?? PALETTE_DEFAULTS.surface;
  const muted = roles.muted ?? mixOklab(text, surface, 0.45);
  const dark = luminance(surface) < 0.4;

  let colors: number[];
  if (override !== undefined && override.length > 0) {
    colors = override.length >= 5 ? override.slice(0, 5) : rampOklab(override, 5);
    if (override.length < 5 && override.length > 1) {
      // Keep the given colours exactly at their own slots' ends; the ramp fills between them.
      colors[0] = override[0] as number;
      colors[4] = override[override.length - 1] as number;
    }
  } else {
    colors = [accent, shiftLightness(accent, 0.14), text, muted, shiftLightness(accent, -0.16)];
  }
  const first = colors[0] as number;
  return {
    colors,
    accent: override !== undefined && override.length > 0 ? first : accent,
    text,
    muted,
    surface,
    dark,
    hex(index: number): string {
      const size = colors.length;
      const slot = ((Math.floor(index) % size) + size) % size;
      return toHex(colors[slot] as number);
    },
    mix: mixOklab,
    ramp(n: number): number[] {
      return rampOklab(colors, n);
    },
  };
}

function normaliseWithCanvas(doc: Document, value: string): number | undefined {
  try {
    const context = doc.createElement('canvas').getContext('2d');
    if (context === null) return undefined;
    context.fillStyle = '#000001';
    context.fillStyle = value;
    const normalised = typeof context.fillStyle === 'string' ? context.fillStyle : '';
    return normalised === '#000001' ? undefined : parseColor(normalised);
  } catch {
    return undefined;
  }
}

/** Read the role colours from the element's computed `--t-*` then `--bldr-*` tokens. */
export function readPaletteRoles(el: Element): PaletteRoles {
  const roles: PaletteRoles = {};
  const doc = el.ownerDocument;
  const view = doc.defaultView;
  if (view === null) return roles;
  let style: CSSStyleDeclaration;
  try {
    style = view.getComputedStyle(el);
  } catch {
    return roles;
  }
  for (const role of Object.keys(PALETTE_TOKENS) as (keyof typeof PALETTE_TOKENS)[]) {
    for (const name of PALETTE_TOKENS[role]) {
      const raw = style.getPropertyValue(name).trim();
      if (raw === '') continue;
      const parsed = parseColor(raw) ?? normaliseWithCanvas(doc, raw);
      if (parsed !== undefined) {
        roles[role] = parsed;
        break;
      }
    }
  }
  return roles;
}
