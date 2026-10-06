import { afterEach, describe, expect, it } from 'vitest';

import {
  PALETTE_DEFAULTS,
  buildPalette,
  luminance,
  mixColor,
  parseColor,
  readPalette,
  readPaletteMode,
} from './palette';

afterEach(() => {
  document.body.replaceChildren();
});

describe('parseColor', () => {
  it('reads hex in every length and rgb()/rgba() in comma and space syntax', () => {
    expect(parseColor('#4f46e5')).toBe(0x4f46e5);
    expect(parseColor(' #FFF ')).toBe(0xffffff);
    expect(parseColor('#0b1120cc')).toBe(0x0b1120);
    expect(parseColor('#abcd')).toBe(0xaabbcc);
    expect(parseColor('rgb(79, 70, 229)')).toBe(0x4f46e5);
    expect(parseColor('rgba(255,0,0,0.5)')).toBe(0xff0000);
    expect(parseColor('rgb(0 128 255 / 40%)')).toBe(0x0080ff);
    expect(parseColor('rgb(100%, 0%, 0%)')).toBe(0xff0000);
  });

  it('returns undefined for what it cannot read, so the caller falls back', () => {
    expect(parseColor('')).toBeUndefined();
    expect(parseColor(null)).toBeUndefined();
    expect(parseColor('oklch(0.6 0.2 250)')).toBeUndefined();
    expect(parseColor('#12')).toBeUndefined();
    expect(parseColor('banana')).toBeUndefined();
  });
});

describe('palette modes', () => {
  it('defaults to theme and only accepts the closed vocabulary', () => {
    const el = document.createElement('div');
    expect(readPaletteMode(el)).toBe('theme');
    el.setAttribute('data-ck-palette', 'mono');
    expect(readPaletteMode(el)).toBe('mono');
    el.setAttribute('data-ck-palette', 'neon');
    expect(readPaletteMode(el)).toBe('theme');
  });

  it('builds three colours per mode with safe defaults', () => {
    const theme = buildPalette('theme', {});
    expect(theme.colors[0]).toBe(PALETTE_DEFAULTS.accent);
    expect(theme.colors[1]).toBe(PALETTE_DEFAULTS.text);
    expect(theme.background).toBe(PALETTE_DEFAULTS.surface);
    expect(theme.dark).toBe(false);

    const accent = buildPalette('accent', { accent: 0x336699 });
    expect(accent.colors[0]).toBe(0x336699);
    expect(new Set(accent.colors).size).toBe(3);

    const mono = buildPalette('mono', { text: 0xe5e7eb, surface: 0x0b1120 });
    expect(mono.dark).toBe(true);
    expect(mono.colors[0]).toBe(0xe5e7eb);
    expect(luminance(mono.colors[2])).toBeLessThan(luminance(mono.colors[0]));
  });

  it('mixes linearly per channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0xff0000, 0.5)).toBe(0x800000);
    expect(mixColor(0x000000, 0xffffff, 7)).toBe(0xffffff);
  });
});

describe('readPalette', () => {
  it('reads the site --t-* tokens before the chrome --bldr-* tokens', () => {
    const host = document.createElement('section');
    host.style.setProperty('--t-accent', '#ff0000');
    host.style.setProperty('--bldr-accent', '#00ff00');
    host.style.setProperty('--bldr-panel-text', 'rgb(1, 2, 3)');
    host.style.setProperty('--t-surface', '#0b1120');
    const el = document.createElement('div');
    host.append(el);
    document.body.append(host);

    const palette = readPalette(host);

    expect(palette.colors[0]).toBe(0xff0000);
    expect(palette.colors[1]).toBe(0x010203);
    expect(palette.background).toBe(0x0b1120);
    expect(palette.dark).toBe(true);
  });

  it('falls back to the defaults when no token is set or readable', () => {
    const el = document.createElement('div');
    el.style.setProperty('--t-accent', 'not-a-colour');
    document.body.append(el);

    const palette = readPalette(el);

    expect(palette.colors[0]).toBe(PALETTE_DEFAULTS.accent);
    expect(palette.background).toBe(PALETTE_DEFAULTS.surface);
  });
});
