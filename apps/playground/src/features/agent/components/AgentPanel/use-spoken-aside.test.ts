/**
 * useSpokenAside (2026-10-12): a panel control speaks through the panel's one live region.
 * Ours to prove: each `say` is a new numbered aside, `say` keeps its identity (a control's
 * effect depends on it), and a new run announcement takes the region back.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AnnouncementView } from '../../model/view-types';

import { useSpokenAside } from './use-spoken-aside';

const FIRST: AnnouncementView = { key: 'build.done', params: { n: 2 }, seq: 1 };
const NEXT: AnnouncementView = { key: 'build.done', params: { n: 3 }, seq: 2 };

describe('useSpokenAside', () => {
  it('numbers each aside and keeps say stable', () => {
    const { result } = renderHook(() => useSpokenAside(FIRST));
    const [, say] = result.current;
    act(() => {
      say('Saved');
    });
    expect(result.current[0]).toEqual({ seq: 1, text: 'Saved' });
    act(() => {
      say('Saved');
    });
    expect(result.current[0]).toEqual({ seq: 2, text: 'Saved' });
    expect(result.current[1]).toBe(say);
  });

  it('hands the region back to a new announcement', () => {
    const { result, rerender } = renderHook(({ now }) => useSpokenAside(now), {
      initialProps: { now: FIRST },
    });
    act(() => {
      result.current[1]('Saved');
    });
    rerender({ now: FIRST });
    expect(result.current[0]).not.toBeNull();
    rerender({ now: NEXT });
    expect(result.current[0]).toBeNull();
  });
});
