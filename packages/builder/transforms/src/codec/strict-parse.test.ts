import { describe, expect, it } from 'vitest';

import { strictParse } from './strict-parse';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordOf = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error('expected a JSON object');
  }
  return value;
};

describe('strictParse', () => {
  it('reads strict JSON and records the one-based line of each value token', () => {
    const result = strictParse('{\n  "node": {\n    "type":\n      "text"\n  }\n}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.parsed.value).toEqual({ node: { type: 'text' } });
    expect(result.parsed.lineAt([])).toBe(1);
    expect(result.parsed.lineAt(['node'])).toBe(2);
    expect(result.parsed.lineAt(['node', 'type'])).toBe(4);
    expect(result.parsed.lineAt(['node', 'missing'])).toBe(2);
  });

  it.each([
    ['the root', '{\n  "id": 1,\n  "id": 2\n}', 3],
    ['a nested object', '{"node": {\n "id": 1,\n "id": 2}}', 3],
    ['an escaped spelling of the same key', '{\n "a": 1,\n "\\u0061": 2\n}', 3],
    ['CRLF input', '{\r\n "id": 1,\r\n "id": 2\r\n}', 3],
  ])('rejects duplicate keys in %s at the second key token', (_name, text, line) => {
    const result = strictParse(text);
    expect(result).toMatchObject({ ok: false, errors: [{ line }] });
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain('Duplicate object key');
    }
  });

  it('uses null-prototype objects so hostile keys stay own data and never pollute lookups', () => {
    const result = strictParse('{"safe": 1, "__proto__": {"polluted": true}, "constructor": 2}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const root = recordOf(result.parsed.value);
    expect(Object.getPrototypeOf(root)).toBeNull();
    expect(Object.hasOwn(root, '__proto__')).toBe(true);
    expect(Object.hasOwn(root, 'constructor')).toBe(true);
    expect(recordOf(root['__proto__'])['polluted']).toBe(true);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('decodes every JSON escape and accepts the complete number grammar', () => {
    const result = strictParse(
      '{"escaped":"\\\"\\/\\\\\\b\\f\\n\\r\\t\\u0061","numbers":[0,-0,1,-2,3.5,6e2,7E-2]}',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const root = recordOf(result.parsed.value);
    expect(root['escaped']).toBe('"/\\\b\f\n\r\ta');
    expect(root['numbers']).toEqual([0, -0, 1, -2, 3.5, 600, 0.07]);
  });

  it('counts a bare carriage return as one source line', () => {
    const result = strictParse('\r1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.parsed.value).toBe(1);
    expect(result.parsed.lineAt([])).toBe(2);
  });

  it.each([
    ['non-text input', undefined, 1],
    ['empty text', '', 1],
    ['an unexpected key token', '{\n nope: 1\n}', 2],
    ['a missing colon', '{\n "a" 1\n}', 2],
    ['an unexpected object separator', '{"a": 1 true}', 1],
    ['a trailing object comma', '{\n "a": 1,\n}', 2],
    ['a trailing array comma', '[1,\n]', 1],
    ['an unexpected array separator', '[1 true]', 1],
    ['an unterminated string', '{\n "a": "open', 2],
    ['an unescaped newline', '{"a":"line\nbreak"}', 1],
    ['an invalid escape', '{"a":"\\q"}', 1],
    ['a short Unicode escape', '{"a":"\\u12"}', 1],
    ['a leading zero', '01', 1],
    ['a bare minus sign', '-', 1],
    ['a missing fraction', '1.', 1],
    ['a missing exponent', '1e+', 1],
    ['an invalid literal', 'truX', 1],
    ['a second root value', 'true false', 1],
  ])('is total and reports the offending line for %s', (_name, text, line) => {
    expect(() => strictParse(text)).not.toThrow();
    expect(strictParse(text)).toMatchObject({ ok: false, errors: [{ line }] });
  });

  it.each([
    ['an object missing its closing token', '{\n  "a": 1\n', 1],
    ['an array missing its closing token', '[\n  1\n', 1],
    ['an array whose first value never starts', '[', 1],
    ['an array ending immediately after a comma', '[1,', 1],
    ['an object key missing its colon at EOF', '{"a"', 1],
    ['a key whose value never starts', '{\n  "a":\n', 2],
    ['an object ending after a comma', '{\n  "a": 1,\n', 2],
  ])(
    'points an incomplete %s at the token that opened the failure, not EOF',
    (_name, text, line) => {
      expect(strictParse(text)).toMatchObject({ ok: false, errors: [{ line }] });
    },
  );

  it('refuses excessive nesting before recursion can exhaust the runtime stack', () => {
    const text = `${'['.repeat(257)}0${']'.repeat(257)}`;
    const result = strictParse(text);

    expect(result).toMatchObject({ ok: false, errors: [{ line: 1 }] });
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain('nesting');
    }
  });
});
