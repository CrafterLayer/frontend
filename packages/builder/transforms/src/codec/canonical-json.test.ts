import { describe, expect, it } from 'vitest';

import { canonicalJson } from './canonical-json';

describe('canonicalJson', () => {
  it('sorts every object level, indents by two spaces, and uses LF with no trailing whitespace', () => {
    const text = canonicalJson({ z: 1, a: { y: true, b: null } });

    expect(text).toBe('{\n  "a": {\n    "b": null,\n    "y": true\n  },\n  "z": 1\n}');
    expect(text).not.toContain('\r');
    expect(text.split('\n').some((line) => /[ \t]$/u.test(line))).toBe(false);
  });

  it('preserves slot-array order while canonicalising the surrounding keys', () => {
    expect(canonicalJson({ slots: { default: ['third', 'first', 'second'] }, id: 'root' })).toBe(
      '{\n  "id": "root",\n  "slots": {\n    "default": [\n      "third",\n      "first",\n      "second"\n    ]\n  }\n}',
    );
  });

  it('keeps absent and present-empty optional maps observably different', () => {
    expect(canonicalJson({ id: 'a' })).not.toBe(canonicalJson({ id: 'a', bindings: {} }));
    expect(canonicalJson({ id: 'a', responsive: {} })).toContain('"responsive": {}');
  });

  it('produces byte-identical text when its output is parsed and printed again', () => {
    const first = canonicalJson({ b: [{ z: '😀', a: 'e\u0301' }], a: -0 });
    const parsed: unknown = JSON.parse(first);

    expect(canonicalJson(parsed)).toBe(first);
  });

  it('prints unsupported values explicitly instead of omitting their keys', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const value = {
      absent: undefined,
      circular,
      enormous: 1n,
      impossible: Number.POSITIVE_INFINITY,
      operation: (): void => undefined,
      token: Symbol('token'),
    };

    const text = canonicalJson(value);
    expect(text).toContain('"absent": "[Unprojectable: undefined]"');
    expect(text).toContain('"circular": {\n    "self": "[Unprojectable: circular reference]"');
    expect(text).toContain('"enormous": "[Unprojectable: bigint]"');
    expect(text).toContain('"impossible": "[Unprojectable: non-finite number]"');
    expect(text).toContain('"operation": "[Unprojectable: function]"');
    expect(text).toContain('"token": "[Unprojectable: symbol]"');
  });

  it('is total over sparse arrays, unsupported objects, throwing getters, and hostile proxies', () => {
    const sparse: unknown[] = [];
    sparse.length = 1;
    const getter: Record<string, unknown> = {};
    Object.defineProperty(getter, 'broken', {
      enumerable: true,
      get: () => {
        throw new Error('getter failed');
      },
    });
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('proxy failed');
        },
      },
    );

    expect(canonicalJson(sparse)).toContain('[Unprojectable: array hole]');
    expect(canonicalJson(new Map())).toBe('"[Unprojectable: unsupported object]"');
    expect(canonicalJson(getter)).toContain('[Unprojectable: unreadable property]');
    expect(canonicalJson(hostile)).toBe('"[Unprojectable: unreadable value]"');
  });
});
