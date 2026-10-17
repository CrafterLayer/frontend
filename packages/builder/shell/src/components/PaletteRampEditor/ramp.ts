import { clampChroma, formatHex, oklch, parse, wcagContrast } from 'culori';

import { LIBRARY_ID_PATTERN, type PaletteColor } from '@craftkit/builder-schema';

/*
  ── One brand colour → a 50–950 ramp (style-manager DESIGN.md §C.5, §G) ─────

  Generated in OKLCH because its lightness is perceptual: equal steps LOOK
  equal, which HSL's do not (an HSL yellow at 50% is far brighter than an HSL
  blue at 50%). The curve is Tailwind v4's lightness ladder, bent so the brand
  colour lands EXACTLY on its nearest step — a person who typed their brand
  colour expects to find it in the ramp, not a neighbour of it.

  Chroma follows a bell: pale and deep ends carry less colour, as every
  hand-tuned palette does, and each shade is clamped into sRGB so the swatch,
  the contrast figure and the published page agree on what is shown.
*/

export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type RampStep = (typeof RAMP_STEPS)[number];

/** Tailwind v4's blue lightness ladder (OKLCH L, 0–1). */
const TARGET_LIGHTNESS = [0.97, 0.932, 0.882, 0.809, 0.707, 0.623, 0.546, 0.488, 0.424, 0.379, 0.282];
/** Relative chroma per step: low at the ends, full in the middle. */
const CHROMA_SHAPE = [0.16, 0.3, 0.52, 0.76, 0.93, 1, 0.98, 0.9, 0.78, 0.64, 0.48];

export interface RampShade {
  readonly step: RampStep;
  /** `oklch(…)`, gamut-clamped to sRGB. */
  readonly value: string;
  /** The same colour as hex, for swatches and contrast. */
  readonly hex: string;
  /** True on the step the brand colour itself landed on. */
  readonly anchor: boolean;
}

function round(value: number, digits: number): string {
  return Number(value.toFixed(digits)).toString();
}

function formatOklch(l: number, c: number, h: number): string {
  return `oklch(${round(l * 100, 1)}% ${round(c, 3)} ${round(h, 1)})`;
}

/**
 * The 11 shades of `color` (any CSS colour culori parses), or undefined when
 * it is not a colour. Lightness strictly falls from 50 to 950.
 */
export function generateRamp(color: string): readonly RampShade[] | undefined {
  const parsed = parse(color.trim());
  if (parsed === undefined) return undefined;
  const base = oklch(parsed);
  const baseL = Math.min(0.99, Math.max(0.01, base.l));
  const baseC = Number.isFinite(base.c) ? base.c : 0;
  const hue = Number.isFinite(base.h) ? (base.h ?? 0) : 0;

  let anchor = 0;
  TARGET_LIGHTNESS.forEach((target, index) => {
    if (Math.abs(target - baseL) < Math.abs((TARGET_LIGHTNESS[anchor] ?? 0) - baseL)) anchor = index;
  });
  const delta = baseL - (TARGET_LIGHTNESS[anchor] ?? baseL);
  const anchorShape = CHROMA_SHAPE[anchor] ?? 1;

  const shades: RampShade[] = [];
  let previous = 1;
  RAMP_STEPS.forEach((step, index) => {
    const isAnchor = index === anchor;
    const weight = 1 - Math.abs(index - anchor) / RAMP_STEPS.length;
    let l = isAnchor ? baseL : (TARGET_LIGHTNESS[index] ?? baseL) + delta * weight;
    /* Strictly darker than the step before, and never past the ends. */
    l = Math.min(l, previous - 0.012, 0.985);
    l = Math.max(l, 0.08 + (RAMP_STEPS.length - index) * 0.004);
    previous = l;
    const c = isAnchor ? baseC : (baseC * (CHROMA_SHAPE[index] ?? 1)) / anchorShape;
    const clamped = clampChroma({ mode: 'oklch', l, c, h: hue }, 'oklch');
    const finalC = Number.isFinite(clamped.c) ? clamped.c : 0;
    shades.push({
      step,
      value: formatOklch(l, finalC, hue),
      hex: formatHex({ mode: 'oklch', l, c: finalC, h: hue }),
      anchor: isAnchor,
    });
  });
  return shades;
}

/** A palette-id-safe slug of a person's colour name ("Brand Teal" → "brand-teal"). */
export function paletteSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 40)
    .replace(/-+$/u, '');
  if (slug === '') return 'colour';
  const lettered = /^[a-z]/u.test(slug) ? slug : `c-${slug}`;
  return LIBRARY_ID_PATTERN.test(lettered) ? lettered : 'colour';
}

/** The ramp as palette entries: ids `<slug>-50` … `<slug>-950`, grouped under the name. */
export function rampPaletteColors(name: string, shades: readonly RampShade[]): PaletteColor[] {
  const slug = paletteSlug(name);
  const display = name.trim() === '' ? slug : name.trim().slice(0, 60);
  return shades.map((shade) => ({
    id: `${slug}-${String(shade.step)}`,
    name: `${display} ${String(shade.step)}`,
    value: shade.value,
    group: display.slice(0, 40),
  }));
}

export type ContrastGrade = 'AAA' | 'AA' | 'AA large' | 'fail';

/** WCAG 2 grade of a ratio for text. */
export function contrastGrade(ratio: number): ContrastGrade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA large';
  return 'fail';
}

export interface ContrastColumn {
  readonly name: string;
  readonly css: string;
}

/** WCAG contrast of every shade against every column, or undefined for an unparsable column. */
export function contrastMatrix(
  shades: readonly RampShade[],
  columns: readonly ContrastColumn[],
): readonly (readonly (number | undefined)[])[] {
  return shades.map((shade) =>
    columns.map((column) => {
      const ground = parse(column.css);
      return ground === undefined ? undefined : wcagContrast(shade.hex, ground);
    }),
  );
}
