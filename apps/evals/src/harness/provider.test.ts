import { describe, expect, it } from 'vitest';

import { DEFAULT_LIVE_ENDPOINT, resolveEvalMode, resolveLiveEndpoint } from './provider';

describe('mode resolution', () => {
  it('defaults to offline, so nothing in CI ever reaches the network by accident', () => {
    expect(resolveEvalMode({})).toBe('offline');
    expect(resolveEvalMode({ CRAFTKIT_EVAL_MODE: 'anything-else' })).toBe('offline');
  });

  it('goes live only on an explicit opt-in', () => {
    expect(resolveEvalMode({ CRAFTKIT_EVAL_MODE: 'live' })).toBe('live');
  });
});

describe('endpoint resolution', () => {
  it('prefers the playground’s own variable so one setting drives both', () => {
    expect(resolveLiveEndpoint({ VITE_AI_PLAN_ENDPOINT: 'https://example.test/ai/plan' })).toBe(
      'https://example.test/ai/plan',
    );
  });

  it('accepts an eval-specific override', () => {
    expect(resolveLiveEndpoint({ CRAFTKIT_AI_PLAN_ENDPOINT: 'https://other.test/plan' })).toBe(
      'https://other.test/plan',
    );
  });

  it('falls back to the local ai-server', () => {
    expect(resolveLiveEndpoint({})).toBe(DEFAULT_LIVE_ENDPOINT);
  });
});
