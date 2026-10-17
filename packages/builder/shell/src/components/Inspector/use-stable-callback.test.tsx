import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useStableCallback } from './use-stable-callback';

describe('useStableCallback', () => {
  it('keeps one identity while the function changes, and always invokes the latest one', () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = renderHook(({ fn }: { fn: (role: string) => void }) => useStableCallback(fn), {
      initialProps: { fn: first },
    });
    const stable = view.result.current;
    expect(stable).toBeDefined();
    view.rerender({ fn: second });
    expect(view.result.current).toBe(stable);
    stable?.('accent');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('accent');
  });

  it('answers undefined for undefined and flips identity only on defined-ness', () => {
    const fn = vi.fn();
    const initial: { fn: ((role: string) => void) | undefined } = { fn: undefined };
    const view = renderHook(
      ({ fn: current }: { fn: ((role: string) => void) | undefined }) => useStableCallback(current),
      { initialProps: initial },
    );
    expect(view.result.current).toBeUndefined();
    view.rerender({ fn });
    const defined = view.result.current;
    expect(defined).toBeDefined();
    view.rerender({ fn: vi.fn() });
    expect(view.result.current).toBe(defined);
    view.rerender({ fn: undefined });
    expect(view.result.current).toBeUndefined();
    view.rerender({ fn });
    expect(view.result.current).toBe(defined);
  });
});
