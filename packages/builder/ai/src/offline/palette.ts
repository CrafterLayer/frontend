import {
  CONTRAST_LARGE_TEXT,
  CONTRAST_NORMAL_TEXT,
  contrastRatio,
  luminanceForRatio,
  parseHex,
  relativeLuminance,
} from '@craftkit/builder-schema';

/**
 * Colour construction that cannot fail its contrast requirement.
 *
 * ## The loop this avoids
 *
 * The usual generator picks colours, measures the pairings, and retries the
 * ones that fail. That loop has no upper bound, and its successes are worse
 * than its failures: every retry nudges the palette toward grey, so a hundred
 * sites converge on the same safe neutral. The specification measures both
 * distinctiveness (SC-004) and contrast (SC-009), and retry-until-green
 * satisfies the second by destroying the first.
 *
 * Here the ratio is an INPUT. `solveLightness` walks lightness until the
 * required luminance is reached, so the hue and saturation stay wherever the
 * brief put them and only the lightness moves. A saturated brand colour stays
 * saturated and still reads.
 */

/** A colour as the generator thinks about it: hue, saturation, lightness. */
export interface Hsl {
  /** 0–360. */
  h: number;
  /** 0–100. */
  s: number;
  /** 0–100. */
  l: number;
}

function hslToRgb({ h, s, l }: Hsl): { r: number; g: number; b: number } {
  const saturation = s / 100;
  const lightness = l / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = lightness - c / 2;

  const [r, g, b] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];

  return { r: r + m, g: g + m, b: b + m };
}

function channelToHex(channel: number): string {
  const value = Math.round(Math.min(1, Math.max(0, channel)) * 255);
  return value.toString(16).padStart(2, '0');
}

