import {
  adjust,
  COLOR_FALLBACK,
  COLOR_HARMONIES,
  COLOR_LIMITS,
  COLOR_SPACES,
  contrast,
  harmony,
  mix,
  oklch,
  ramp,
  readable,
  shades,
  toHex,
  toNumber,
  type AdjustDelta,
  type RampOptions,
  type ReadableOptions,
  type ShadeOptions,
} from './color/color';

export const COLOR_VERSION = '1.0.0';

/**
 * `s.lib.color` (mural libraries 2, 2026-10-13): perceptual colour that keeps a mural in the
 * page's palette — OKLab / OKLCH ramps, shades, hue harmonies, mixes, WCAG contrast and a
 * readable pick — on culori 4.0.2 (MIT; `culori/fn` only). Colours in are 0xRRGGBB numbers
 * (s.palette's), CSS strings or culori objects; colours out are 0xRRGGBB numbers for Pixi. Plain
 * JavaScript: it never imports Pixi and holds nothing to dispose.
 */
export function createColorLibrary() {
  return Object.freeze({
    version: COLOR_VERSION,
    limits: COLOR_LIMITS,
    spaces: COLOR_SPACES,
    harmonies: COLOR_HARMONIES,
    fallback: COLOR_FALLBACK,
    ramp: (a: unknown, b?: unknown, n?: unknown, options?: RampOptions) => ramp(a, b, n, options),
    shades: (color: unknown, n?: unknown, options?: ShadeOptions) => shades(color, n, options),
    harmony: (color: unknown, kind?: unknown) => harmony(color, kind),
    mix: (a: unknown, b: unknown, t?: unknown) => mix(a, b, t),
    contrast: (a: unknown, b: unknown) => contrast(a, b),
    readable: (bg: unknown, candidates?: unknown, options?: ReadableOptions) =>
      readable(bg, candidates, options),
    adjust: (color: unknown, delta?: AdjustDelta) => adjust(color, delta),
    oklch: (color: unknown) => oklch(color),
    toHex: (color: unknown) => toHex(color),
    toNumber: (color: unknown) => toNumber(color),
  });
}
