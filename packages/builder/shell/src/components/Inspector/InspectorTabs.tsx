import type { KeyboardEvent } from 'react';

import type { BlockPropertyTab } from '@craftkit/builder-schema';

import type { InspectorTabModel } from './types';

export interface InspectorTabsProps {
  readonly tabs: readonly InspectorTabModel[];
  readonly activeTabId: BlockPropertyTab | undefined;
  readonly tabId: (id: BlockPropertyTab) => string;
  readonly panelId: (id: BlockPropertyTab) => string;
  readonly onSelect: (id: BlockPropertyTab) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, id: BlockPropertyTab) => void;
  readonly bindTab: (id: BlockPropertyTab) => (element: HTMLButtonElement | null) => void;
}

/** The strip: a roving-tabindex tablist whose tabs control their panels by id. */
export function InspectorTabs({
  tabs,
  activeTabId,
  tabId,
  panelId,
  onSelect,
  onKeyDown,
  bindTab,
}: InspectorTabsProps) {
  return (
    <div className="bldr-inspector__tabs" role="tablist" aria-label="Inspector tabs">
      {tabs.map((tab) => {
        const selected = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            ref={bindTab(tab.id)}
            id={tabId(tab.id)}
            type="button"
            className="bldr-inspector__tab"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onSelect(tab.id);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, tab.id);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
