import { describe, expect, it } from 'vitest';

import { darkTheme, lightTheme } from '../themes';
import { COLOR_ROLES, isColorRole, paletteOf } from './palette';

describe('the page palette a colour control can offer', () => {
  it('offers every colour role and nothing that is not a colour', () => {
    const roles = paletteOf(lightTheme).map((entry) => entry.role);

    expect(roles).toEqual([...COLOR_ROLES]);
    // `radius` and `gap` are theme tokens too, and offering them in a colour
    // picker would be nonsense — the subset is derived from the token union
    // precisely so this cannot drift.
    expect(roles).not.toContain('radius');
    expect(roles).not.toContain('gap');
  });

  it('carries a human name for every role, distinct from the key', () => {
    for (const entry of paletteOf(lightTheme)) {
      expect(entry.name.length).toBeGreaterThan(0);
      // "Inverse surface" is what a person reads; `surfaceInverse` is what the
      // type calls it. A picker that showed the key would be showing code.
      expect(entry.name).not.toBe(entry.role);
    }
  });

  it('points each role at the custom property a block actually reads', () => {
    const entries = paletteOf(lightTheme);
    const accent = entries.find((entry) => entry.role === 'accent');
    const inverse = entries.find((entry) => entry.role === 'surfaceInverse');

    expect(accent?.cssVar).toBe('--t-accent');
    // Camel case becomes kebab, which is the rule the renderer already uses.
    expect(inverse?.cssVar).toBe('--t-surface-inverse');
  });

  it('resolves swatches from the ACTIVE theme, so the picker shows the truth', () => {
    const light = paletteOf(lightTheme).find((entry) => entry.role === 'surface');
    const dark = paletteOf(darkTheme).find((entry) => entry.role === 'surface');

    expect(light?.value).toBe(lightTheme.surface);
    expect(dark?.value).toBe(darkTheme.surface);
    // Non-vacuous: if the two themes agreed, this would prove nothing about
    // the palette following the theme at all.
    expect(light?.value).not.toBe(dark?.value);
  });

  it('separates ink from ground, which is what makes a pairing legible', () => {
    const entries = paletteOf(lightTheme);
    const kinds = new Set(entries.map((entry) => entry.kind));

    expect(kinds).toEqual(new Set(['ground', 'ink']));
    expect(entries.find((entry) => entry.role === 'text')?.kind).toBe('ink');
    expect(entries.find((entry) => entry.role === 'surface')?.kind).toBe('ground');
  });

  it('recognises a role by name, and refuses anything that is not one', () => {
    expect(isColorRole('accent')).toBe(true);
    expect(isColorRole('radius')).toBe(false);
    // The whole reason this module exists: a document stores the ROLE. A hex
    // literal is refused by the schema's style validator, and must never be
    // mistaken for a role on the way in either.
    expect(isColorRole('#4f46e5')).toBe(false);
    expect(isColorRole('')).toBe(false);
  });

  it('never exposes a colour VALUE as the thing a document would store', () => {
    // The swatch is for the eye. What a picker writes is `entry.role`, and no
    // role may look like a literal — that is the invariant the page's whole
    // re-theming ability rests on.
    for (const entry of paletteOf(darkTheme)) {
      expect(entry.role).not.toMatch(/^#/);
      expect(entry.role).not.toMatch(/^rgb/);
      expect(entry.value).toMatch(/^#/);
    }
  });
});
