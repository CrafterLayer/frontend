import { describe, expect, it } from 'vitest';

import { canonicalJsonStringify, estimateCanonicalJsonTokens } from './canonical-json';

describe('canonical JSON', () => {
  it('orders object keys recursively while preserving array order', () => {
    const left = {
      z: [{ beta: 2, alpha: 1 }],
      a: { delta: 4, gamma: 3 },
    };
    const right = {
      a: { gamma: 3, delta: 4 },
      z: [{ alpha: 1, beta: 2 }],
    };

    expect(canonicalJsonStringify(left)).toBe(canonicalJsonStringify(right));
    expect(canonicalJsonStringify(left)).toBe(
      '{"a":{"delta":4,"gamma":3},"z":[{"alpha":1,"beta":2}]}',
    );
  });

  it('uses the canonical bytes for the shared four-characters-per-token estimate', () => {
    const value = { long: '12345678', short: 'a' };

    expect(estimateCanonicalJsonTokens(value)).toBe(
      Math.max(1, Math.ceil(canonicalJsonStringify(value).length / 4)),
    );
  });

  it('counts an Arabic character as half a token, twice a Latin one', () => {
    const latin = { text: 'abcdefgh' };
    const arabic = { text: 'مرحبابكم' };
    const latinJson = canonicalJsonStringify(latin);

    // Same length on the wire; the 8 Arabic letters cost 4 tokens, not 2.
    expect(canonicalJsonStringify(arabic)).toHaveLength(latinJson.length);
    expect(estimateCanonicalJsonTokens(arabic)).toBe(Math.ceil((latinJson.length - 8) / 4 + 8 / 2));
    expect(estimateCanonicalJsonTokens(arabic) - estimateCanonicalJsonTokens(latin)).toBe(2);
  });

  it('leaves characters outside the Arabic block at four per token', () => {
    // U+05FF and U+0700 sit just outside U+0600–U+06FF.
    const value = { edges: '\u05ff\u0700', emoji: '🙂' };

    expect(estimateCanonicalJsonTokens(value)).toBe(
      Math.ceil(canonicalJsonStringify(value).length / 4),
    );
  });

  it('refuses a top-level value that JSON cannot serialize', () => {
    expect(() => canonicalJsonStringify(undefined)).toThrow(/canonical JSON/i);
  });
});
