import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { setUtilityClassOracle } from '../custom-code/utility-vocabulary';
import { applyStyleIntents, customBreakpointProperties, readStyle } from './engine';
import type { StyleBucket, StyleIntent, StyleState, StyleValue } from './types';

/*
  The static vocabulary predates the logical utilities (`pbs-4`, `inline-64`),
  and in the product the live compiler's oracle answers for them. These suites
  stand in a permissive oracle; one case below installs a refusing one.
*/
beforeAll(() => {
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});

const token = (value: string): StyleValue => ({ kind: 'token', token: value });
const keyword = (value: string): StyleValue => ({ kind: 'keyword', keyword: value });
const raw = (css: string): StyleValue => ({ kind: 'raw', css });

function intent(
  property: StyleIntent['property'],
  value: StyleValue | null,
  extra: { bucket?: StyleBucket; state?: StyleState; side?: StyleIntent['side'] } = {},
): StyleIntent {
  return {
    property,
    value,
    bucket: extra.bucket ?? 'base',
    state: extra.state ?? 'default',
    ...(extra.side === undefined ? {} : { side: extra.side }),
  };
}

function apply(className: string, ...intents: StyleIntent[]): string {
  const result = applyStyleIntents(className, intents, { mode: 'free' });
  if (!result.ok) throw new Error(result.message);
  return result.className;
}

function refusal(className: string, mode: 'free' | 'tokens', ...intents: StyleIntent[]): string {
  const result = applyStyleIntents(className, intents, { mode });
  if (result.ok) throw new Error(`expected a refusal, got "${result.className}"`);
  return result.message;
}

describe('applyStyleIntents — plain families', () => {
  it('writes one canonical class and replaces the family at that slot', () => {
    expect(apply('flex items-center', intent('display', keyword('grid')))).toBe(
      'grid items-center',
    );
    expect(apply('flex', intent('display', keyword('none')))).toBe('hidden');
    expect(apply('flex', intent('flexDirection', keyword('column')))).toBe('flex flex-col');
    expect(apply('text-lg text-accent', intent('fontSize', token('2xl')))).toBe(
      'text-2xl text-accent',
    );
    expect(apply('text-lg text-accent', intent('textColor', token('surface')))).toBe(
      'text-lg text-surface',
    );
  });

  it('keeps colour, width and style apart on a shared prefix', () => {
    expect(apply('border border-accent', intent('borderColor', token('surface')))).toBe(
      'border border-surface',
    );
    expect(apply('border-2 border-dashed', intent('borderStyle', keyword('solid')))).toBe(
      'border-2 border-solid',
    );
    expect(apply('outline-2 outline-accent', intent('outlineWidth', token('4')))).toBe(
      'outline-4 outline-accent',
    );
  });

  it('writes palette, raw and opacity colours in free mode', () => {
    expect(apply('', intent('backgroundColor', { kind: 'palette', id: 'brand-600' }))).toBe(
      'bg-(--ck-c-brand-600)',
    );
    expect(apply('', intent('backgroundColor', raw('#0f766e')))).toBe('bg-[#0f766e]');
    expect(apply('', intent('textColor', raw('oklch(62% 0.15 160)')))).toBe(
      'text-[oklch(62%_0.15_160)]',
    );
    expect(apply('', intent('backgroundColor', token('accent/80')))).toBe('bg-accent/80');
    expect(apply('', intent('backgroundColor', token('blue-500')))).toBe('bg-blue-500');
  });

  it('adds a type hint when a raw value would read as the sibling property', () => {
    expect(apply('', intent('fontSize', raw('17px')))).toBe('text-[17px]');
    expect(apply('', intent('textColor', raw('var(--x)')))).toBe('text-[var(--x)]');
    expect(apply('', intent('fontSize', raw('var(--x)')))).toBe('text-[length:var(--x)]');
    expect(apply('', intent('padding', raw('17px')))).toBe('p-[17px]');
    expect(
      apply(
        '',
        intent('boxShadow', raw('0 1px 2px rgb(0 0 0 / .08), 0 8px 24px rgb(0 0 0 / .12)')),
      ),
    ).toBe('shadow-[0_1px_2px_rgb(0_0_0_/_.08),_0_8px_24px_rgb(0_0_0_/_.12)]');
  });

  it('writes negative tokens where the property admits them', () => {
    expect(apply('', intent('margin', token('-4'), { side: 'block-start' }))).toBe('-mbs-4');
    expect(apply('', intent('translateBlock', token('-1/2')))).toBe('-translate-y-1/2');
    expect(refusal('', 'free', intent('padding', token('-4')))).toMatch(/Padding/u);
  });

  it('reads `w-*` as inline size and replaces it with the logical utility', () => {
    expect(apply('w-32', intent('inlineSize', token('64')))).toBe('inline-64');
    expect(apply('max-w-xl', intent('maxInlineSize', token('content-narrow')))).toBe(
      'max-inline-content-narrow',
    );
  });

  it('splits a two-axis shorthand, keeping the other half', () => {
    expect(apply('size-8', intent('inlineSize', token('full')))).toBe('block-8 inline-full');
    expect(apply('size-8', intent('blockSize', null))).toBe('inline-8');
    expect(apply('overflow-hidden', intent('overflowInline', keyword('auto')))).toBe(
      'overflow-y-hidden overflow-x-auto',
    );
  });

  it('writes the gradient towards inline-end as the physical pair with its rtl: half', () => {
    expect(apply('from-accent', intent('gradientDirection', keyword('to-inline-end')))).toBe(
      'from-accent bg-linear-to-r rtl:bg-linear-to-l',
    );
    expect(
      apply(
        'bg-linear-to-r rtl:bg-linear-to-l',
        intent('gradientDirection', keyword('to-block-end')),
      ),
    ).toBe('bg-linear-to-b');
    expect(apply('bg-gradient-to-r', intent('gradientDirection', keyword('radial')))).toBe(
      'bg-radial',
    );
    expect(
      apply('', intent('gradientDirection', keyword('to-inline-start'), { bucket: 'mobile' })),
    ).toBe('max-md:bg-linear-to-l max-md:rtl:bg-linear-to-r');
  });

  it('writes several effect presets at once, at base only', () => {
    expect(apply('', intent('effects', keyword('glass noise')))).toBe('ck-fx-glass ck-fx-noise');
    expect(apply('ck-fx-glass', intent('effects', keyword('mesh')))).toBe('ck-fx-mesh');
    expect(refusal('', 'free', intent('effects', keyword('glass'), { state: 'hover' }))).toMatch(
      /every screen size/u,
    );
  });
});

