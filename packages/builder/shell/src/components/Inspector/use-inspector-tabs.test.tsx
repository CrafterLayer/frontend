import type { KeyboardEvent } from 'react';

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DocumentDirection, InspectorTabModel } from './types';
import { useInspectorTabs } from './use-inspector-tabs';

const TABS: readonly InspectorTabModel[] = [
  { id: 'content', label: 'Content', sections: [] },
  { id: 'design', label: 'Design', sections: [] },
  { id: 'advanced', label: 'Advanced', sections: [] },
];

const key = (name: string) => {
  const preventDefault = vi.fn();
  return {
    event: { key: name, preventDefault } as unknown as KeyboardEvent<HTMLButtonElement>,
    preventDefault,
  };
};

function mount(initial: {
  scope: string;
  dir: DocumentDirection;
  tabs?: readonly InspectorTabModel[];
}) {
  return renderHook(
    ({
      scope,
      dir,
      tabs,
    }: {
      scope: string;
      dir: DocumentDirection;
      tabs: readonly InspectorTabModel[];
    }) => useInspectorTabs({ tabs, scope, dir, idPrefix: 'p' }),
    { initialProps: { tabs: TABS, ...initial } },
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useInspectorTabs', () => {
  it('starts on Content, mounts only the active body, and grows the visited set', () => {
    const view = mount({ scope: 'n1:base', dir: 'ltr' });
    expect(view.result.current.activeTab?.id).toBe('content');
    expect(view.result.current.isMounted('content')).toBe(true);
    expect(view.result.current.isMounted('design')).toBe(false);
    expect(view.result.current.tabId('design')).toBe('p-design-tab');
    expect(view.result.current.panelId('design')).toBe('p-design-panel');

    act(() => {
      view.result.current.selectTab('design');
    });
    expect(view.result.current.activeTab?.id).toBe('design');
    expect(view.result.current.isMounted('content')).toBe(true);
    expect(view.result.current.isMounted('design')).toBe(true);
    expect(view.result.current.isMounted('advanced')).toBe(false);

    act(() => {
      view.result.current.selectTab('content');
    });
    expect(view.result.current.activeTab?.id).toBe('content');
    expect(view.result.current.isMounted('design')).toBe(true);
  });

  it('resets to Content and forgets the visited set when the scope changes', () => {
    const view = mount({ scope: 'n1:base', dir: 'ltr' });
    act(() => {
      view.result.current.selectTab('advanced');
    });
    view.rerender({ tabs: TABS, scope: 'n2:base', dir: 'ltr' });
    expect(view.result.current.activeTab?.id).toBe('content');
    expect(view.result.current.isMounted('advanced')).toBe(false);
    expect(view.result.current.isMounted('content')).toBe(true);
  });

  it('falls back to the first populated tab when Content has no rows', () => {
    const view = mount({ scope: 'n1:base', dir: 'ltr', tabs: TABS.slice(1) });
    expect(view.result.current.activeTab?.id).toBe('design');
    expect(view.result.current.isMounted('design')).toBe(true);
  });

  it('moves with wraparound, Home and End, and focuses the bound element', () => {
    const view = mount({ scope: 'n1:base', dir: 'ltr' });
    const buttons = new Map<string, HTMLButtonElement>();
    for (const tab of TABS) {
      const button = document.createElement('button');
      document.body.append(button);
      buttons.set(tab.id, button);
      view.result.current.bindTab(tab.id)(button);
    }

    const right = key('ArrowRight');
    act(() => {
      view.result.current.onTabKeyDown(right.event, 'content');
    });
    expect(right.preventDefault).toHaveBeenCalledTimes(1);
    expect(view.result.current.activeTab?.id).toBe('design');
    expect(document.activeElement).toBe(buttons.get('design'));

    act(() => {
      view.result.current.onTabKeyDown(key('End').event, 'design');
    });
    expect(view.result.current.activeTab?.id).toBe('advanced');
    act(() => {
      view.result.current.onTabKeyDown(key('ArrowRight').event, 'advanced');
    });
    expect(view.result.current.activeTab?.id).toBe('content');
    act(() => {
      view.result.current.onTabKeyDown(key('ArrowLeft').event, 'content');
    });
    expect(view.result.current.activeTab?.id).toBe('advanced');
    expect(document.activeElement).toBe(buttons.get('advanced'));
    act(() => {
      view.result.current.onTabKeyDown(key('Home').event, 'advanced');
    });
    expect(view.result.current.activeTab?.id).toBe('content');
  });

  it('mirrors ArrowLeft/ArrowRight under rtl', () => {
    const view = mount({ scope: 'n1:base', dir: 'rtl' });
    act(() => {
      view.result.current.onTabKeyDown(key('ArrowLeft').event, 'content');
    });
    expect(view.result.current.activeTab?.id).toBe('design');
    act(() => {
      view.result.current.onTabKeyDown(key('ArrowRight').event, 'design');
    });
    expect(view.result.current.activeTab?.id).toBe('content');
  });

  it('leaves an unknown key alone', () => {
    const view = mount({ scope: 'n1:base', dir: 'ltr' });
    const tab = key('Tab');
    act(() => {
      view.result.current.onTabKeyDown(tab.event, 'content');
    });
    expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(view.result.current.activeTab?.id).toBe('content');
  });

  it('hands out one binder per tab', () => {
    const view = mount({ scope: 'n1:base', dir: 'ltr' });
    expect(view.result.current.bindTab('design')).toBe(view.result.current.bindTab('design'));
  });
});