export function hslToHex(hsl: Hsl): string {
  const { r, g, b } = hslToRgb(hsl);
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

/** The luminance a colour would have at a given lightness, hue and saturation held. */
function luminanceAt(hue: number, saturation: number, lightness: number): number {
  return relativeLuminance(hslToRgb({ h: hue, s: saturation, l: lightness }));
}

/**
 * The lightness at which this hue reaches a target luminance.
 *
 * A binary search rather than an inversion, because luminance is monotonic in
 * lightness for a fixed hue and saturation but has no closed form through the
 * HSL transform. Fifty steps resolve lightness to well under a tenth of a
 * percent, which is far finer than an eight-bit channel can express — so the
 * result is exact for every colour that can actually be written down.
 */
function solveLightness(hue: number, saturation: number, targetLuminance: number): number {
  let low = 0;
  let high = 100;
  for (let step = 0; step < 50; step += 1) {
    const mid = (low + high) / 2;
    if (luminanceAt(hue, saturation, mid) < targetLuminance) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

/**
 * A colour of this hue that is guaranteed to read against `background`.
 *
 * Returns `undefined` only when the requirement is genuinely unreachable — a
 * caller that gets one has asked for something the background cannot support,
 * and inventing a near-match would be the silent failure this module exists to
 * prevent.
 */
export function readableAgainst(
  hue: number,
  saturation: number,
  background: string,
  ratio: number,
): string | undefined {
  const bg = parseHex(background);
  if (bg === undefined) {
    return undefined;
  }

  const backgroundLuminance = relativeLuminance(bg);
  const { lighter, darker } = luminanceForRatio(backgroundLuminance, ratio);

  /*
    Darker first. Against the pale surfaces most pages use, dark text is what a
    reader expects, and trying lighter first would produce technically-passing
    pale-on-pale that everyone finds unpleasant.
  */
  const target = darker ?? lighter;
  if (target === undefined) {
    return undefined;
  }

  /*
    A hue cannot always reach a luminance at a given saturation — a saturated
    yellow cannot be dark, a saturated blue cannot be bright. Saturation is
    relaxed toward grey only as far as the target requires, so the colour keeps
    as much of its character as the requirement leaves it.
  */
  const goDarker = darker !== undefined;

  for (const candidateSaturation of [saturation, saturation * 0.75, saturation * 0.5, 0]) {
    const atBlack = luminanceAt(hue, candidateSaturation, 0);
    const atWhite = luminanceAt(hue, candidateSaturation, 100);
    if (target < atBlack || target > atWhite) {
      continue;
    }

    const solved = solveLightness(hue, candidateSaturation, target);

    /*
      Verify against the QUANTISED colour, not the solved one.

      The search is exact in continuous space, but a hex channel is eight bits:
      rounding to `#rrggbb` moves the luminance slightly, and the direction is
      not predictable. Measured here at hue 50, the solved answer emitted a
      colour at 4.4985 against a 4.5 requirement — passing arithmetic, failing
      contrast. So the emitted value is measured and nudged until the COLOUR
      clears the ratio, which is the only claim that matters.

      The step is a fifth of a percent and the loop is bounded at forty, so it
      can move eight points of lightness — far more than rounding can cost, and
      it cannot run away.
    */
    const step = goDarker ? -0.2 : 0.2;
    for (let attempt = 0; attempt <= 40; attempt += 1) {
      const lightness = Math.min(100, Math.max(0, solved + step * attempt));
      const candidate = hslToHex({ h: hue, s: candidateSaturation, l: lightness });
      const achieved = contrastRatio(candidate, background);
      if (achieved !== undefined && achieved >= ratio) {
        return candidate;
      }
    }
  }

  return undefined;
}

/** The nine colour roles a page theme assigns. */
export interface GeneratedPalette {
  surface: string;
  surfaceInverse: string;
  text: string;
  textInverse: string;
  textMuted: string;
  accent: string;
  accentText: string;
  success: string;
  successText: string;
}

/**
 * Build a complete, contrast-safe palette from one hue.
 *
 * ## The detail that stops it looking generated
 *
 * `surface` is not white. It is the accent hue at 97% lightness and a trace of
 * saturation — a warm off-white for a roastery, a cool one for a clinic. The
 * difference is a few percent and it is most of why a hand-designed page reads
 * as considered while a generated one reads as a default stylesheet. Pure
 * `#ffffff` is the single most recognisable tell of a template.
 */
export function buildPalette(hue: number, saturation: number): GeneratedPalette | undefined {
  const surface = hslToHex({ h: hue, s: Math.min(saturation, 18), l: 97 });
  const surfaceInverse = hslToHex({ h: hue, s: Math.min(saturation, 30), l: 12 });

  /*
    Body text is held to 7:1 rather than the 4.5:1 minimum. The minimum is the
    line below which text is a failure, not the level at which it is
    comfortable, and a generated page that sits exactly on the line reads as
    thin on every screen that is not a good one.
  */
  const text = readableAgainst(hue, Math.min(saturation, 25), surface, 7);
  const textInverse = readableAgainst(hue, Math.min(saturation, 12), surfaceInverse, 7);
  const textMuted = readableAgainst(hue, Math.min(saturation, 20), surface, CONTRAST_NORMAL_TEXT);
  const accent = readableAgainst(hue, saturation, surface, CONTRAST_NORMAL_TEXT);

  if (
    text === undefined ||
    textInverse === undefined ||
    textMuted === undefined ||
    accent === undefined
  ) {
    return undefined;
  }

  const accentText = readableAgainst(hue, 8, accent, CONTRAST_LARGE_TEXT);
  /*
    Success is green because a page saying "saved" in the brand's own hue says
    nothing. Its hue is fixed and only its lightness is solved, so it reads on
    this surface without competing with the accent.
  */
  const success = readableAgainst(152, 45, surface, CONTRAST_NORMAL_TEXT);
  const successText =
    success === undefined ? undefined : readableAgainst(152, 8, success, CONTRAST_LARGE_TEXT);

  if (accentText === undefined || success === undefined || successText === undefined) {
    return undefined;
  }

  return {
    surface,
    surfaceInverse,
    text,
    textInverse,
    textMuted,
    accent,
    accentText,
    success,
    successText,
  };
}
