import { clampChroma, formatHex, formatHex8, oklch, parse, wcagContrast } from 'culori';

import type { StyleValue } from '@craftkit/builder-schema';

/** A colour a person can pick: a theme token or a site palette entry, with its swatch. */
export interface ColorSwatch {
  /** `accent` for a token, the palette id for a palette colour. */
  readonly id: string;
  readonly name: string;
  /** Resolved CSS colour, for the swatch and the contrast check only. */
  readonly css: string;
}

/** WCAG AA for body text. */
export const MIN_CONTRAST = 4.5;

const NAMED: Readonly<Record<string, string>> = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

/** `accent/80` → { base: 'accent', opacity: 80 }. */
export function splitOpacity(token: string): { readonly base: string; readonly opacity?: number } {
  const slash = token.lastIndexOf('/');
  if (slash === -1) return { base: token };
  const opacity = Number(token.slice(slash + 1));
  return Number.isFinite(opacity) ? { base: token.slice(0, slash), opacity } : { base: token };
}

/** The CSS colour a stored value paints, when it can be known in the panel. */
export function resolveColor(
  value: StyleValue | undefined,
  tokens: readonly ColorSwatch[],
  palette: readonly ColorSwatch[],
): string | undefined {
  if (value === undefined) return undefined;
  switch (value.kind) {
    case 'token': {
      const { base } = splitOpacity(value.token);
      return tokens.find((swatch) => swatch.id === base)?.css ?? NAMED[base];
    }
    case 'palette':
      return palette.find((swatch) => swatch.id === value.id)?.css;
    case 'raw':
      return value.css;
    case 'keyword':
      return NAMED[value.keyword];
  }
}

/** The contrast ratio of two CSS colours, or undefined when either cannot be parsed. */
export function contrastOf(a: string | undefined, b: string | undefined): number | undefined {
  if (a === undefined || b === undefined) return undefined;
  const first = parse(a);
  const second = parse(b);
  if (first === undefined || second === undefined) return undefined;
  if ((first.alpha ?? 1) < 1 || (second.alpha ?? 1) < 1) return undefined;
  return wcagContrast(first, second);
}

/**
 * The nearest colour to `color` (same hue and chroma in OKLCH) that reaches
 * `target` contrast against `background`: lightness moves away from the
 * background until it does. Undefined when even black/white cannot.
 */
export function accessibleColor(
  color: string,
  background: string,
  target = MIN_CONTRAST,
): string | undefined {
  const parsed = parse(color);
  const ground = parse(background);
  if (parsed === undefined || ground === undefined) return undefined;
  const start = oklch(parsed);
  const groundLightness = oklch(ground).l;
  const direction = groundLightness > 0.5 ? -1 : 1;
  for (let step = 0; step <= 100; step += 1) {
    const l = Math.min(1, Math.max(0, start.l + direction * step * 0.01));
    const candidate = clampChroma({ ...start, l, alpha: 1 }, 'oklch');
    if (wcagContrast(candidate, ground) >= target + 0.05) return formatHex(candidate);
    if (l === 0 || l === 1) break;
  }
  return undefined;
}

/** The token with the best contrast against `background` that reaches the target. */
export function accessibleToken(
  tokens: readonly ColorSwatch[],
  background: string,
  target = MIN_CONTRAST,
): string | undefined {
  let best: { id: string; ratio: number } | undefined;
  for (const swatch of tokens) {
    const ratio = contrastOf(swatch.css, background);
    if (ratio === undefined || ratio < target) continue;
    if (best === undefined || ratio > best.ratio) best = { id: swatch.id, ratio };
  }
  return best?.id;
}

/** A picker's hex, normalised for writing (`#rrggbb`, or `#rrggbbaa` when not opaque). */
export function normalizeHex(hex: string): string | undefined {
  const parsed = parse(hex);
  if (parsed === undefined) return undefined;
  return (parsed.alpha ?? 1) < 1 ? formatHex8(parsed) : formatHex(parsed);
}
