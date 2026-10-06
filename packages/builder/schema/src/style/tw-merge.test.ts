import { twMerge } from 'tailwind-merge';
import { describe, expect, it } from 'vitest';

import { ckTwMerge } from './tw-merge';

describe('ckTwMerge — the logical conflicts tailwind-merge 3.6.0 misses', () => {
  it.each([
    ['ps-2 px-4', 'px-4'],
    ['pbs-4 py-2', 'py-2'],
    ['inline-64 w-32', 'w-32'],
  ])('%s → %s (plain tailwind-merge keeps both)', (input, expected) => {
    expect(twMerge(input)).toBe(input);
    expect(ckTwMerge(input)).toBe(expected);
  });

  it.each([
    ['pe-2 px-4', 'px-4'],
    ['pt-2 pbs-4', 'pbs-4'],
    ['mbs-2 my-4', 'my-4'],
    ['ms-2 mx-auto', 'mx-auto'],
    ['w-32 inline-64', 'inline-64'],
    ['h-10 block-20', 'block-20'],
    ['inline-4 block-4 size-8', 'size-8'],
    ['min-w-0 min-inline-full', 'min-inline-full'],
    ['max-w-xl max-inline-content-wide', 'max-inline-content-wide'],
    ['inset-s-2 inset-x-0', 'inset-x-0'],
    ['inset-bs-2 inset-y-4', 'inset-y-4'],
    ['rounded-ss-lg rounded-t-xl', 'rounded-t-xl'],
    ['rounded-ee-lg rounded-b-xl', 'rounded-b-xl'],
    ['border-s-2 border-x-4', 'border-x-4'],
    ['border-bs-2 border-y', 'border-y'],
    ['border-s-accent border-x-surface', 'border-x-surface'],
  ])('%s → %s', (input, expected) => {
    expect(ckTwMerge(input)).toBe(expected);
  });

  it('lets a later side refine an earlier shorthand', () => {
    expect(ckTwMerge('px-4 ps-2')).toBe('px-4 ps-2');
    expect(ckTwMerge('py-2 pbs-4')).toBe('py-2 pbs-4');
  });

  it('knows the theme tokens', () => {
    expect(ckTwMerge('rounded-lg rounded-base')).toBe('rounded-base');
    expect(ckTwMerge('shadow-md shadow-soft')).toBe('shadow-soft');
    expect(ckTwMerge('shadow-soft shadow-accent')).toBe('shadow-soft shadow-accent');
    expect(ckTwMerge('font-bold font-regular')).toBe('font-regular');
    expect(ckTwMerge('p-4 p-gutter')).toBe('p-gutter');
    expect(ckTwMerge('max-w-xl max-w-content-narrow')).toBe('max-w-content-narrow');
    expect(ckTwMerge('text-text-muted text-accent')).toBe('text-accent');
    expect(ckTwMerge('text-lg text-accent')).toBe('text-lg text-accent');
  });

  it('keeps variants apart', () => {
    expect(ckTwMerge('ps-2 max-md:px-4')).toBe('ps-2 max-md:px-4');
    expect(ckTwMerge('max-md:ps-2 max-md:px-4')).toBe('max-md:px-4');
  });
});
