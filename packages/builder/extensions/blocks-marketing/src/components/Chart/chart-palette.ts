import type { ChartProps } from './schema';

/**
 * The marks of one series (or one slice): its SVG fill and stroke, and the
 * legend swatch beside its name.
 *
 * Every class resolves through a theme role — `accent`, `success`,
 * `text-muted`, and `current` (the section's own ink, so a chart on a dark
 * section never draws dark on dark) — with opacity steps for lightness. A
 * document stores the palette's NAME; the theme decides the colours, and no
 * hex value exists anywhere in a chart.
 *
 * Order is fixed and never cycled: adjacent slots alternate a hue with a
 * neutral and step their lightness, so neighbouring series stay apart. Six
 * slots serve the series cap; slots seven and eight exist for pie slices,
 * past which the smallest slices fold into one "other" slice.
 */
export interface SeriesTone {
  readonly fill: string;
  readonly stroke: string;
  readonly swatch: string;
}

/* Written out in full: Tailwind finds a class only where it appears literally. */
const ACCENT: SeriesTone = { fill: 'fill-accent', stroke: 'stroke-accent', swatch: 'bg-accent' };
const ACCENT_55: SeriesTone = {
  fill: 'fill-accent/55',
  stroke: 'stroke-accent/55',
  swatch: 'bg-accent/55',
};
const ACCENT_30: SeriesTone = {
  fill: 'fill-accent/30',
  stroke: 'stroke-accent/30',
  swatch: 'bg-accent/30',
};
const SUCCESS: SeriesTone = {
  fill: 'fill-success',
  stroke: 'stroke-success',
  swatch: 'bg-success',
};
const SUCCESS_55: SeriesTone = {
  fill: 'fill-success/55',
  stroke: 'stroke-success/55',
  swatch: 'bg-success/55',
};
const SUCCESS_30: SeriesTone = {
  fill: 'fill-success/30',
  stroke: 'stroke-success/30',
  swatch: 'bg-success/30',
};
const MUTED: SeriesTone = {
  fill: 'fill-text-muted',
  stroke: 'stroke-text-muted',
  swatch: 'bg-text-muted',
};
const MUTED_45: SeriesTone = {
  fill: 'fill-text-muted/45',
  stroke: 'stroke-text-muted/45',
  swatch: 'bg-text-muted/45',
};
const INK: SeriesTone = { fill: 'fill-current', stroke: 'stroke-current', swatch: 'bg-current' };
const INK_50: SeriesTone = {
  fill: 'fill-current/50',
  stroke: 'stroke-current/50',
  swatch: 'bg-current/50',
};
const INK_25: SeriesTone = {
  fill: 'fill-current/25',
  stroke: 'stroke-current/25',
  swatch: 'bg-current/25',
};

export const CHART_TONES: Readonly<Record<ChartProps['palette'], readonly SeriesTone[]>> = {
  accent: [ACCENT, MUTED, ACCENT_55, INK, ACCENT_30, MUTED_45, SUCCESS, SUCCESS_55],
  mixed: [ACCENT, SUCCESS, MUTED, ACCENT_55, SUCCESS_55, INK, ACCENT_30, SUCCESS_30],
  mono: [INK, MUTED, INK_50, MUTED_45, INK_25, ACCENT, ACCENT_55, ACCENT_30],
  success: [SUCCESS, MUTED, SUCCESS_55, INK, SUCCESS_30, MUTED_45, ACCENT, ACCENT_55],
};

/** The most slices a pie draws before folding the rest into "other". */
export const MAX_PIE_SLICES = CHART_TONES.accent.length;

/** The tone of slot `index` in `palette`; the last slot repeats past the end. */
export function toneOf(palette: ChartProps['palette'], index: number): SeriesTone {
  const tones = CHART_TONES[palette];
  return tones[Math.min(Math.max(index, 0), tones.length - 1)] ?? ACCENT;
}

/**
 * Whether a tone is a translucent step of a fixed theme hue (`accent/55`).
 * Over a light card it is a tint; over a dark ground it would be a murky
 * shade, so the chart lays the surface under it first and the tone reads the
 * same on any ground. An ink step (`current/50`) is left alone: it is made
 * from the section's own text colour precisely so that it blends with the
 * ground it sits on.
 */
export function isTranslucent(tone: SeriesTone): boolean {
  return tone.fill.includes('/') && !tone.fill.startsWith('fill-current');
}

/**
 * The ring around a marker and the gap between pie slices: the ground the
 * chart sits on. A card is always `surface`; a plain chart on a dark section
 * sits on the inverse surface.
 */
export function groundStroke(variant: ChartProps['variant'], tone: ChartProps['tone']): string {
  return variant === 'plain' && tone === 'dark' ? 'stroke-surface-inverse' : 'stroke-surface';
}
