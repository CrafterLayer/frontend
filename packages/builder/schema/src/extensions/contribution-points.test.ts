import { describe, expect, it } from 'vitest';

import { defineContextFragment } from './contribution-points';

describe('defineContextFragment', () => {
  it('validates and freezes explicit provenance metadata', () => {
    const fragment = defineContextFragment({
      source: 'acme.brand-guidance',
      kind: 'instruction',
      trust: 'reviewed',
      title: 'Brand guidance',
      body: 'Use the approved voice.',
      tokens: 8,
    });

    expect(fragment).toEqual({
      source: 'acme.brand-guidance',
      kind: 'instruction',
      trust: 'reviewed',
      title: 'Brand guidance',
      body: 'Use the approved voice.',
      tokens: 8,
    });
    expect(Object.isFrozen(fragment)).toBe(true);
  });

  it('rejects missing provenance, unknown roles, and unsafe token counts', () => {
    expect(() =>
      defineContextFragment({
        source: '',
        kind: 'data',
        trust: 'reviewed',
        title: 'Bad source',
        body: 'x',
      }),
    ).toThrow();
    expect(() =>
      defineContextFragment({
        source: 'host.bad',
        kind: 'system' as 'data',
        trust: 'reviewed',
        title: 'Bad kind',
        body: 'x',
      }),
    ).toThrow();
    expect(() =>
      defineContextFragment({
        source: 'host.bad',
        kind: 'data',
        trust: 'reviewed',
        title: 'Bad tokens',
        body: 'x',
        tokens: Number.POSITIVE_INFINITY,
      }),
    ).toThrow();
  });
});
