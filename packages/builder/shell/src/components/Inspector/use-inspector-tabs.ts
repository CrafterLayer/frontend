import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

import type { BlockPropertyTab } from '@craftkit/builder-schema';

import { logicalArrowKey, resolveChromeDir } from '../../i18n/editor-locale';
import type { DocumentDirection, InspectorTabModel } from './types';

export interface InspectorTabsOptions {
  readonly tabs: readonly InspectorTabModel[];
  /** `${nodeId}:${bucket}` — a new scope resets to Content and forgets what was visited. */
  readonly scope: string;
  readonly dir: DocumentDirection;
  readonly idPrefix: string;
}

export interface InspectorTabsState {
  readonly activeTab: InspectorTabModel | undefined;
  /** Lazy-once: a tab's body mounts on its first activation and stays mounted. */
  readonly isMounted: (id: BlockPropertyTab) => boolean;
  readonly tabId: (id: BlockPropertyTab) => string;
  readonly panelId: (id: BlockPropertyTab) => string;
  readonly selectTab: (id: BlockPropertyTab) => void;
  readonly onTabKeyDown: (event: KeyboardEvent<HTMLButtonElement>, id: BlockPropertyTab) => void;
  readonly bindTab: (id: BlockPropertyTab) => (element: HTMLButtonElement | null) => void;
}

interface TabState {
  readonly scope: string;
  readonly tab: BlockPropertyTab;
  readonly visited: readonly BlockPropertyTab[];
}

/**
 * Tab-strip state for the panel: which tab is active, which bodies have ever
 * been shown (so they stay mounted), and the roving-focus keyboard model.
 * Arrow keys mirror under RTL because the strip is laid out logically: "left"
 * must mean "towards the start of the strip as drawn".
 */
export function useInspectorTabs({
  tabs,
  scope,
  dir,
  idPrefix,
}: InspectorTabsOptions): InspectorTabsState {
  const [state, setState] = useState<TabState>({ scope: '', tab: 'content', visited: [] });
  const refs = useRef(new Map<BlockPropertyTab, HTMLButtonElement>());
  const binders = useRef(new Map<BlockPropertyTab, (element: HTMLButtonElement | null) => void>());

  const sameScope = state.scope === scope;
  const requested: BlockPropertyTab = sameScope ? state.tab : 'content';
  const visited: readonly BlockPropertyTab[] = sameScope ? state.visited : [];
  const activeTab = tabs.find((tab) => tab.id === requested) ?? tabs.at(0);
  const activeId = activeTab?.id;

  const tabId = useCallback((id: BlockPropertyTab) => `${idPrefix}-${id}-tab`, [idPrefix]);
  const panelId = useCallback((id: BlockPropertyTab) => `${idPrefix}-${id}-panel`, [idPrefix]);

  const selectTab = useCallback(
    (id: BlockPropertyTab) => {
      setState((current) => {
        const keep = current.scope === scope;
        const previous: BlockPropertyTab = keep ? current.tab : 'content';
        const seen = [...(keep ? current.visited : [])];
        for (const candidate of [previous, id]) {
          if (!seen.includes(candidate)) {
            seen.push(candidate);
          }
        }
        return { scope, tab: id, visited: seen };
      });
    },
    [scope],
  );

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: BlockPropertyTab) => {
    // The strip is chrome: its drawn direction is the editor's (the nearest `dir`
    // above it), falling back to the page's when the host sets none.
    const key = logicalArrowKey(
      event.key,
      resolveChromeDir(event.currentTarget, dir === 'rtl' ? 'rtl' : 'ltr'),
    );
    const currentIndex = tabs.findIndex((candidate) => candidate.id === id);
    let nextIndex: number | undefined;

    if (key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (key === 'Home') {
      nextIndex = 0;
    } else if (key === 'End') {
      nextIndex = tabs.length - 1;
    }

    const nextTab = nextIndex === undefined ? undefined : tabs[nextIndex];
    if (nextTab === undefined) {
      return;
    }
    event.preventDefault();
    selectTab(nextTab.id);
    refs.current.get(nextTab.id)?.focus();
  };

  const bindTab = (id: BlockPropertyTab) => {
    let binder = binders.current.get(id);
    if (binder === undefined) {
      binder = (element) => {
        if (element === null) {
          refs.current.delete(id);
        } else {
          refs.current.set(id, element);
        }
      };
      binders.current.set(id, binder);
    }
    return binder;
  };

  return {
    activeTab,
    isMounted: (id) => id === activeId || visited.includes(id),
    tabId,
    panelId,
    selectTab,
    onTabKeyDown,
    bindTab,
  };
}
