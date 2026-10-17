import { useRef } from 'react';

import './StylePanelFilter.css';

export interface StylePanelFilterLabels {
  /** The field's accessible name: "Filter properties". */
  readonly filter: string;
  readonly filterPlaceholder: string;
  readonly clearFilter: string;
}

export interface StylePanelFilterProps {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly labels: StylePanelFilterLabels;
}

/**
 * The style panel's property filter (style-manager panel design): type
 * "rad" and only Corner radius is left, its sector open. It matches either
 * language, so an Arabic editor can find "الحشوة" and an English one
 * "padding" on the same page. Escape clears it; the clear button returns
 * focus to the field.
 */
export function StylePanelFilter({ query, onQueryChange, labels }: StylePanelFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="bldr-style-panel-filter" data-filled={query === '' ? undefined : ''}>
      <svg className="bldr-style-panel-filter__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M3 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0" />
        <path d="M10 10l3.5 3.5" />
      </svg>
      <input
        ref={inputRef}
        className="bldr-style-panel-filter__input"
        type="search"
        aria-label={labels.filter}
        placeholder={labels.filterPlaceholder}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && query !== '') {
            event.preventDefault();
            event.stopPropagation();
            onQueryChange('');
          }
        }}
      />
      {query === '' ? null : (
        <button
          type="button"
          className="bldr-style-panel-filter__clear"
          aria-label={labels.clearFilter}
          title={labels.clearFilter}
          onClick={() => {
            onQueryChange('');
            inputRef.current?.focus();
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M4.5 4.5l7 7" />
            <path d="M11.5 4.5l-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
