import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { rgbToOklab } from '../../kit/palette-oklab';
import { COLOR_VERSION, createColorLibrary } from '../color-entry';

const Co = createColorLibrary();

/* A theme palette as s.palette gives it: 0xRRGGBB numbers. */
const SURFACE = 0x101525;
const ACCENT = 0x67e8f9;
const TEXT = 0xf1f5f9;

const lightness = (color: number) => rgbToOklab(color).L;

describe('color library', () => {
  it('is frozen, plain, and names the culori it bundles, read from its manifest', () => {
    expect(Object.isFrozen(Co)).toBe(true);
    expect(Co.version).toBe(COLOR_VERSION);
    expect(Co.spaces).toEqual(['oklab', 'oklch']);
    expect(Co.harmonies).toEqual(['analogous', 'complementary', 'triadic', 'split', 'tetradic']);
    const manifest = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../../../node_modules/culori/package.json'),
        'utf8',
      ),
    ) as { version: string; license: string };
    expect(manifest).toMatchObject({ version: '4.0.2', license: 'MIT' });
  });

  it('reads palette numbers, #hex, oklch(), rgb() and named colours alike', () => {
    expect(Co.toNumber(ACCENT)).toBe(ACCENT);
    expect(Co.toNumber('#67e8f9')).toBe(ACCENT);
    expect(Co.toNumber('#fff')).toBe(0xffffff);
    expect(Co.toNumber('rgb(255 0 0)')).toBe(0xff0000);
    expect(Co.toNumber('teal')).toBe(0x008080);
    expect(Co.toHex(0x0a0b0c)).toBe('#0a0b0c');
    // oklch() round-trips through its own reading.
    const { l, c, h } = Co.oklch(ACCENT);
    expect(Co.toNumber(`oklch(${String(l)} ${String(c)} ${String(h)})`)).toBe(ACCENT);
    expect(Co.toNumber({ mode: 'rgb', r: 1, g: 0, b: 1 })).toBe(0xff00ff);
  });

  it('never throws: an unreadable colour is mid grey and an unreadable list is empty', () => {
    for (const bad of [
      undefined,
      null,
      Number.NaN,
      -1,
      'not a colour',
      {},
      { mode: 'cmyk' },
      [],
      'x'.repeat(500),
    ]) {
      expect(Co.toNumber(bad)).toBe(Co.fallback);
      expect(Co.ramp(bad, bad, 4)).toEqual([]);
      expect(Co.shades(bad, 4)).toEqual([]);
      expect(Co.harmony(bad, 'triadic')).toEqual([]);
      expect(Co.adjust(bad, { l: 0.1 })).toBe(Co.fallback);
      expect(Co.contrast(bad, ACCENT)).toBe(1);
    }
    expect(Co.mix('nope', ACCENT, 0.5)).toBe(ACCENT);
  });

  it('ramps evenly from one palette colour to another, in OKLab or OKLCH, ends exact', () => {
    for (const space of ['oklab', 'oklch'] as const) {
      const ramp = Co.ramp(SURFACE, ACCENT, 7, { space });
      expect(ramp).toHaveLength(7);
      expect(ramp[0]).toBe(SURFACE);
      expect(ramp[6]).toBe(ACCENT);
      // Perceptually even: lightness climbs in near-equal steps.
      const steps = ramp.slice(1).map((color, i) => lightness(color) - lightness(ramp[i] ?? 0));
      for (const step of steps) expect(step).toBeGreaterThan(0);
      expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(0.02);
    }
    // Along a list of stops, and clamped counts.
    expect(Co.ramp([SURFACE, ACCENT, TEXT], 5)).toHaveLength(5);
    expect(Co.ramp([SURFACE, ACCENT, TEXT], 5)[4]).toBe(TEXT);
    expect(Co.ramp(SURFACE, ACCENT, 10_000)).toHaveLength(Co.limits.maxColors);
    expect(Co.ramp(SURFACE, ACCENT, 0)).toHaveLength(1);
  });

  it('shades one colour from light to dark keeping its hue', () => {
    const shades = Co.shades(ACCENT, 6);
    expect(shades).toHaveLength(6);
    const ls = shades.map(lightness);
    for (let i = 1; i < ls.length; i += 1) expect(ls[i]).toBeLessThan(ls[i - 1] ?? 0);
    const hue = Co.oklch(ACCENT).h;
    for (const shade of shades.slice(1, -1))
      expect(Math.abs(Co.oklch(shade).h - hue)).toBeLessThan(6);
    expect(Co.shades(ACCENT, 3, { light: 0.9, dark: 0.3 }).map((c) => Co.oklch(c).l)).toEqual([
      expect.closeTo(0.9, 1),
      expect.closeTo(0.6, 1),
      expect.closeTo(0.3, 1),
    ]);
  });

  it('turns harmonies around the OKLCH wheel from the colour itself', () => {
    const base = Co.oklch(ACCENT).h;
    const turn = (color: number) => (((Co.oklch(color).h - base) % 360) + 360) % 360;
    expect(Co.harmony(ACCENT, 'complementary')).toHaveLength(2);
    expect(Co.harmony(ACCENT, 'complementary')[0]).toBe(ACCENT);
    expect(turn(Co.harmony(ACCENT, 'complementary')[1] ?? 0)).toBeCloseTo(180, -1);
    expect(Co.harmony(ACCENT, 'triadic').map(turn)).toEqual([
      expect.closeTo(0, -1),
      expect.closeTo(120, -1),
      expect.closeTo(240, -1),
    ]);
    expect(Co.harmony(ACCENT, 'tetradic')).toHaveLength(4);
    expect(Co.harmony(ACCENT, 'split')).toHaveLength(3);
    // Unknown kinds read as analogous.
    expect(Co.harmony(ACCENT, 'nope')).toEqual(Co.harmony(ACCENT, 'analogous'));
  });

  it('mixes in OKLab like the kit palette does', () => {
    expect(Co.mix(SURFACE, ACCENT, 0)).toBe(SURFACE);
    expect(Co.mix(SURFACE, ACCENT, 1)).toBe(ACCENT);
    const mid = Co.mix(SURFACE, ACCENT, 0.5);
    expect(lightness(mid)).toBeCloseTo((lightness(SURFACE) + lightness(ACCENT)) / 2, 2);
  });

  it('measures WCAG contrast and picks a readable colour', () => {
    expect(Co.contrast(0x000000, 0xffffff)).toBeCloseTo(21, 5);
    expect(Co.contrast('#777', '#777')).toBe(1);
    // The first candidate that reaches 4.5:1, else the best.
    expect(Co.readable(SURFACE, [0x1f2937, TEXT, ACCENT])).toBe(TEXT);
    expect(Co.readable(0x777777, [0x707070, 0x999999])).toBe(0x999999);
    expect(Co.readable(SURFACE, [0x1f2937, ACCENT], { min: 3 })).toBe(ACCENT);
    // Without candidates: a near-white or near-black in the background's own hue.
    expect(Co.contrast(Co.readable(SURFACE), SURFACE)).toBeGreaterThan(12);
    expect(Co.contrast(Co.readable(0xf8fafc), 0xf8fafc)).toBeGreaterThan(12);
  });

  it('adjusts lightness, chroma and hue by deltas and stays in sRGB', () => {
    expect(lightness(Co.adjust(ACCENT, { l: -0.3 }))).toBeLessThan(lightness(ACCENT) - 0.2);
    expect(Co.oklch(Co.adjust(ACCENT, { c: -1 })).c).toBeLessThan(0.01);
    const turned = Co.oklch(Co.adjust(ACCENT, { h: 90 })).h;
    expect((((turned - Co.oklch(ACCENT).h) % 360) + 360) % 360).toBeCloseTo(90, -1);
    // A chroma far outside sRGB is pulled in, not clipped into another hue.
    const vivid = Co.adjust(ACCENT, { c: 0.4 });
    expect(Math.abs(Co.oklch(vivid).h - Co.oklch(ACCENT).h)).toBeLessThan(6);
    expect(Co.adjust(ACCENT, {})).toBe(ACCENT);
  });
});
