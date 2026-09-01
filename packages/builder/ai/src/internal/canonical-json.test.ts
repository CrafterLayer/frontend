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

  it('refuses a top-level value that JSON cannot serialize', () => {
    expect(() => canonicalJsonStringify(undefined)).toThrow(/canonical JSON/i);
  });
});
