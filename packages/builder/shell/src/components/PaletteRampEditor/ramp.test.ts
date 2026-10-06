import { describe, expect, it } from 'vitest';
import { oklch, parse } from 'culori';

import { isPaletteColorValue, paletteColorSchema } from '@craftkit/builder-schema';

import {
  contrastGrade,
  contrastMatrix,
  generateRamp,
  paletteSlug,
  RAMP_STEPS,
  rampPaletteColors,
} from './ramp';

const lightness = (css: string): number => oklch(parse(css) ?? 'black')?.l ?? Number.NaN;

describe('generateRamp', () => {
  it('makes 11 shades, 50 to 950, each strictly darker than the last', () => {
    const shades = generateRamp('#0f766e');
    expect(shades?.map((shade) => shade.step)).toEqual([...RAMP_STEPS]);
    const ls = (shades ?? []).map((shade) => lightness(shade.value));
    for (let at = 1; at < ls.length; at += 1) {
      expect(ls[at]).toBeLessThan(ls[at - 1] ?? 1);
    }
  });

  it('puts the brand colour itself on exactly one step', () => {
    const shades = generateRamp('#0f766e') ?? [];
    const anchors = shades.filter((shade) => shade.anchor);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.hex).toBe('#0f766e');
  });

  it('keeps the hue and writes values the palette door admits', () => {
    const base = oklch(parse('#2563eb') ?? 'black');
    for (const shade of generateRamp('#2563eb') ?? []) {
      expect(isPaletteColorValue(shade.value)).toBe(true);
      const hue = oklch(parse(shade.value) ?? 'black')?.h ?? 0;
      expect(Math.abs(hue - (base?.h ?? 0))).toBeLessThan(2);
    }
  });

  it('accepts any CSS colour and refuses what is not one', () => {
    expect(generateRamp('oklch(62% 0.15 160)')).toHaveLength(11);
    expect(generateRamp('rgb(200 30 60)')).toHaveLength(11);
    expect(generateRamp('not a colour')).toBeUndefined();
  });

  it('handles a grey without inventing a hue', () => {
    const shades = generateRamp('#808080') ?? [];
    expect(shades).toHaveLength(11);
    for (const shade of shades) expect(isPaletteColorValue(shade.value)).toBe(true);
  });
});

describe('rampPaletteColors', () => {
  it('names entries <slug>-<step> under the colour name, each a valid palette entry', () => {
    const colors = rampPaletteColors('Brand Teal', generateRamp('#0f766e') ?? []);
    expect(colors.map((color) => color.id)).toEqual(
      RAMP_STEPS.map((step) => `brand-teal-${String(step)}`),
    );
    expect(colors[0]?.group).toBe('Brand Teal');
    for (const color of colors) expect(paletteColorSchema.safeParse(color).success).toBe(true);
  });

  it('slugs names that do not start with a letter, or are Arabic', () => {
    expect(paletteSlug('500 Blue')).toBe('c-500-blue');
    expect(paletteSlug('أزرق')).toBe('colour');
  });
});

describe('contrast', () => {
  it('grades WCAG ratios', () => {
    expect(contrastGrade(7.2)).toBe('AAA');
    expect(contrastGrade(4.6)).toBe('AA');
    expect(contrastGrade(3.1)).toBe('AA large');
    expect(contrastGrade(2)).toBe('fail');
  });

  it('measures every shade against every column; the pale end reads on black', () => {
    const shades = generateRamp('#0f766e') ?? [];
    const matrix = contrastMatrix(shades, [
      { name: 'white', css: '#fff' },
      { name: 'black', css: '#000' },
      { name: 'broken', css: 'nope' },
    ]);
    expect(matrix).toHaveLength(11);
    expect(matrix[0]?.[1]).toBeGreaterThan(15);
    expect(matrix[10]?.[0]).toBeGreaterThan(7);
    expect(matrix[0]?.[2]).toBeUndefined();
  });
});