describe('applyStyleIntents — buckets and states', () => {
  it('writes desktop-first bucket prefixes', () => {
    expect(apply('p-4', intent('padding', token('6'), { bucket: 'mobile' }))).toBe(
      'p-4 max-md:p-6',
    );
    expect(apply('p-4', intent('padding', token('5'), { bucket: 'tablet' }))).toBe(
      'p-4 max-lg:p-5',
    );
    expect(apply('', intent('padding', token('2'), { bucket: { maxWidth: 600 } }))).toBe(
      'max-[600px]:p-2',
    );
  });

  it('writes state prefixes, bucket first', () => {
    expect(
      apply('bg-accent', intent('backgroundColor', token('surface'), { state: 'hover' })),
    ).toBe('bg-accent hover:bg-surface');
    expect(
      apply('', intent('backgroundColor', token('surface'), { bucket: 'mobile', state: 'hover' })),
    ).toBe('max-md:hover:bg-surface');
    expect(apply('', intent('textColor', token('accent'), { state: 'focus' }))).toBe(
      'focus-visible:text-accent',
    );
    expect(apply('', intent('opacity', token('80'), { state: 'group-hover' }))).toBe(
      'group-hover:opacity-80',
    );
    expect(apply('', intent('rotate', token('45'), { state: 'open' }))).toBe('open:rotate-45');
    expect(apply('', intent('scale', token('95'), { state: 'active' }))).toBe('active:scale-95');
  });

  it('touches only its own slot', () => {
    const start = 'bg-accent hover:bg-surface max-md:bg-text dark:bg-black';
    expect(apply(start, intent('backgroundColor', token('success'), { state: 'hover' }))).toBe(
      'bg-accent hover:bg-success max-md:bg-text dark:bg-black',
    );
  });

  it('resets only the class behind the value', () => {
    expect(
      apply('bg-accent hover:bg-surface', intent('backgroundColor', null, { state: 'hover' })),
    ).toBe('bg-accent');
    expect(apply('p-4 max-md:p-2', intent('padding', null, { bucket: 'mobile' }))).toBe('p-4');
  });

  it('is idempotent', () => {
    const once = apply('p-4 flex', intent('padding', token('2'), { side: 'inline-start' }));
    expect(apply(once, intent('padding', token('2'), { side: 'inline-start' }))).toBe(once);
  });
});

