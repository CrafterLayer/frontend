import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIVE_ENDPOINT,
  LIVE_TIMEOUT_MS,
  resolveEvalMode,
  resolveLiveEndpoint,
} from './provider';

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

describe('the live deadline', () => {
  it('allows a real plan the time a real plan takes', () => {
    /*
      Pinned, not incidental. At five minutes — what this was — a live eval
      aborted healthy runs and recorded them as provider failures, so the
      harness would have reported the assistant failing at precisely the cases
      that take longest. Eleven minutes matches the playground's own deadline
      and sits just above the server's ten-minute cap, so a genuine timeout is
      reported by the side that knows why. Lowering this number is a decision
      about what the harness is allowed to measure, and it should have to edit
      this line to make it.
    */
    expect(LIVE_TIMEOUT_MS).toBe(660_000);
  });
});
