import { describe, expect, it } from 'vitest';

import { jsonValueZod } from './json-value-schema';
import {
  MAX_JSON_DEPTH,
  canonicalizeJsonValue,
  findJsonViolation,
  isJsonValue,
  type JsonValue,
} from './json-value';

function nestedArrays(depth: number): JsonValue {
  let value: JsonValue = null;
  for (let level = 0; level < depth; level += 1) {
    value = [value];
  }
  return value;
}

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

  it('accepts depth MAX_JSON_DEPTH and rejects MAX_JSON_DEPTH + 1 with its exact path', () => {
    expect(findJsonViolation(nestedArrays(MAX_JSON_DEPTH))).toBeUndefined();
    expect(findJsonViolation(nestedArrays(MAX_JSON_DEPTH + 1))).toEqual({
      path: Array.from({ length: MAX_JSON_DEPTH + 1 }, () => 0),
      kind: 'max-depth',
    });

    expect(jsonValueZod.safeParse(nestedArrays(MAX_JSON_DEPTH)).success).toBe(true);
    const tooDeep = jsonValueZod.safeParse(nestedArrays(MAX_JSON_DEPTH + 1));
    expect(tooDeep.success).toBe(false);
    if (!tooDeep.success) {
      expect(tooDeep.error.issues[0]?.path).toEqual(
        Array.from({ length: MAX_JSON_DEPTH + 1 }, () => 0),
      );
    }
  });
});

describe('isJsonValue', () => {
  it('narrows valid values', () => {
    expect(isJsonValue({ a: 1 })).toBe(true);
    expect(isJsonValue(() => null)).toBe(false);
  });
});

describe('canonicalizeJsonValue — the -0 boundary (011 research R2)', () => {
  it('normalises -0 to 0 so the textual round trip can hold', () => {
    // THE DEFECT THIS CLOSES, verified by execution before the fix:
    // Number.isFinite(-0) is true (the validator admits it) while
    // JSON.stringify(-0) prints "0" — so a stored -0 could never survive
    // project→parse. Canonicalised, the round trip is exact again.
    const canonical = canonicalizeJsonValue(-0);
    expect(Object.is(canonical, 0)).toBe(true);
    expect(Object.is(JSON.parse(JSON.stringify(canonical)), canonical)).toBe(true);
  });

  it('reaches -0 wherever it hides — arrays, nested objects, mixed shapes', () => {
    const canonical = canonicalizeJsonValue({
      offsets: [1, -0] as [number, number],
      nested: { depth: -0 },
      label: 'kept',
      zero: 0,
    });
    expect(Object.is(canonical.offsets[1], 0)).toBe(true);
    expect(Object.is(canonical.nested.depth, 0)).toBe(true);
    expect(canonical.label).toBe('kept');
    expect(Object.is(canonical.zero, 0)).toBe(true);
  });

  it('is IDENTITY-PRESERVING: a clean value comes back by reference', () => {
    // The boundary runs on every dispatch; a clean payload must cost nothing.
    const clean = { a: [1, 2, 3], b: { c: 'x', d: 0 } };
    expect(canonicalizeJsonValue(clean)).toBe(clean);
    expect(canonicalizeJsonValue(clean).a).toBe(clean.a);
  });

  it('allocates only along the changed path, sharing untouched siblings', () => {
    const dirty = { touched: [-0], untouched: { deep: [1, 2] } };
    const canonical = canonicalizeJsonValue(dirty);
    expect(canonical).not.toBe(dirty);
    expect(canonical.untouched).toBe(dirty.untouched);
  });

  it('never judges: non-JSON shapes pass through for the validator to reject', () => {
    // Normalisation and rejection are different jobs (the door owns rejection).
    const date = new Date(0);
    expect(canonicalizeJsonValue(date)).toBe(date);
    const nothing: unknown = undefined;
    expect(canonicalizeJsonValue(nothing)).toBeUndefined();
    const fn = () => undefined;
    expect(canonicalizeJsonValue(fn)).toBe(fn);
  });

  it('returns a circular input unchanged without throwing so Law J owns the typed rejection', () => {
    const circular: Record<string, unknown> = { offset: -0 };
    circular['self'] = circular;

    expect(() => canonicalizeJsonValue(circular)).not.toThrow();
    expect(canonicalizeJsonValue(circular)).toBe(circular);
    expect(Object.is(circular['offset'], -0)).toBe(true);
    expect(() => jsonValueZod.parse(circular)).toThrow();
    expect(jsonValueZod.safeParse(circular).success).toBe(false);
  });
});
