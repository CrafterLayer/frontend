import { describe, expect, it } from 'vitest';

import { findJsonViolation, isJsonValue } from './json-value';

describe('findJsonViolation', () => {
  it('accepts plain JSON data', () => {
    expect(
      findJsonViolation({
        text: 'hello',
        count: 3,
        ratio: 0.5,
        on: true,
        nothing: null,
        list: [1, 'two', { nested: [] }],
      }),
    ).toBeUndefined();
  });

  it.each([
    ['function', { handler: () => null }, 'function'],
    ['undefined', { missing: undefined }, 'undefined'],
    ['bigint', { big: 1n }, 'bigint'],
    ['symbol', { sym: Symbol('x') }, 'symbol'],
    ['NaN', { bad: Number.NaN }, 'non-finite-number'],
    ['Infinity', { bad: Number.POSITIVE_INFINITY }, 'non-finite-number'],
    ['Date instance', { when: new Date(0) }, 'unsupported-object'],
    ['Map instance', { map: new Map() }, 'unsupported-object'],
  ] as const)('rejects %s with the offending path', (_label, value, kind) => {
    const violation = findJsonViolation(value);
    expect(violation).toBeDefined();
    expect(violation?.kind).toBe(kind);
    expect(violation?.path.length).toBeGreaterThan(0);
  });

  it('reports the deep path of the first violation', () => {
    const violation = findJsonViolation({ a: [{ b: { c: () => null } }] });
    expect(violation).toEqual({ path: ['a', 0, 'b', 'c'], kind: 'function' });
  });

  it('rejects sparse arrays as undefined holes', () => {
    const violation = findJsonViolation([1, , 3]);
    expect(violation?.kind).toBe('undefined');
    expect(violation?.path).toEqual([1]);
  });

  it('rejects circular structures instead of looping forever', () => {
    const value: Record<string, unknown> = {};
    value['self'] = value;
    expect(findJsonViolation(value)?.kind).toBe('circular');
  });

  it('allows the same object referenced from two branches (a DAG is not a cycle)', () => {
    const shared = { ok: true };
    expect(findJsonViolation({ a: shared, b: shared })).toBeUndefined();
  });
});

describe('isJsonValue', () => {
  it('narrows valid values', () => {
    expect(isJsonValue({ a: 1 })).toBe(true);
    expect(isJsonValue(() => null)).toBe(false);
  });
});
