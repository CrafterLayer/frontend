import { describe, expect, it } from 'vitest';

import {
  accessibleColor,
  accessibleToken,
  contrastOf,
  normalizeHex,
  resolveColor,
  splitOpacity,
} from './color-math';

const tokens = [
  { id: 'text', name: 'Text', css: '#111827' },
  { id: 'text-muted', name: 'Muted text', css: '#9ca3af' },
  { id: 'surface', name: 'Surface', css: '#ffffff' },
];

describe('colour maths', () => {
  it('splits a token opacity', () => {
    expect(splitOpacity('accent/80')).toEqual({ base: 'accent', opacity: 80 });
    expect(splitOpacity('accent')).toEqual({ base: 'accent' });
  });

  it('resolves tokens (with opacity), palette entries and raw values to CSS colours', () => {
    expect(resolveColor({ kind: 'token', token: 'text/50' }, tokens, [])).toBe('#111827');
    expect(resolveColor({ kind: 'palette', id: 'brand' }, [], [{ id: 'brand', name: 'Brand', css: '#0f766e' }])).toBe('#0f766e');
    expect(resolveColor({ kind: 'raw', css: '#abcdef' }, [], [])).toBe('#abcdef');
    expect(resolveColor({ kind: 'token', token: 'white' }, [], [])).toBe('#ffffff');
  });

  it('measures contrast and finds the nearest accessible colour', () => {
    expect(contrastOf('#000000', '#ffffff')).toBeCloseTo(21, 0);
    const muted = contrastOf('#9ca3af', '#ffffff') ?? 0;
    expect(muted).toBeLessThan(4.5);
    const fixed = accessibleColor('#9ca3af', '#ffffff');
    expect(fixed).toMatch(/^#[0-9a-f]{6}$/u);
    expect(contrastOf(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('picks the highest-contrast token in tokens mode', () => {
    expect(accessibleToken(tokens, '#ffffff')).toBe('text');
  });

  it('normalises picker output', () => {
    expect(normalizeHex('#ABCDEF')).toBe('#abcdef');
    expect(normalizeHex('#abcdef80')).toBe('#abcdef80');
    expect(normalizeHex('nope')).toBeUndefined();
  });
});
