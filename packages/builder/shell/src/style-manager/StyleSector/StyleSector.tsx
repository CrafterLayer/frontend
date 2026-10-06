import { useId } from 'react';
import type { ReactNode } from 'react';

import './StyleSector.css';

export interface StyleSectorProps {
  readonly title: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
  /** The sector's catalogue id, stamped as `data-sector` so a host can scroll to it. */
  readonly sectorId?: string | undefined;
  /** How many of its properties are set at the current bucket and state; 0 shows nothing. */
  readonly count?: number | undefined;
  /** The count read aloud as the toggle's description: "2 set here". */
  readonly countLabel?: string | undefined;
}

/**
 * One collapsible sector of the style panel (Layout, Spacing, Typography…).
 * A disclosure button with `aria-expanded` that controls a labelled region,
 * and a count of the values set here, so a collapsed sector still says
 * whether it holds anything;
 * a collapsed sector unmounts its rows, so twelve sectors cost nothing until
 * opened.
 */
export function StyleSector({
  title,
  expanded,
  onToggle,
  children,
  sectorId,
  count = 0,
  countLabel,
}: StyleSectorProps) {
  const regionId = useId();
  const countId = useId();
  const counted = count > 0;
  return (
    <section
      className="bldr-style-sector"
      data-expanded={expanded ? '' : undefined}
      data-sector={sectorId}
      data-set={counted ? '' : undefined}
    >
      <h3 className="bldr-style-sector__heading">
        <button
          type="button"
          className="bldr-style-sector__toggle"
          aria-expanded={expanded}
          aria-controls={regionId}
          aria-describedby={counted && countLabel !== undefined ? countId : undefined}
          onClick={onToggle}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="bldr-style-sector__chevron">
            <path d="M6 4l4 4-4 4" />
          </svg>
          <span className="bldr-style-sector__title">{title}</span>
          {counted ? (
            <span className="bldr-style-sector__count" aria-hidden="true">
              {count}
            </span>
          ) : null}
        </button>
        {counted && countLabel !== undefined ? (
          <span id={countId} hidden>
            {countLabel}
          </span>
        ) : null}
      </h3>
      {expanded ? (
        <div id={regionId} role="region" aria-label={title} className="bldr-style-sector__rows">
          {children}
        </div>
      ) : null}
    </section>
  );
}
