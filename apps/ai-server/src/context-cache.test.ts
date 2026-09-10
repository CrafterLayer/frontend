import { describe, expect, it } from 'vitest';

import {
  cacheKey,
  createAgentCaches,
  createBoundedCache,
  stablePromptPrefix,
} from './context-cache';

describe('agent context caches', () => {
  it('keeps prompt, context, and component keys independent', () => {
    const caches = createAgentCaches();
    expect(caches.prompt.cache.key({ id: 1 })).not.toBe(caches.context.key({ id: 1 }));
    expect(caches.context.key({ id: 1 })).not.toBe(caches.component.key({ id: 1 }));
  });

  it('produces stable keys across object insertion order', () => {
    expect(cacheKey('context', { a: 1, b: 2 })).toBe(cacheKey('context', { b: 2, a: 1 }));
  });

  it('puts stable rules before volatile context and excludes the request', () => {
    const prefix = stablePromptPrefix({
      policyVersion: 'policy-1',
      roleRules: 'Use tools.',
      toolSchemas: { edit: { type: 'object' } },
      runtimeProfile: { id: 'react-v1' },
      designSystemContract: { tokens: ['accent'] },
    });
    expect(prefix.indexOf('Use tools.')).toBeLessThan(prefix.indexOf('react-v1'));
    expect(prefix).not.toContain('current request');
  });

  it('reports real hits, misses, eviction, and expiry', () => {
    let now = 0;
    const cache = createBoundedCache<string>({
      namespace: 'context',
      maxEntries: 1,
      ttlMs: 10,
      now: () => now,
    });
    cache.set('one', 'first');
    expect(cache.get('one')).toBe('first');
    expect(cache.get('missing')).toBeUndefined();
    cache.set('two', 'second');
    now = 11;
    expect(cache.get('two')).toBeUndefined();
    expect(cache.metrics()).toEqual({
      reads: 3,
      hits: 1,
      misses: 2,
      writes: 2,
      evictions: 1,
      expirations: 1,
    });
  });

  it('does not turn unknown provider cache usage into zero', () => {
    const meter = createAgentCaches().prompt;
    meter.recordProviderUsage({ inputTokens: 10, cacheReadTokens: 5, cacheWriteTokens: 2 });
    meter.recordProviderUsage({ inputTokens: null, cacheReadTokens: null, cacheWriteTokens: null });
    expect(meter.metrics()).toMatchObject({
      ordinaryInputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      unknownReports: 1,
    });
  });
});
