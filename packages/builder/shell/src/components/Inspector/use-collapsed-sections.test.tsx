import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCollapsedSections } from './use-collapsed-sections';

describe('useCollapsedSections', () => {
  it('toggles a key on and off, independently of other keys', () => {
    const view = renderHook(() => useCollapsedSections());
    expect(view.result.current.isCollapsed('a')).toBe(false);
    act(() => {
      view.result.current.toggle('a');
    });
    expect(view.result.current.isCollapsed('a')).toBe(true);
    expect(view.result.current.isCollapsed('b')).toBe(false);
    act(() => {
      view.result.current.toggle('b');
    });
    expect(view.result.current.isCollapsed('a')).toBe(true);
    expect(view.result.current.isCollapsed('b')).toBe(true);
    act(() => {
      view.result.current.toggle('a');
    });
    expect(view.result.current.isCollapsed('a')).toBe(false);
    expect(view.result.current.isCollapsed('b')).toBe(true);
  });

  it('keeps one toggle identity across renders', () => {
    const view = renderHook(() => useCollapsedSections());
    const toggle = view.result.current.toggle;
    act(() => {
      toggle('x');
    });
    view.rerender();
    expect(view.result.current.toggle).toBe(toggle);
  });
});
