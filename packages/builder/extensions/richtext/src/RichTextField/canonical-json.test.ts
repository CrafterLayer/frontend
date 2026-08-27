import { describe, expect, it } from 'vitest';

import { canonicalJson } from './canonical-json';

describe('canonicalJson (008 §8 item 13)', () => {
  it('is KEY-ORDER independent — the whole point of not using JSON.stringify', () => {
    const a = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
    const b = { content: [{ content: [], type: 'paragraph' }], type: 'doc' };
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b)); // the trap it avoids
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('still distinguishes genuinely different documents', () => {
    const a = { type: 'doc', content: [{ type: 'paragraph' }] };
    const b = { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 } }] };
    expect(canonicalJson(a)).not.toBe(canonicalJson(b));
  });

  it('preserves ARRAY order (document order is meaning, key order is not)', () => {
    const first = { type: 'doc', content: [{ type: 'paragraph' }, { type: 'heading' }] };
    const swapped = { type: 'doc', content: [{ type: 'heading' }, { type: 'paragraph' }] };
    expect(canonicalJson(first)).not.toBe(canonicalJson(swapped));
  });

  it('handles primitives, null, and undefined without throwing', () => {
    expect(canonicalJson(undefined)).toBe('null');
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(7)).toBe('7');
    expect(canonicalJson('x')).toBe('"x"');
    expect(canonicalJson([1, 'a', null])).toBe('[1,"a",null]');
  });

  it('degrades BigInt and excessively deep stored values to bounded JSON instead of throwing', () => {
    expect(canonicalJson({ value: 1n })).toBe('{"value":null}');

    let deeplyNested: unknown = 'leaf';
    for (let depth = 0; depth < 20_000; depth += 1) {
      deeplyNested = { child: deeplyNested };
    }
    const canonical = canonicalJson(deeplyNested);
    expect(JSON.parse(canonical) as unknown).toBeDefined();
    expect(canonical).toContain('null');
    expect(canonical.length).toBeLessThan(2_048);
  });

  it('keeps the byte-for-byte canonical form of valid stored rich text', () => {
    const valid = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            {
              type: 'text',
              text: 'Hello',
              marks: [{ type: 'link', attrs: { href: '/docs' } }, { type: 'bold' }],
            },
          ],
        },
      ],
    };

    expect(canonicalJson(valid)).toBe(
      '{"content":[{"attrs":{"level":2},"content":[{"marks":[{"attrs":{"href":"/docs"},"type":"link"},{"type":"bold"}],"text":"Hello","type":"text"}],"type":"heading"}],"type":"doc"}',
    );
  });
});
