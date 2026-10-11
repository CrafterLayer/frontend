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
});
