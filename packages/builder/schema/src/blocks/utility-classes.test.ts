import { describe, expect, it } from 'vitest';

import { findRejectedUtilities, isStorableUtilityClass, splitUtilities } from './utility-classes';

describe('splitUtilities', () => {
  it('splits the way a browser reads a class attribute', () => {
    expect(splitUtilities('flex  gap-4\n  items-center ')).toEqual([
      'flex',
      'gap-4',
      'items-center',
    ]);
    expect(splitUtilities('   ')).toEqual([]);
  });
});

describe('what a document may hold', () => {
  /*
    The correction at the centre of this module. `p-4` compiles to
    `calc(var(--t-space-unit) * 4)` because the bridge binds Tailwind's
    `--spacing` to the site's own unit — it is four STEPS, not sixteen pixels,
    and re-pointing the token still moves it. An earlier rule banned this and
    cost every block the ability to be customised at all.
  */
  it('accepts the numeric scale, which is token-derived', () => {
    for (const utility of ['p-4', 'gap-6', 'mt-2', 'px-8', 'space-y-3']) {
      expect(isStorableUtilityClass(utility), utility).toBe(true);
    }
  });

  it('accepts layout utilities, which carry no design value at all', () => {
    for (const utility of [
      'flex',
      'grid',
      'flex-col',
      'items-center',
      'justify-between',
      'grid-cols-3',
      'col-span-2',
      'z-10',
      'overflow-hidden',
      'rounded-full',
    ]) {
      expect(isStorableUtilityClass(utility), utility).toBe(true);
    }
  });

  it('accepts colour ROLES, which resolve through the design system', () => {
    for (const utility of [
      'bg-accent',
      'text-text-muted',
      'bg-surface-inverse',
      'border-accent',
      'text-accent-text',
    ]) {
      expect(isStorableUtilityClass(utility), utility).toBe(true);
    }
  });

  /*
    Variants are what make a block genuinely customisable rather than
    customisable-at-one-size. A rule that refused them would force every
    responsive decision back into the schema.
  */
  it('accepts responsive and state variants', () => {
    for (const utility of [
      'sm:flex-row',
      'lg:p-8',
      'hover:bg-accent',
      'focus-visible:ring-2',
      'dark:text-text-inverse',
      'md:hover:bg-surface',
    ]) {
      expect(isStorableUtilityClass(utility), utility).toBe(true);
    }
  });
});

describe('what a document may not hold', () => {
  /*
    A length or a colour wearing brackets. Nothing behind it moves when the
    theme changes, which is the entire failure this rule exists to prevent.
  */
  it('refuses arbitrary values', () => {
    for (const utility of ['p-[17px]', 'bg-[#ff0000]', 'w-[42rem]', 'text-[13px]']) {
      const [rejection] = findRejectedUtilities(utility);
      expect(rejection?.code, utility).toBe('arbitrary-value');
    }
  });

  it('refuses an arbitrary value hidden behind a variant', () => {
    expect(findRejectedUtilities('lg:p-[17px]')[0]?.code).toBe('arbitrary-value');
  });

  /*
    The one that quietly destroys a generated site's identity: a page half in
    brand colours and half in Tailwind blue reads as broken rather than themed.
  */
  it('refuses the default palette', () => {
    for (const utility of ['bg-blue-500', 'text-gray-700', 'border-rose-300', 'ring-emerald-400']) {
      const [rejection] = findRejectedUtilities(utility);
      expect(rejection?.code, utility).toBe('default-palette');
    }
  });

  it('refuses a palette colour behind a variant or with an opacity', () => {
    expect(findRejectedUtilities('hover:bg-blue-500')[0]?.code).toBe('default-palette');
    expect(findRejectedUtilities('text-gray-700/50')[0]?.code).toBe('default-palette');
    expect(findRejectedUtilities('dark:border-rose-300')[0]?.code).toBe('default-palette');
  });

  /*
    THE false positive to guard against. `grid-cols-3`, `gap-4`, and `z-10` all
    look like "word-number", and a rule that pattern-matched on that shape
    would refuse the entire layout system while claiming to protect colours.
  */
  it('does not mistake a numeric layout utility for a palette colour', () => {
    for (const utility of ['grid-cols-3', 'gap-4', 'z-10', 'order-2', 'basis-1/2', 'opacity-50']) {
      expect(findRejectedUtilities(utility), utility).toEqual([]);
    }
  });

  it('names every offender in a list, not just the first', () => {
    const rejections = findRejectedUtilities('flex bg-blue-500 gap-4 p-[3px] items-center');

    expect(rejections.map((rejection) => rejection.utility)).toEqual(['bg-blue-500', 'p-[3px]']);
  });

  /*
    A refusal a person cannot act on is a refusal that gets worked around. Each
    message names the alternative rather than only the rule.
  */
  it('tells a person what to use instead', () => {
    expect(findRejectedUtilities('bg-blue-500')[0]?.message).toMatch(/bg-accent/);
    expect(findRejectedUtilities('p-[17px]')[0]?.message).toMatch(/p-4|scale step/);
  });
});

describe('a whole class list', () => {
  it('accepts a realistic customisation', () => {
    expect(
      isStorableUtilityClass(
        'flex flex-col gap-6 sm:flex-row sm:gap-8 rounded-base bg-surface p-6',
      ),
    ).toBe(true);
  });

  it('rejects the list if any one class is not storable', () => {
    expect(isStorableUtilityClass('flex gap-4 bg-blue-500')).toBe(false);
  });

  it('accepts an empty list rather than treating absence as an error', () => {
    expect(isStorableUtilityClass('')).toBe(true);
    expect(isStorableUtilityClass('   ')).toBe(true);
  });
});
