import { describe, expect, it } from 'vitest';

import {
  CONTRAST_LARGE_TEXT,
  CONTRAST_NORMAL_TEXT,
  checkContrast,
  contrastRatio,
  luminanceForRatio,
  parseHex,
  relativeLuminance,
} from './contrast';

describe('parseHex', () => {
  it('reads the three hex spellings a stylesheet actually uses', () => {
    expect(parseHex('#fff')).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseHex('#ffffff')).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseHex('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHex('4f46e5')).toBeDefined();
  });

  /*
    Alpha is discarded rather than blended. A contrast figure for a translucent
    colour depends on what is behind it, and a number computed against an
    assumed white backdrop is wrong in exactly the cases where it matters.
  */
  it('ignores alpha rather than inventing a backdrop for it', () => {
    expect(parseHex('#ffffff80')).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('returns nothing for a value that is not a colour', () => {
    for (const value of ['', '#', 'red', '#12345', 'var(--t-accent)', '#gggggg']) {
      expect(parseHex(value)).toBeUndefined();
    }
  });
});

describe('contrastRatio', () => {
  /*
    The two anchors WCAG itself is defined by. If these drift, the whole
    accessibility gate is measuring something else.
  */
  it('matches the known extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('is order-independent, so a caller cannot get it backwards', () => {
    expect(contrastRatio('#4f46e5', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#4f46e5') ?? 0,
      10,
    );
  });

  it('agrees with published figures for a real palette', () => {
    // The workspace's own light theme: indigo accent on white.
    expect(contrastRatio('#4f46e5', '#ffffff')).toBeGreaterThan(CONTRAST_NORMAL_TEXT);
    // Its muted text on white sits above the body-text minimum.
    expect(contrastRatio('#6b7280', '#ffffff')).toBeGreaterThan(CONTRAST_LARGE_TEXT);
  });

  it('returns nothing when either side is not a colour', () => {
    expect(contrastRatio('var(--t-accent)', '#ffffff')).toBeUndefined();
    expect(contrastRatio('#ffffff', 'currentColor')).toBeUndefined();
  });
});

describe('relativeLuminance', () => {
  it('places black at 0 and white at 1', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 10);
    expect(relativeLuminance({ r: 1, g: 1, b: 1 })).toBeCloseTo(1, 10);
  });

  /*
    Green carries the most luminance and blue the least — the weighting that
    makes a saturated blue need pale text while a saturated yellow needs dark.
    Getting this backwards is how a generator produces unreadable "accessible"
    palettes.
  */
  it('weights the channels the way human vision does', () => {
    const green = relativeLuminance({ r: 0, g: 1, b: 0 });
    const red = relativeLuminance({ r: 1, g: 0, b: 0 });
    const blue = relativeLuminance({ r: 0, g: 0, b: 1 });

    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe('checkContrast', () => {
  it('holds large text to a lower bar than body text', () => {
    expect(checkContrast('#767676', '#ffffff', 'normal')?.required).toBe(CONTRAST_NORMAL_TEXT);
    expect(checkContrast('#767676', '#ffffff', 'large')?.required).toBe(CONTRAST_LARGE_TEXT);
  });

  it('passes and fails on the right side of the line', () => {
    expect(checkContrast('#000000', '#ffffff', 'normal')?.passes).toBe(true);
    expect(checkContrast('#eeeeee', '#ffffff', 'large')?.passes).toBe(false);
  });
});

describe('luminanceForRatio', () => {
  /*
    THE function. Inverting the formula is what lets a palette be built so it
    cannot fail, instead of generated and retried until it stops failing — a
    loop with no upper bound whose successes drift every palette toward the
    same safe grey.
  */
  it('returns a luminance that actually achieves the ratio', () => {
    const backgroundLuminance = relativeLuminance(parseHex('#ffffff')!);
    const { darker } = luminanceForRatio(backgroundLuminance, CONTRAST_NORMAL_TEXT);

    expect(darker).toBeDefined();
    // Re-derive the ratio from the answer; it must land on the requirement.
    const achieved = (backgroundLuminance + 0.05) / (darker! + 0.05);
    expect(achieved).toBeCloseTo(CONTRAST_NORMAL_TEXT, 10);
  });

  it('answers for both directions, because either can be the possible one', () => {
    const midGrey = relativeLuminance(parseHex('#777777')!);
    const result = luminanceForRatio(midGrey, CONTRAST_NORMAL_TEXT);

    // Against a mid grey, going lighter is impossible and going darker is not.
    expect(result.lighter).toBeUndefined();
    expect(result.darker).toBeDefined();
  });

  /*
    A generator that only tried one direction would call a background unusable
    while the other direction was available — and would then reach for grey.
  */
  it('reports a direction as impossible rather than returning an out-of-range luminance', () => {
    const white = relativeLuminance(parseHex('#ffffff')!);
    const black = relativeLuminance(parseHex('#000000')!);

    expect(luminanceForRatio(white, 21).lighter).toBeUndefined();
    expect(luminanceForRatio(black, 21).darker).toBeUndefined();
    // At the extremes exactly one direction survives, and it is the right one.
    expect(luminanceForRatio(white, CONTRAST_NORMAL_TEXT).darker).toBeDefined();
    expect(luminanceForRatio(black, CONTRAST_NORMAL_TEXT).lighter).toBeDefined();
  });

  it('asks for less as the required ratio falls', () => {
    const white = relativeLuminance(parseHex('#ffffff')!);
    const forBody = luminanceForRatio(white, CONTRAST_NORMAL_TEXT).darker!;
    const forLarge = luminanceForRatio(white, CONTRAST_LARGE_TEXT).darker!;

    expect(forLarge).toBeGreaterThan(forBody);
  });
});
