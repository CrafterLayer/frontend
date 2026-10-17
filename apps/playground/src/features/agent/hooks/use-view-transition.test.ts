/**
 * The plan-to-build morph's two fallbacks (SPEC §5 moment 4, §7.4
 * `hooks/use-view-transition.ts`): the update always runs exactly once; inside
 * `startViewTransition` when the browser has it and motion is welcome, directly under
 * reduced motion or without the API, and directly when the browser refuses to start one.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runViewTransition, useViewTransition } from './use-view-transition';

type Start = (update: () => void) => unknown;

function install(start: Start | undefined): void {
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    writable: true,
    value: start,
  });
}

/** jsdom has no `matchMedia`: install one answering the reduced-motion query. */
function prefersReducedMotion(reduce: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        matches: reduce && query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}

afterEach(() => {
  install(undefined);
  Reflect.deleteProperty(window, 'matchMedia');
  vi.restoreAllMocks();
});

describe('runViewTransition', () => {
  it('applies the update directly where the browser has no view transitions', () => {
    install(undefined);
    const update = vi.fn();
    runViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('runs the update inside the transition, once, when motion is welcome', () => {
    prefersReducedMotion(false);
    const callbacks: (() => void)[] = [];
    install((callback) => {
      callbacks.push(callback);
      return { ready: Promise.resolve(), finished: Promise.resolve() };
    });
    const update = vi.fn();
    runViewTransition(update);
    // The browser calls back after it captured the old snapshot, not synchronously.
    expect(update).not.toHaveBeenCalled();
    callbacks[0]?.();
    callbacks[0]?.();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('skips the transition under reduced motion and swaps at once', () => {
    prefersReducedMotion(true);
    const start = vi.fn();
    install(start);
    const update = vi.fn();
    runViewTransition(update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('still applies the update when the browser refuses to start a transition', () => {
    prefersReducedMotion(false);
    install(() => {
      throw new Error('InvalidStateError');
    });
    const update = vi.fn();
    runViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('observes a skipped transition’s rejected promises', async () => {
    prefersReducedMotion(false);
    const rejected = Promise.reject(new Error('skipped'));
    install((callback) => {
      callback();
      return { ready: rejected, finished: rejected };
    });
    const update = vi.fn();
    runViewTransition(update);
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('useViewTransition', () => {
  it('hands out one stable function', () => {
    const { result, rerender } = renderHook(() => useViewTransition());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
