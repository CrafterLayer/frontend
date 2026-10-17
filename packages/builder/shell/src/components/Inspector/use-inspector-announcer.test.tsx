import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createAnnouncer, useAnnouncement, useAnnouncer } from './use-inspector-announcer';

describe('createAnnouncer', () => {
  it('increments the nonce on every announcement, repeats included', () => {
    const announcer = createAnnouncer();
    expect(announcer.getSnapshot()).toEqual({ text: '', nonce: 0 });
    announcer.announce('title updated');
    expect(announcer.getSnapshot()).toEqual({ text: 'title updated', nonce: 1 });
    announcer.announce('title updated');
    expect(announcer.getSnapshot()).toEqual({ text: 'title updated', nonce: 2 });
  });

  it('keeps one snapshot identity between announcements', () => {
    const announcer = createAnnouncer();
    announcer.announce('x');
    expect(announcer.getSnapshot()).toBe(announcer.getSnapshot());
  });

  it('notifies each listener exactly once per announcement until it unsubscribes', () => {
    const announcer = createAnnouncer();
    const listener = vi.fn();
    const off = announcer.subscribe(listener);
    announcer.announce('one');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    announcer.announce('two');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('useAnnouncer / useAnnouncement', () => {
  it('holds one announcer per instance and re-renders the subscriber on announce', () => {
    const announcer = renderHook(() => useAnnouncer());
    const first = announcer.result.current;
    announcer.rerender();
    expect(announcer.result.current).toBe(first);

    let renders = 0;
    const reader = renderHook(() => {
      renders += 1;
      return useAnnouncement(first);
    });
    expect(reader.result.current).toEqual({ text: '', nonce: 0 });
    const before = renders;
    act(() => {
      first.announce('slug rejected');
    });
    expect(reader.result.current).toEqual({ text: 'slug rejected', nonce: 1 });
    expect(renders).toBe(before + 1);
  });
});
