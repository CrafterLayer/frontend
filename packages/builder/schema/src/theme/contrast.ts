/**
 * Contrast, computed rather than hoped for.
 *
 * ## Why this is arithmetic and not a check
 *
 * The usual way a generator handles contrast is to pick colours, measure them,
 * and retry when a pairing fails. That loop has no upper bound and it fails
 * silently in the worst case: the retry succeeds, the palette drifts toward
 * grey, and every generated site converges on the same safe neutral — which is
 * exactly the "template-identical" failure the specification measures against
 * (SC-004) while satisfying the contrast rule it measures against (SC-009).
 *
 * `luminanceForRatio` inverts the WCAG formula instead. Given a background and
 * a required ratio, it returns the luminance a foreground must have. Solve for
 * it and the pairing cannot fail, so the palette is free to stay saturated and
 * distinctive.
 *
 * Formulae from WCAG 2.2 §1.4.3. Kept here at layer 0 because the planner has
 * to reason about contrast while it chooses, not after.
 */

/** WCAG's minimum for body text. */
export const CONTRAST_NORMAL_TEXT = 4.5;

/** WCAG's minimum for large text — 18.66px bold, or 24px regular. */
export const CONTRAST_LARGE_TEXT = 3;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse `#rgb`, `#rrggbb`, or `#rrggbbaa` into channels.
 *
 * Alpha is deliberately DISCARDED rather than blended. A contrast figure for a
 * translucent colour depends on what is behind it, and returning one computed
 * against an assumed white backdrop would be a number that is wrong in exactly
 * the situations where it matters. Callers that need translucency must
 * composite first.
 */
export function parseHex(hex: string): Rgb | undefined {
  const value = hex.trim().replace(/^#/, '');
  const expanded =
    value.length === 3 || value.length === 4
      ? value
          .slice(0, 3)
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : value.slice(0, 6);

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return undefined;
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16) / 255,
    g: Number.parseInt(expanded.slice(2, 4), 16) / 255,
    b: Number.parseInt(expanded.slice(4, 6), 16) / 255,
  };
}

/** WCAG's per-channel linearisation. */
function linearise(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * The contrast ratio between two colours, 1 to 21.
 *
 * Order-independent by construction: WCAG defines the ratio with the lighter
 * colour on top, and a caller that had to remember which argument was the
 * background would eventually get it backwards.
 */
export function contrastRatio(foreground: string, background: string): number | undefined {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (fg === undefined || bg === undefined) {
    return undefined;
  }

  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastCheck {
  ratio: number;
  passes: boolean;
  required: number;
}

/** Whether a pairing clears the minimum for its text size. */
export function checkContrast(
  foreground: string,
  background: string,
  size: 'normal' | 'large',
): ContrastCheck | undefined {
  const ratio = contrastRatio(foreground, background);
  if (ratio === undefined) {
    return undefined;
  }
  const required = size === 'large' ? CONTRAST_LARGE_TEXT : CONTRAST_NORMAL_TEXT;
  return { ratio, passes: ratio >= required, required };
}

/**
 * The luminance a foreground needs against a known background.
 *
 * This is the inverse of the ratio formula, and it is what lets a palette be
 * built so that it cannot fail rather than tested until it stops failing.
 *
 * Both directions are returned because either can be impossible: against a
 * mid-grey background, no colour is light enough OR dark enough to reach 4.5:1,
 * and a generator that only tried one direction would conclude the background
 * was unusable when the other direction was available. `undefined` means that
 * direction genuinely cannot reach the ratio — luminance is bounded to [0, 1].
 */
export function luminanceForRatio(
  backgroundLuminance: number,
  ratio: number,
): { lighter: number | undefined; darker: number | undefined } {
  const lighter = ratio * (backgroundLuminance + 0.05) - 0.05;
  const darker = (backgroundLuminance + 0.05) / ratio - 0.05;

  return {
    lighter: lighter <= 1 ? lighter : undefined,
    darker: darker >= 0 ? darker : undefined,
  };
}
