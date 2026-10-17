import { describe, expect, it } from 'vitest';

import { scrubAmount } from './scrub-amount';
import { namedModel, numberModel, spacingModel } from './spacing-model';

const spacing = spacingModel(['0', 'px', '1', '2', '4', '5', '6', '8']);

describe('scrubAmount', () => {
  it('moves an exact pixel amount 1px per 2px of travel and lands on a token when exact', () => {
    // gap-4 = 16px; +8px travel = +4px = 20px = step 5.
    expect(scrubAmount(spacing, { kind: 'token', token: '4' }, 'free', 8)).toEqual({ kind: 'token', token: '5' });
    expect(scrubAmount(spacing, { kind: 'token', token: '4' }, 'free', 2)).toEqual({ kind: 'raw', css: '17px' });
  });

  it('upwards grows, downwards shrinks; travel under one increment is no change', () => {
    expect(scrubAmount(spacing, { kind: 'raw', css: '10px' }, 'free', -4)).toEqual({ kind: 'token', token: '2' });
    expect(scrubAmount(spacing, { kind: 'raw', css: '10px' }, 'free', 6)).toEqual({ kind: 'raw', css: '13px' });
    expect(scrubAmount(spacing, { kind: 'raw', css: '10px' }, 'free', 1)).toBeUndefined();
  });

  it('respects the floor and the ceiling', () => {
    expect(scrubAmount(spacing, { kind: 'raw', css: '2px' }, 'free', -40, { min: 0 })).toEqual({
      kind: 'token',
      token: '0',
    });
    expect(scrubAmount(spacing, { kind: 'token', token: '0' }, 'free', -40, { min: 0 })).toBeUndefined();
  });

  it('moves rem by 0.05 and unitless fractions by 0.05', () => {
    expect(scrubAmount(spacing, { kind: 'raw', css: '1rem' }, 'free', 4)).toEqual({ kind: 'raw', css: '1.1rem' });
    const unitless = numberModel(['1', '1.25', '1.5'], '');
    expect(scrubAmount(unitless, { kind: 'raw', css: '1.5' }, 'free', 2)).toEqual({ kind: 'raw', css: '1.55' });
  });

  it('walks a named scale, an unset field and tokens mode one step per 12px', () => {
    const sizes = namedModel(['sm', 'base', 'lg', 'xl']);
    expect(scrubAmount(sizes, { kind: 'token', token: 'base' }, 'free', 24)).toEqual({ kind: 'token', token: 'xl' });
    expect(scrubAmount(sizes, { kind: 'token', token: 'base' }, 'free', 6)).toBeUndefined();
    expect(scrubAmount(spacing, { kind: 'token', token: '4' }, 'tokens', 12)).toEqual({ kind: 'token', token: '5' });
    expect(scrubAmount(sizes, { kind: 'token', token: 'xl' }, 'free', 48)).toBeUndefined();
  });
});
