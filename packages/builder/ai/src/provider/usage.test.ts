import { describe, expect, it, vi } from 'vitest';
import { notifyProviderUsage, readProviderUsage } from './usage';

describe('measured provider usage', () => {
  it('keeps absent, invalid and unbounded counts unknown', () => {
    expect(
      readProviderUsage({
        inputTokens: 19,
        outputTokens: -1,
        cacheReadTokens: 1.5,
        cacheWriteTokens: Number.MAX_SAFE_INTEGER,
        costUsd: Infinity,
      }),
    ).toEqual({
      inputTokens: 19,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      costUsd: null,
    });
    expect(readProviderUsage(null)).toBeUndefined();
  });
  it('contains observer failures and accepts measured zero', () => {
    const observer = vi.fn(() => {
      throw new Error('host observer');
    });
    expect(() => {
      notifyProviderUsage(observer, { inputTokens: 0 });
    }).not.toThrow();
    expect(observer).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 0, outputTokens: null }),
    );
  });
  it('keeps the server’s reason the cache was written, and drops a reason it does not know', () => {
    const base = { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 9 };
    expect(
      readProviderUsage({
        ...base,
        cacheMiss: { reason: 'skills', missedTokens: 1300, source: 'api' },
      })?.cacheMiss,
    ).toEqual({ reason: 'skills', missedTokens: 1300, source: 'api' });
    expect(
      readProviderUsage({ ...base, cacheMiss: { reason: 'first', missedTokens: -2 } })?.cacheMiss,
    ).toEqual({ reason: 'first', missedTokens: null, source: 'local' });
    expect(readProviderUsage({ ...base, cacheMiss: { reason: '<script>' } })).not.toHaveProperty(
      'cacheMiss',
    );
  });
});
