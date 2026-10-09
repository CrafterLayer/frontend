import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ckPrelude } from './ck-prelude.js';
import { DEFAULT_SCRIPT_LIMITS } from './limits';
import { scriptResultText, TRUNCATION_MARKER, truncateResult, truncateText } from './truncate';

describe('truncateText', () => {
  it('returns text within budget unchanged', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('cuts to the budget INCLUDING the marker', () => {
    const out = truncateText('x'.repeat(5000), 2000);
    expect(out.length).toBe(2000);
    expect(out.endsWith(`${TRUNCATION_MARKER} 5000 chars`)).toBe(true);
  });
});

describe('truncateResult', () => {
  it('passes a value within budget through by reference', () => {
    const value = { a: 1 };
    expect(truncateResult(value, 100)).toBe(value);
  });

  it('cuts the largest values first and keeps the shape', () => {
    const value = { id: 'h1', text: 'y'.repeat(3000), kind: 'heading' };
    const out = truncateResult(value, 400) as { id: string; kind: string; text: string };
    expect(out.id).toBe('h1');
    expect(out.kind).toBe('heading');
    expect(out.text).toContain(TRUNCATION_MARKER);
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(400);
  });

  it('ends a cut array with a marker counting the dropped items', () => {
    const out = truncateResult(
      Array.from({ length: 500 }, (_, i) => `row ${String(i)}`),
      300,
    ) as string[];
    expect(out.at(-1)).toMatch(new RegExp(`^${TRUNCATION_MARKER} \\d+ more items$`, 'u'));
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(300);
  });

  it('names omitted keys when an object has to drop entries', () => {
    const value = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`key${String(i)}`, 'v'.repeat(200)]),
    );
    const out = truncateResult(value, 600) as Record<string, string>;
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(600);
    expect(Object.keys(out).some((key) => key.startsWith(TRUNCATION_MARKER))).toBe(true);
  });

  it('returns unserializable values unchanged', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(truncateResult(cyclic, 10)).toBe(cyclic);
  });
});

describe('scriptResultText', () => {
  it('is undefined for no return or a function', () => {
    expect(scriptResultText(undefined, 100)).toBeUndefined();
    expect(scriptResultText(() => 1, 100)).toBeUndefined();
  });

  it('always fits the budget and stays valid JSON for structured values', () => {
    fc.assert(
      fc.property(
        fc.jsonValue({ maxDepth: 4 }),
        fc.integer({ min: 200, max: 2000 }),
        (value, budget) => {
          const text = scriptResultText(value, budget);
          if (text === undefined) return;
          expect(text.length).toBeLessThanOrEqual(budget);
          if (typeof value !== 'string' && !text.includes(`\n${TRUNCATION_MARKER}`)) {
            expect(() => JSON.parse(text) as unknown).not.toThrow();
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it('matches the copy inside ck-prelude.js byte for byte (parity)', () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 4 }), (value) => {
        const prelude = ckPrelude({
          elements: [],
          pages: [],
          photos: [],
          tools: [],
          locale: { lang: 'en', dir: 'ltr' },
          limits: { ...DEFAULT_SCRIPT_LIMITS, maxResultChars: 300 },
          seed: 0,
          now: 0,
        });
        try {
          const out = JSON.parse(prelude.finish(value)) as { result?: string };
          expect(out.result).toBe(scriptResultText(value, 300));
        } finally {
          prelude.restore();
        }
      }),
      { numRuns: 150 },
    );
  });
});
