import { useId } from 'react';
import type { ReactNode } from 'react';

import './StyleSector.css';

export interface StyleSectorProps {
  readonly title: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}

/**
 * One collapsible sector of the style panel (Layout, Spacing, Typography…).
 * A disclosure button with `aria-expanded` that controls a labelled region;
 * a collapsed sector unmounts its rows, so twelve sectors cost nothing until
 * opened.
 */
export function StyleSector({ title, expanded, onToggle, children }: StyleSectorProps) {
  const regionId = useId();
  return (
    <section className="bldr-style-sector" data-expanded={expanded ? '' : undefined}>
      <h3 className="bldr-style-sector__heading">
        <button
          type="button"
          className="bldr-style-sector__toggle"
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={onToggle}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="bldr-style-sector__chevron">
            <path d="M6 4l4 4-4 4" />
          </svg>
          {title}
        </button>
      </h3>
      {expanded ? (
        <div id={regionId} role="region" aria-label={title} className="bldr-style-sector__rows">
          {children}
        </div>
      ) : null}
    </section>
  );
}