describe('applyStyleIntents — logical sides', () => {
  it('collapses equal sides and expands a shorthand on a one-side edit', () => {
    expect(apply('', intent('padding', token('4')))).toBe('p-4');
    expect(apply('p-4', intent('padding', token('2'), { side: 'inline-start' }))).toBe(
      'py-4 ps-2 pe-4',
    );
    expect(apply('py-4 ps-2 pe-4', intent('padding', token('4'), { side: 'inline-start' }))).toBe(
      'p-4',
    );
    expect(apply('pbs-4 pbe-4 ps-4 pe-4', intent('padding', token('4'), { side: 'block' }))).toBe(
      'p-4',
    );
    expect(apply('py-2', intent('padding', token('4'), { side: 'block-start' }))).toBe(
      'pbs-4 pbe-2',
    );
  });

  it('replaces the side classes tailwind-merge 3.6 would keep', () => {
    expect(apply('ps-2', intent('padding', token('4'), { side: 'inline' }))).toBe('px-4');
    expect(apply('pbs-4', intent('padding', token('2'), { side: 'block' }))).toBe('py-2');
  });

  it('resets one side and keeps the rest', () => {
    expect(apply('py-4 px-2', intent('padding', null, { side: 'inline-start' }))).toBe('py-4 pe-2');
  });

  it('reads physical classes it can map and replaces those it cannot', () => {
    expect(apply('pt-2', intent('padding', token('4'), { side: 'inline' }))).toBe('pbs-2 px-4');
    expect(apply('pl-3 py-2', intent('padding', token('4'), { side: 'inline' }))).toBe('py-2 px-4');
    expect(apply('pl-3', intent('padding', token('4'), { side: 'block' }))).toBe('pl-3 py-4');
    expect(apply('left-0 top-0', intent('inset', token('4'), { side: 'inline-start' }))).toBe(
      'inset-bs-0 inset-s-4',
    );
  });

  it('collapses border widths, keeping the bare default', () => {
    expect(apply('border', intent('borderWidth', token('2'), { side: 'inline-start' }))).toBe(
      'border-y border-s-2 border-e',
    );
    expect(apply('border-x-2', intent('borderWidth', keyword('default'), { side: 'inline' }))).toBe(
      'border-x',
    );
  });

  it('collapses corners by logical pairs', () => {
    expect(
      apply('rounded-lg', intent('borderRadius', token('none'), { side: 'block-start' })),
    ).toBe('rounded-t-none rounded-b-lg');
    expect(
      apply('rounded-lg', intent('borderRadius', token('none'), { side: 'inline-start' })),
    ).toBe('rounded-s-none rounded-e-lg');
    expect(
      apply('rounded-lg', intent('borderRadius', token('none'), { side: 'start-start' })),
    ).toBe('rounded-ss-none rounded-es-lg rounded-e-lg');
    expect(
      apply('rounded-tl-lg', intent('borderRadius', token('xl'), { side: 'block-start' })),
    ).toBe('rounded-t-xl');
  });

  it('refuses a side the property does not have', () => {
    expect(refusal('', 'free', intent('padding', token('4'), { side: 'start-start' }))).toMatch(
      /no side/u,
    );
    expect(refusal('', 'free', intent('opacity', token('50'), { side: 'inline-start' }))).toMatch(
      /no sides/u,
    );
  });
});

describe('applyStyleIntents — refusals', () => {
  it('names the property for an attribute-stored property', () => {
    expect(refusal('', 'free', intent('direction', keyword('rtl')))).toMatch(/attribute/u);
  });

  it('names the option list for an unknown keyword', () => {
    expect(refusal('', 'free', intent('display', keyword('table')))).toMatch(/block, flex, grid/u);
  });

  it('names the class and the property when the oracle refuses', () => {
    setUtilityClassOracle((name) => name !== 'p-[17px]');
    try {
      const message = refusal('', 'free', intent('padding', raw('17px')));
      expect(message).toContain('"p-[17px]"');
      expect(message).toContain('Padding (padding)');
    } finally {
      setUtilityClassOracle(() => true);
    }
  });

  it('refuses unsafe raw values before they reach the class list', () => {
    expect(refusal('', 'free', intent('backgroundColor', raw('red; color: blue')))).toMatch(
      /cannot carry/u,
    );
    expect(refusal('', 'free', intent('backgroundImage', raw('url(http://x.test/a.png)')))).toMatch(
      /https/u,
    );
  });

  it('applies all intents or none', () => {
    const result = applyStyleIntents(
      'p-4',
      [intent('padding', token('2')), intent('display', keyword('table'))],
      { mode: 'free' },
    );
    expect(result.ok).toBe(false);
  });

  it('reports what it added and removed', () => {
    const result = applyStyleIntents('p-4 flex', [intent('padding', token('2'))], { mode: 'free' });
    expect(result).toEqual({ ok: true, className: 'p-2 flex', added: ['p-2'], removed: ['p-4'] });
  });
});

