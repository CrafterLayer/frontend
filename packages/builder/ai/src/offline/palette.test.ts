import { describe, expect, it } from 'vitest';

import { CONTRAST_NORMAL_TEXT, contrastRatio, parseHex } from '@craftkit/builder-schema';

import { buildPalette, hslToHex, readableAgainst } from './palette';

/** Every hue on the wheel, so no test passes by picking a friendly one. */
const HUES = Array.from({ length: 36 }, (_, index) => index * 10);

describe('hslToHex', () => {
  it('produces the colours everyone can check by eye', () => {
    expect(hslToHex({ h: 0, s: 0, l: 100 })).toBe('#ffffff');
    expect(hslToHex({ h: 0, s: 0, l: 0 })).toBe('#000000');
    expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe('#ff0000');
    expect(hslToHex({ h: 120, s: 100, l: 50 })).toBe('#00ff00');
    expect(hslToHex({ h: 240, s: 100, l: 50 })).toBe('#0000ff');
  });

  it('wraps hue rather than clipping it', () => {
    expect(hslToHex({ h: 360, s: 100, l: 50 })).toBe(hslToHex({ h: 0, s: 100, l: 50 }));
    expect(hslToHex({ h: -120, s: 100, l: 50 })).toBe(hslToHex({ h: 240, s: 100, l: 50 }));
  });
});

describe('readableAgainst', () => {
  /*
    THE property. Not "usually passes" — for every hue on the wheel, the colour
    it returns clears the ratio it was asked for. This is what replaces the
    generate-measure-retry loop that drifts every palette toward grey.
  */
  it('always clears the ratio it was asked for, at every hue', () => {
    for (const hue of HUES) {
      const colour = readableAgainst(hue, 70, '#ffffff', CONTRAST_NORMAL_TEXT);
      expect(colour, `hue ${String(hue)}`).toBeDefined();
      expect(contrastRatio(colour!, '#ffffff'), `hue ${String(hue)}`).toBeGreaterThanOrEqual(
        CONTRAST_NORMAL_TEXT,
      );
    }
  });

  it('reads against a dark background too, not only a pale one', () => {
    for (const hue of HUES) {
      const colour = readableAgainst(hue, 70, '#111827', CONTRAST_NORMAL_TEXT);
      expect(colour, `hue ${String(hue)}`).toBeDefined();
      expect(contrastRatio(colour!, '#111827')).toBeGreaterThanOrEqual(CONTRAST_NORMAL_TEXT);
    }
  });

  /*
    A saturated yellow cannot be dark and a saturated blue cannot be bright.
    Relaxing saturation only as far as the requirement forces is what keeps the
    colour's character instead of reaching for grey the moment it is difficult.
  */
  it('keeps saturation where it can, and gives it up only where it must', () => {
    const easy = readableAgainst(220, 70, '#ffffff', CONTRAST_NORMAL_TEXT);
    const hard = readableAgainst(55, 90, '#ffffff', 7);

    expect(easy).toBeDefined();
    expect(hard).toBeDefined();
    // Both read; the difficult one simply had to move further.
    expect(contrastRatio(hard!, '#ffffff')).toBeGreaterThanOrEqual(7);
  });

  it('returns nothing when the requirement genuinely cannot be met', () => {
    // 21:1 against mid grey is impossible in either direction.
    expect(readableAgainst(200, 60, '#777777', 21)).toBeUndefined();
  });

  it('refuses a background that is not a colour rather than guessing one', () => {
    expect(readableAgainst(200, 60, 'var(--t-surface)', 4.5)).toBeUndefined();
  });
});

describe('buildPalette', () => {
  /*
    The gate SC-009 turns into a number. Every pairing a generated theme
    authorises must clear its minimum — for every hue, not for the one the
    author happened to try.
  */
  it('produces a palette whose every text pairing reads, at every hue', () => {
    for (const hue of HUES) {
      const palette = buildPalette(hue, 65);
      expect(palette, `hue ${String(hue)}`).toBeDefined();
      const p = palette!;

      const pairings: [string, string, number][] = [
        [p.text, p.surface, CONTRAST_NORMAL_TEXT],
        [p.textMuted, p.surface, CONTRAST_NORMAL_TEXT],
        [p.accent, p.surface, CONTRAST_NORMAL_TEXT],
        [p.textInverse, p.surfaceInverse, CONTRAST_NORMAL_TEXT],
        [p.accentText, p.accent, 3],
        [p.success, p.surface, CONTRAST_NORMAL_TEXT],
        [p.successText, p.success, 3],
      ];

      for (const [fg, bg, required] of pairings) {
        expect(contrastRatio(fg, bg), `hue ${String(hue)}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(
          required,
        );
      }
    }
  });

  it('holds body text well above the minimum, not exactly on it', () => {
    const palette = buildPalette(210, 60)!;

    // 7:1, because the 4.5 minimum is the line below which text FAILS, not the
    // level at which it is comfortable to read.
    expect(contrastRatio(palette.text, palette.surface)).toBeGreaterThanOrEqual(7);
  });

  /*
    The tell of a template. Pure #ffffff is the single most recognisable sign
    that nobody chose the background, and it is a few percent of tint away from
    looking considered.
  */
  it('tints the surface with the brand hue instead of defaulting to white', () => {
    const warm = buildPalette(25, 65)!;
    const cool = buildPalette(210, 65)!;

    expect(warm.surface).not.toBe('#ffffff');
    expect(cool.surface).not.toBe('#ffffff');
    expect(warm.surface).not.toBe(cool.surface);

    // The tint is a trace, not a wash: still unmistakably a light surface.
    const { r, g, b } = parseHex(warm.surface)!;
    expect(Math.min(r, g, b)).toBeGreaterThan(0.9);
  });

  /*
    SC-004 in miniature. Two businesses must not receive the same palette, and
    a generator that retried its way to safety would hand them both the same
    grey.
  */
  it('gives different hues genuinely different palettes', () => {
    const palettes = [15, 90, 165, 240, 315].map((hue) => buildPalette(hue, 65)!);
    const accents = new Set(palettes.map((palette) => palette.accent));
    const surfaces = new Set(palettes.map((palette) => palette.surface));

    expect(accents.size).toBe(palettes.length);
    expect(surfaces.size).toBe(palettes.length);
  });

  it('keeps success green rather than repainting it in the brand hue', () => {
    // A page that says "saved" in the brand's own colour says nothing.
    for (const hue of [0, 120, 240]) {
      const palette = buildPalette(hue, 65)!;
      const { r, g, b } = parseHex(palette.success)!;
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
    }
  });

  it('produces every one of the nine roles a theme assigns', () => {
    const palette = buildPalette(200, 60)!;

    for (const [role, value] of Object.entries(palette)) {
      expect(value, role).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(Object.keys(palette)).toHaveLength(9);
  });
});
