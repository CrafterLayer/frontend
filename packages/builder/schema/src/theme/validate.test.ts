import { describe, expect, it } from 'vitest';

import { checkContrast } from './contrast';
import { COLOR_TOKENS, MEASUREMENT_TOKENS, TOKEN_NAMES } from './design-system';
import type { ColorToken, Theme, TokenName } from './tokens';
import { validateDesignSystem } from './validate';

/* A complete token assignment. Colours are chosen so the pairings below are
   real WCAG outcomes rather than arbitrary strings: #FFFFFF on #1F2937 is
   14.7:1, and #9CA3AF on #FFFFFF is 2.5:1 — a genuine failure. */
function theme(overrides: Partial<Theme> = {}): Theme {
  const base = Object.fromEntries(TOKEN_NAMES.map((name) => [name, '0'])) as Theme;
  return {
    ...base,
    surface: '#FFFFFF',
    surfaceInverse: '#1F2937',
    text: '#111827',
    textInverse: '#FFFFFF',
    textMuted: '#4B5563',
    accent: '#4338CA',
    accentText: '#FFFFFF',
    success: '#065F46',
    successText: '#FFFFFF',
    ...overrides,
  };
}

function system(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Warm Clinical',
    tokens: theme(),
    typography: { headingFamily: 'Fraunces', bodyFamily: 'Inter', scaleRatio: 1.25 },
    pairings: [
      { text: 'text', background: 'surface', size: 'normal' },
      { text: 'textInverse', background: 'surfaceInverse', size: 'normal' },
      { text: 'accentText', background: 'accent', size: 'normal' },
    ],
    seed: 'clinic-2026-09',
    ...overrides,
  };
}

describe('token vocabulary', () => {
  it('exposes every colour and measurement name at runtime', () => {
    expect(COLOR_TOKENS).toHaveLength(9);
    expect(MEASUREMENT_TOKENS).toHaveLength(58);
    expect(TOKEN_NAMES).toHaveLength(67);
  });

  it('names no token twice', () => {
    expect(new Set(TOKEN_NAMES).size).toBe(TOKEN_NAMES.length);
  });
});

