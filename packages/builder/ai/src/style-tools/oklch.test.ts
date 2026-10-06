import { describe, expect, it } from 'vitest';

import { isPaletteColorValue } from '@craftkit/builder-schema';

import { clampToSrgb, oklchRamp, oklchToHex, parseColour, RAMP_STEPS } from './oklch';

describe('the local OKLCH helper', () => {
  it('reads white, black and a mid colour in OKLCH', () => {
    expect(parseColour('#ffffff')?.l).toBeCloseTo(1, 3);
    expect(parseColour('#000')?.l).toBeCloseTo(0, 3);
    // #0f766e (Tailwind 3's teal-700) is oklch(51.1% 0.086 186.4).
    const teal = parseColour('#0f766e');
    expect(teal?.l).toBeCloseTo(0.511, 2);
    expect(teal?.c).toBeCloseTo(0.086, 2);
    expect(Math.abs((teal?.h ?? 0) - 186.4)).toBeLessThan(1);
  });

  it('round-trips through hex', () => {
    for (const hex of ['#0f766e', '#e11d48', '#fbbf24', '#1e293b', '#ffffff']) {
      const colour = parseColour(hex);
      expect(colour).toBeDefined();
      expect(oklchToHex(colour ?? { l: 0, c: 0, h: 0 })).toBe(hex);
    }
  });

  it('reads rgb() and oklch() too, and refuses anything else', () => {
    expect(oklchToHex(parseColour('rgb(15 118 110)') ?? { l: 0, c: 0, h: 0 })).toBe('#0f766e');
    expect(oklchToHex(parseColour('rgb(15, 118, 110)') ?? { l: 0, c: 0, h: 0 })).toBe('#0f766e');
    expect(parseColour('oklch(51.1% 0.096 186.4)')?.l).toBeCloseTo(0.511, 3);
    expect(parseColour('teal')).toBeUndefined();
    expect(parseColour('#12')).toBeUndefined();
  });

  it('gamut-maps by chroma only', () => {
    const wild = { l: 0.7, c: 0.4, h: 150 };
    const mapped = clampToSrgb(wild);
    expect(mapped.l).toBe(wild.l);
    expect(mapped.h).toBe(wild.h);
    expect(mapped.c).toBeLessThan(wild.c);
  });

  it('ramps 50-950 from light to dark, hue held, every value a palette colour', () => {
    const ramp = oklchRamp('#0f766e');
    expect(ramp).toBeDefined();
    const shades = RAMP_STEPS.map((step) => ramp?.[step] ?? '');
    for (const hex of shades) expect(isPaletteColorValue(hex), hex).toBe(true);
    const lightness = shades.map((hex) => parseColour(hex)?.l ?? 0);
    for (let at = 1; at < lightness.length; at += 1) expect(lightness[at]).toBeLessThan(lightness[at - 1] ?? 1);
    for (const hex of shades.slice(2, 10)) expect(Math.abs((parseColour(hex)?.h ?? 0) - 186.4)).toBeLessThan(6);
  });

  it('keeps a grey grey', () => {
    const ramp = oklchRamp('#808080');
    for (const step of RAMP_STEPS) expect(parseColour(ramp?.[step] ?? '')?.c ?? 1).toBeLessThan(0.01);
    expect(oklchRamp('nope')).toBeUndefined();
  });
});
