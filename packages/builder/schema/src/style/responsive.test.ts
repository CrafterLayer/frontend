import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { setUtilityClassOracle } from '../custom-code/utility-vocabulary';
import { applyStyleIntents } from './engine';
import { normalizeResponsive } from './responsive';

beforeAll(() => {
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});

describe('normalizeResponsive — mobile-first md:/lg: to desktop-first buckets', () => {
  it('probes 1280 / 900 / 375 and writes base + max-lg: + max-md:', () => {
    expect(normalizeResponsive('p-4 md:p-8', 'padding')).toBe('p-8 max-md:p-4');
    expect(normalizeResponsive('px-4 lg:px-8', 'padding')).toBe('px-8 max-lg:px-4');
    expect(normalizeResponsive('text-sm md:text-base lg:text-lg', 'fontSize')).toBe(
      'text-lg max-lg:text-base max-md:text-sm',
    );
    expect(normalizeResponsive('flex flex-col md:flex-row', 'flexDirection')).toBe(
      'flex flex-row max-md:flex-col',
    );
  });

  it('normalises side by side', () => {
    expect(normalizeResponsive('p-4 md:px-8', 'padding')).toBe('py-4 px-8 max-md:px-4');
  });

  it('normalises each state on its own', () => {
    expect(normalizeResponsive('hover:bg-accent md:hover:bg-surface', 'backgroundColor')).toBe(
      'hover:bg-surface max-md:hover:bg-accent',
    );
  });

  it('touches only the family asked for', () => {
    expect(normalizeResponsive('p-4 md:p-8 text-sm md:text-lg', 'padding')).toBe(
      'p-8 max-md:p-4 text-sm md:text-lg',
    );
  });

  it('leaves a family it cannot express without a reset value', () => {
    expect(normalizeResponsive('lg:flex', 'display')).toBe('lg:flex');
    expect(normalizeResponsive('md:px-8', 'padding')).toBe('md:px-8');
  });

  it('leaves custom breakpoints and mixed directions alone', () => {
    expect(normalizeResponsive('p-2 sm:p-4', 'padding')).toBe('p-2 sm:p-4');
    expect(normalizeResponsive('p-2 max-md:p-1 md:p-4', 'padding')).toBe('p-2 max-md:p-1 md:p-4');
  });

  it('runs on the first edit of a family', () => {
    const result = applyStyleIntents(
      'p-4 md:p-8',
      [
        {
          property: 'padding',
          value: { kind: 'token', token: '2' },
          bucket: 'mobile',
          state: 'default',
        },
      ],
      { mode: 'free' },
    );
    expect(result).toMatchObject({ ok: true, className: 'p-8 max-md:p-2' });
  });
});
