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
});
