/**
 * The live region's clock (SPEC §4.3, §6.1): the hook feeds `model/agent-status.ts` and
 * owns its one timer. Time is fake and injected, so the 4s coalescing window and the 10s
 * blocked rule are exact.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLiveStatus } from './use-live-status';

let now = 0;

beforeEach(() => {
  vi.useFakeTimers();
  now = 1_000_000;
});

afterEach(() => {
  vi.useRealTimers();
});

function advance(ms: number): void {
  act(() => {
    now += ms;
    vi.advanceTimersByTime(ms);
  });
}

function mount() {
  return renderHook(() => useLiveStatus({ now: () => now }));
}

describe('useLiveStatus', () => {
  it('says an always-announced moment at once, and the same sentence twice is spoken twice', () => {
    const { result } = mount();
    expect(result.current.announcement).toBeNull();
    act(() => {
      result.current.say('queue.queued');
    });
    expect(result.current.announcement).toEqual({ key: 'queue.queued', params: {}, seq: 1 });
    act(() => {
      result.current.say('queue.queued');
    });
    expect(result.current.announcement?.seq).toBe(2);
  });

  it('coalesces landings into one count per window, always the newest', () => {
    const { result } = mount();
    act(() => {
      result.current.say('build.planned', { n: 8 });
    });
    act(() => {
      result.current.landed(1, 8);
    });
    act(() => {
      result.current.landed(2, 8);
    });
    // Held: "Page laid out" is still being spoken.
    expect(result.current.announcement?.key).toBe('build.planned');
    advance(4_000);
    expect(result.current.announcement).toMatchObject({
      key: 'build.progress',
      params: { done: 2, total: 8 },
    });
  });

  it('says "blocked" once, after the episode has lasted 10s', () => {
    const { result } = mount();
    act(() => {
      result.current.status({ statusKey: 'build.blocked', params: { title: 'Hero' } });
    });
    advance(9_000);
    expect(result.current.announcement).toBeNull();
    advance(1_000);
    expect(result.current.announcement).toMatchObject({
      key: 'build.blocked',
      params: { title: 'Hero' },
    });
    advance(20_000);
    expect(result.current.announcement?.seq).toBe(1);
  });

  it('forgets a blocked episode that ends before 10s', () => {
    const { result } = mount();
    act(() => {
      result.current.status({ statusKey: 'build.blocked', params: { title: 'Hero' } });
    });
    advance(5_000);
    act(() => {
      result.current.status({ statusKey: 'build.writing', params: { n: 3 } });
    });
    advance(10_000);
    expect(result.current.announcement).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
