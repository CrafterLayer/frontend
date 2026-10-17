/**
 * The canvas link, phase 1 (SPEC §7.4 `hooks/use-canvas-link.ts`): reveal selects through
 * the kernel's own door; a block that is gone (a stale row) or the page root never
 * replaces the person's selection; peek goes to the phase-2 stage only when one is wired.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEditKernel } from '../testing/scripted-engine';
import { useCanvasLink } from './use-canvas-link';

describe('useCanvasLink', () => {
  it('selects a section that is on the page', () => {
    const kernel = createEditKernel();
    const { result } = renderHook(() => useCanvasLink(kernel));
    result.current.reveal('selected-hero');
    expect(kernel.context.store.getState().selection).toEqual(['selected-hero']);
  });

  it('leaves the selection alone for a block that is gone, and for the page root', () => {
    const kernel = createEditKernel();
    kernel.setSelection(['selected-hero']);
    const { result } = renderHook(() => useCanvasLink(kernel));
    result.current.reveal('removed-long-ago');
    result.current.reveal('root');
    expect(kernel.context.store.getState().selection).toEqual(['selected-hero']);
  });

  it('forwards peek to the stage when one is wired, and does nothing otherwise', () => {
    const kernel = createEditKernel();
    const onPeek = vi.fn();
    const wired = renderHook(() => useCanvasLink(kernel, { onPeek }));
    wired.result.current.peek('selected-hero');
    wired.result.current.peek(null);
    expect(onPeek.mock.calls).toEqual([['selected-hero'], [null]]);

    const bare = renderHook(() => useCanvasLink(kernel));
    expect(() => {
      bare.result.current.peek('selected-hero');
    }).not.toThrow();
    expect(kernel.context.store.getState().selection).toEqual([]);
  });
});
