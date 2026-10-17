import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findRejectedUtilities } from '../blocks/utility-classes';
import { setUtilityClassOracle } from '../custom-code/utility-vocabulary';
import { applyStyleIntents } from './engine';
import { tokensModeRejections } from './tokens-mode';

beforeAll(() => {
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});

/** Classes a registered block's className prop might carry, accepted and refused. */
const FIXTURES = [
  'p-4',
  'px-gutter',
  'bg-accent',
  'text-text-muted',
  'hover:bg-accent',
  'max-md:hover:text-surface',
  'sm:flex-row',
  'rounded-lg',
  'shadow-soft',
  'grid-cols-3',
  'gap-4',
  'z-10',
  '-mt-4',
  '-translate-x-1/2',
  'bg-accent/80',
  'ck-fx-glass',
  'ck-s-card',
  'group',
  'bg-blue-500',
  'hover:text-red-50',
  'from-sky-950/40',
  'border-gray-200/50',
  'dark:bg-zinc-900',
  'text-blue-12',
  'p-[17px]',
  'bg-[#0f766e]',
  'max-[600px]:p-4',
  '[mask-image:none]',
  'text-[length:var(--x)]',
  'shadow-[0_1px_2px_red]',
] as const;

describe('tokens mode ⇄ findRejectedUtilities (the registered-block door)', () => {
  it.each(FIXTURES)('%s gets the same verdict and code', (utility) => {
    const door = findRejectedUtilities(utility).map((rejection) => rejection.code);
    const engine = tokensModeRejections(utility).map((rejection) => rejection.code);
    expect(engine).toEqual(door);
  });

  it('is stricter on CSS-variable utilities, which are not theme tokens', () => {
    expect(findRejectedUtilities('bg-(--ck-c-brand)')).toEqual([]);
    expect(tokensModeRejections('bg-(--ck-c-brand)').map((rejection) => rejection.code)).toEqual([
      'css-variable',
    ]);
  });

  it('never lets the engine write a class the door would refuse', () => {
    const tokens = ['accent', 'surface', 'text-muted', 'accent/80', 'blue-500', 'red-50/20'];
    for (const token of tokens) {
      const result = applyStyleIntents(
        '',
        [
          {
            property: 'backgroundColor',
            value: { kind: 'token', token },
            bucket: 'base',
            state: 'default',
          },
        ],
        { mode: 'tokens' },
      );
      const doorAccepts = findRejectedUtilities(`bg-${token}`).length === 0;
      expect(result.ok).toBe(doorAccepts);
    }
  });
});