describe('applyStyleIntents — tokens mode', () => {
  it('writes tokens and scale steps', () => {
    const result = applyStyleIntents('p-4', [intent('padding', token('gutter'))], {
      mode: 'tokens',
    });
    expect(result).toMatchObject({ ok: true, className: 'p-gutter' });
  });

  it('refuses palette, raw and hex values, Tailwind palette tokens and custom buckets', () => {
    expect(
      refusal('', 'tokens', intent('backgroundColor', { kind: 'palette', id: 'brand' })),
    ).toMatch(/palette colour/u);
    expect(refusal('', 'tokens', intent('backgroundColor', raw('#fff')))).toMatch(/exact value/u);
    expect(refusal('', 'tokens', intent('padding', raw('17px')))).toMatch(/exact value/u);
    expect(refusal('', 'tokens', intent('backgroundColor', token('blue-500')))).toMatch(
      /Background colour \(backgroundColor\).*palette/u,
    );
    expect(
      refusal('', 'tokens', intent('padding', token('4'), { bucket: { maxWidth: 600 } })),
    ).toMatch(/custom breakpoint/u);
  });
});

describe('readStyle', () => {
  it('reports provenance: here, a larger bucket, the default state', () => {
    const className = 'p-4 max-md:p-2 bg-accent max-lg:bg-surface';
    expect(
      readStyle(className, { bucket: 'mobile', state: 'default' }).get('padding'),
    ).toMatchObject({
      value: token('2'),
      source: 'here',
      className: 'max-md:p-2',
    });
    expect(
      readStyle(className, { bucket: 'tablet', state: 'default' }).get('padding'),
    ).toMatchObject({
      value: token('4'),
      source: 'larger-bucket',
    });
    expect(
      readStyle(className, { bucket: 'mobile', state: 'hover' }).get('backgroundColor'),
    ).toMatchObject({
      value: token('surface'),
      source: 'default-state',
      className: 'max-lg:bg-surface',
    });
  });

  it('includes custom buckets wider than the one read', () => {
    const read = readStyle('max-[900px]:gap-2 gap-6', { bucket: 'mobile', state: 'default' });
    expect(read.get('gap')).toMatchObject({ value: token('2'), source: 'larger-bucket' });
  });

  it('lets own classes win over named styles, and reports named-style values', () => {
    const namedStyles = { card: 'bg-surface p-6 rounded-xl' };
    const read = readStyle(
      'bg-accent ck-s-card',
      { bucket: 'base', state: 'default' },
      { namedStyles },
    );
    expect(read.get('backgroundColor')).toMatchObject({ value: token('accent'), source: 'here' });
    expect(read.get('borderRadius')).toMatchObject({ value: token('xl'), source: 'named-style' });
    expect(read.get('padding')).toMatchObject({ value: token('6'), source: 'named-style' });
  });

  it('resolves sides one by one and marks a mixed value', () => {
    const padding = readStyle('py-4 ps-2', { bucket: 'base', state: 'default' }).get('padding');
    expect(padding?.value).toEqual(keyword('mixed'));
    expect(padding?.sides?.['block-start']?.value).toEqual(token('4'));
    expect(padding?.sides?.['inline-start']?.value).toEqual(token('2'));
    expect(padding?.sides?.['inline-end']).toBeUndefined();
  });

  it('reads shorthands, the gradient pair and bare defaults', () => {
    const read = readStyle('size-8 bg-linear-to-r rtl:bg-linear-to-l border shadow', {
      bucket: 'base',
      state: 'default',
    });
    expect(read.get('inlineSize')?.value).toEqual(token('8'));
    expect(read.get('blockSize')?.value).toEqual(token('8'));
    expect(read.get('gradientDirection')?.value).toEqual(keyword('to-inline-end'));
    expect(read.get('borderWidth')?.value).toEqual(keyword('default'));
    expect(read.get('boxShadow')?.value).toEqual(keyword('default'));
  });

  it('flags families with classes behind breakpoints the engine does not write', () => {
    const read = readStyle('p-4 sm:p-6 xl:text-lg', { bucket: 'base', state: 'default' });
    expect(read.get('padding')?.customBreakpoint).toBe(true);
    expect([...customBreakpointProperties('p-4 sm:p-6 xl:text-lg @md:flex')].sort()).toEqual([
      'display',
      'fontSize',
      'padding',
    ]);
  });
});