describe('validateDesignSystem', () => {
  it('accepts a complete system whose every authorized pairing clears its minimum', () => {
    const result = validateDesignSystem(system());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.system.name).toBe('Warm Clinical');
  });

  /* FR-014. The pairing is authorized, so it must be measured — and this one
     is 2.54:1, which is not a near miss. */
  it('rejects exactly the one authorized pairing below 4.5:1 for normal text', () => {
    const result = validateDesignSystem(
      system({
        pairings: [
          { text: 'text', background: 'surface', size: 'normal' },
          { text: 'textMuted', background: 'surface', size: 'normal' },
        ],
        tokens: theme({ textMuted: '#9CA3AF' }),
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    const [issue] = result.issues;
    expect(issue?.code).toBe('contrast-below-minimum');
    expect(issue?.path).toEqual(['pairings', 1]);
    expect(issue?.message).toContain('4.5');
  });

  /* Large text is allowed 3:1. The same colours that fail as normal pass here,
     which is the whole reason `size` is carried on the pairing. */
  it('holds large text to 3:1, not to 4.5:1', () => {
    const tokens = theme({ textMuted: '#767676' });

    expect(
      validateDesignSystem(
        system({ tokens, pairings: [{ text: 'textMuted', background: 'surface', size: 'large' }] }),
      ).ok,
    ).toBe(true);
    expect(
      validateDesignSystem(
        system({
          tokens,
          pairings: [{ text: 'textMuted', background: 'surface', size: 'normal' }],
        }),
      ).ok,
    ).toBe(true);

    const failing = theme({ textMuted: '#8C8C8C' });
    expect(
      validateDesignSystem(
        system({
          tokens: failing,
          pairings: [{ text: 'textMuted', background: 'surface', size: 'large' }],
        }),
      ).ok,
    ).toBe(true);
    expect(
      validateDesignSystem(
        system({
          tokens: failing,
          pairings: [{ text: 'textMuted', background: 'surface', size: 'normal' }],
        }),
      ).ok,
    ).toBe(false);
  });

  /* The number a failure REPORTS must be the number it was TESTED against.
     A local copy of the threshold beside the check let those drift silently —
     the message could name 4.5 while 3 was enforced. This pins them together. */
  it('reports the same threshold it enforced, per size', () => {
    const failNormal = validateDesignSystem(
      system({
        tokens: theme({ textMuted: '#8C8C8C' }),
        pairings: [{ text: 'textMuted', background: 'surface', size: 'normal' }],
      }),
    );
    expect(failNormal.ok).toBe(false);
    if (failNormal.ok) return;
    expect(failNormal.issues[0]?.message).toContain('4.5:1 required for normal text');

    const failLarge = validateDesignSystem(
      system({
        tokens: theme({ textMuted: '#B0B0B0' }),
        pairings: [{ text: 'textMuted', background: 'surface', size: 'large' }],
      }),
    );
    expect(failLarge.ok).toBe(false);
    if (failLarge.ok) return;
    expect(failLarge.issues[0]?.message).toContain('3:1 required for large text');
  });

  it('rejects an unknown token key', () => {
    const result = validateDesignSystem(
      system({ tokens: { ...theme(), notARealToken: '#000000' } }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.code === 'unknown-token')).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes('notARealToken'))).toBe(true);
  });

  it('rejects a token assignment missing a name the vocabulary requires', () => {
    const incomplete = { ...theme() } as Record<string, string>;
    delete incomplete['gutter'];

    const result = validateDesignSystem(system({ tokens: incomplete }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.message.includes('gutter'))).toBe(true);
  });

  it('rejects a pairing naming a colour role that does not exist', () => {
    const result = validateDesignSystem(
      system({ pairings: [{ text: 'notAColour', background: 'surface', size: 'normal' }] }),
    );

    expect(result.ok).toBe(false);
  });

  /* A measurement is not a colour. Allowing one here would put a spacing step
     into a contrast calculation, which can only produce a meaningless number. */
  it('refuses a measurement token used as a pairing colour', () => {
    const result = validateDesignSystem(
      system({ pairings: [{ text: 'gutter', background: 'surface', size: 'normal' }] }),
    );

    expect(result.ok).toBe(false);
  });

  /* A colour the ratio cannot be computed for must FAIL, never silently pass.
     `checkContrast` returns undefined for unparseable input, and treating that
     as "fine" is how an unmeasurable palette ships. */
  it('fails closed when a pairing colour is not a parseable hex', () => {
    const result = validateDesignSystem(
      system({
        tokens: theme({ accent: 'rebeccapurple' }),
        pairings: [{ text: 'accentText', background: 'accent', size: 'normal' }],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.code === 'contrast-unmeasurable')).toBe(true);
  });

  it('rejects a malformed shell: no name, no seed, or a non-positive scale ratio', () => {
    expect(validateDesignSystem(system({ name: '' })).ok).toBe(false);
    expect(validateDesignSystem(system({ seed: '' })).ok).toBe(false);
    expect(
      validateDesignSystem(
        system({ typography: { headingFamily: 'A', bodyFamily: 'B', scaleRatio: 0 } }),
      ).ok,
    ).toBe(false);
    expect(validateDesignSystem(null).ok).toBe(false);
    expect(validateDesignSystem({}).ok).toBe(false);
  });

  it('reports every failing pairing, not only the first', () => {
    const result = validateDesignSystem(
      system({
        tokens: theme({ textMuted: '#9CA3AF', accent: '#C7D2FE' }),
        pairings: [
          { text: 'textMuted', background: 'surface', size: 'normal' },
          { text: 'accentText', background: 'accent', size: 'normal' },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.filter((issue) => issue.code === 'contrast-below-minimum')).toHaveLength(
      2,
    );
  });

  /* The validator is a gate, not a mutator: a caller must be able to hand it
     live state without it being edited underneath them. */
  it('does not mutate the value it was handed', () => {
    const input = system();
    const snapshot = structuredClone(input);

    validateDesignSystem(input);

    expect(input).toEqual(snapshot);
  });

  /* Not mutating the input is only half of it. If the result SHARES the
     caller's objects, a later edit on their side silently rewrites a system
     that already passed the gate — the approval would then describe something
     that no longer exists. */
  it('returns a system detached from the caller’s objects', () => {
    const input = system();
    const result = validateDesignSystem(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.system.tokens).not.toBe(input.tokens);
    expect(result.system.typography).not.toBe(input.typography);
    expect(result.system.pairings).not.toBe(input.pairings);
    expect(result.system.pairings[0]).not.toBe(input.pairings[0]);

    (input.tokens as Record<string, string>)['accent'] = '#000000';
    (input.pairings as { size: string }[])[0]!.size = 'large';

    expect(result.system.tokens.accent).toBe('#4338CA');
    expect(result.system.pairings[0]?.size).toBe('normal');
  });

  /* The ratio is diagnostic information a person acts on — it is the
     difference between "darken this slightly" and "pick another colour". A
     constant here would read as a real measurement. */
  it('reports the ratio it actually measured', () => {
    const result = validateDesignSystem(
      system({
        tokens: theme({ textMuted: '#9CA3AF' }),
        pairings: [{ text: 'textMuted', background: 'surface', size: 'normal' }],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const measured = checkContrast('#9CA3AF', '#FFFFFF', 'normal');
    expect(measured).toBeDefined();
    expect(result.issues[0]?.message).toContain(`${measured!.ratio.toFixed(2)}:1`);
  });

  it('returns a system typed with the closed token union on success', () => {
    const result = validateDesignSystem(system());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const name: TokenName = 'gutter';
    const role: ColorToken = 'accent';
    expect(result.system.tokens[name]).toBeDefined();
    expect(result.system.tokens[role]).toBe('#4338CA');
    expect(result.system.seed).toBe('clinic-2026-09');
  });
});
