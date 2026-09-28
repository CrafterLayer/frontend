/**
 * The shared clock every RunClock reads (SPEC §7.4 `hooks/use-ticker.ts`, §4.1):
 * - one timer for the whole panel, however many clocks are mounted;
 * - it steps once a second, on the wall clock's whole second, so two clocks never step
 *   out of phase and a clock never shows a second twice or skips one;
 * - it stops while the document is hidden and catches up the moment it is shown;
 * - it stops when the last clock unmounts, and a disabled clock (a finished run's
 *   frozen time) never starts it.
 *
 * Time is fake, so "one second later" is exact and the timer count is observable.
 */
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TICK_MS, TickerPausedContext, useTicker } from './use-ticker';

/** 12:00:00.400 local: 600ms before the next whole second. */
const START = new Date(2026, 8, 28, 12, 0, 0, 400).getTime();
const NEXT_SECOND = new Date(2026, 8, 28, 12, 0, 1, 0).getTime();

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(next: DocumentVisibilityState): void {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTicker', () => {
  it('reads the time on the whole second, before the first tick', () => {
    const { result } = renderHook(() => useTicker());
    // Snapped down to the second: a value that only changes on a tick keeps
    // useSyncExternalStore's snapshot stable between renders.
    expect(result.current).toBe(NEXT_SECOND - TICK_MS);
  });

  it('steps on the next whole second, then once a second', () => {
    const { result } = renderHook(() => useTicker());
    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(result.current).toBe(NEXT_SECOND - TICK_MS);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(NEXT_SECOND);
    act(() => {
      vi.advanceTimersByTime(TICK_MS);
    });
    expect(result.current).toBe(NEXT_SECOND + TICK_MS);
    act(() => {
      vi.advanceTimersByTime(3 * TICK_MS);
    });
    expect(result.current).toBe(NEXT_SECOND + 4 * TICK_MS);
  });

  it('runs one timer for every clock in the panel', () => {
    const first = renderHook(() => useTicker());
    const second = renderHook(() => useTicker());
    const third = renderHook(() => useTicker());
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    // Every clock read the same instant: they step together.
    expect(first.result.current).toBe(NEXT_SECOND);
    expect(second.result.current).toBe(NEXT_SECOND);
    expect(third.result.current).toBe(NEXT_SECOND);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('stops when the last clock unmounts', () => {
    const first = renderHook(() => useTicker());
    const second = renderHook(() => useTicker());
    first.unmount();
    expect(vi.getTimerCount()).toBe(1);
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never starts for a disabled clock', () => {
    const renders = vi.fn();
    renderHook(() => {
      renders();
      return useTicker(false);
    });
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(5 * TICK_MS);
    });
    expect(renders).toHaveBeenCalledTimes(1);
  });

  it('starts when a clock becomes enabled and stops when it is disabled again', () => {
    const { rerender, result } = renderHook(({ enabled }) => useTicker(enabled), {
      initialProps: { enabled: false },
    });
    expect(vi.getTimerCount()).toBe(0);
    rerender({ enabled: true });
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(NEXT_SECOND);
    rerender({ enabled: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses while the document is hidden, and catches up when it is shown', () => {
    const renders = vi.fn();
    const { result } = renderHook(() => {
      renders();
      return useTicker();
    });
    const before = renders.mock.calls.length;

    setVisibility('hidden');
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10 * TICK_MS);
    });
    // Nothing re-rendered while hidden: a background tab spends no work on clocks.
    expect(renders).toHaveBeenCalledTimes(before);

    setVisibility('visible');
    // Shown again: the clock reads the real time at once, not ten seconds late.
    expect(result.current).toBe(NEXT_SECOND - TICK_MS + 10 * TICK_MS);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('does not start a timer when the first clock mounts in a hidden document', () => {
    visibility = 'hidden';
    renderHook(() => useTicker());
    expect(vi.getTimerCount()).toBe(0);
    setVisibility('visible');
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe('TickerPausedContext', () => {
  /** Clocks inside a panel whose `visible` the test controls, as AgentPanel passes it. */
  function inPanel(hidden: { current: boolean }) {
    return ({ children }: { children: ReactNode }) =>
      createElement(TickerPausedContext, { value: hidden.current }, children);
  }

  it('pauses the clocks of a hidden panel, and reads the real time when it is shown', () => {
    // SPEC §4.1: a hidden panel stays mounted and pauses the ticker. Its RunBar is still in
    // the tree, so without this its clock would re-render a panel nobody can see.
    const hidden = { current: false };
    const renders = vi.fn();
    const { result, rerender } = renderHook(
      () => {
        renders();
        return useTicker();
      },
      { wrapper: inPanel(hidden) },
    );
    expect(vi.getTimerCount()).toBe(1);

    hidden.current = true;
    rerender();
    expect(vi.getTimerCount()).toBe(0);
    const whileHidden = renders.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(10 * TICK_MS);
    });
    expect(renders).toHaveBeenCalledTimes(whileHidden);

    hidden.current = false;
    rerender();
    expect(result.current).toBe(NEXT_SECOND - TICK_MS + 10 * TICK_MS);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('leaves a clock outside the hidden panel running on the shared timer', () => {
    const hidden = { current: true };
    renderHook(() => useTicker(), { wrapper: inPanel(hidden) });
    expect(vi.getTimerCount()).toBe(0);

    const outside = renderHook(() => useTicker());
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(outside.result.current).toBe(NEXT_SECOND);
  });
});
