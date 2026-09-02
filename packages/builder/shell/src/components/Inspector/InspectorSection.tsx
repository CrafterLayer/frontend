import { memo, useId } from 'react';

import { INSPECTOR_ICONS } from './Inspector.icons';
import { InspectorPropertyPair } from './InspectorPropertyPair';
import { InspectorPropertyRow } from './InspectorPropertyRow';
import type { InspectorRowScope, InspectorSectionModel } from './types';

export interface InspectorSectionProps {
  readonly section: InspectorSectionModel;
  /** `${nodeId}:${bucket}:${tab}:${section}` — what the Inspector's collapsed set is keyed by. */
  readonly collapseKey: string;
  /** Controlled: the Inspector owns the collapsed set and hands each section its own bit. */
  readonly expanded: boolean;
  readonly onToggle: (key: string) => void;
  readonly scope: InspectorRowScope;
}

/**
 * One collapsible section. Memoised with a controlled `expanded` and a stable
 * `onToggle`, so a toggle re-renders the Inspector (cheap) and the toggled
 * section only — every other section, and every row, bails.
 */
export const InspectorSection = memo(function InspectorSection({
  section,
  collapseKey,
  expanded,
  onToggle,
  scope,
}: InspectorSectionProps) {
  const uid = useId();
  const toggleId = `${uid}-toggle`;
  const regionId = `${uid}-region`;
  return (
    <section className="bldr-inspector__section">
      <h3 className="bldr-inspector__section-heading">
        <button
          id={toggleId}
          type="button"
          className="bldr-inspector__section-toggle"
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={() => {
            onToggle(collapseKey);
          }}
        >
          <span className="bldr-inspector__chevron" data-collapsed={expanded ? undefined : 'true'}>
            {INSPECTOR_ICONS.chevron}
          </span>
          <span>{section.name}</span>
        </button>
      </h3>
      <div
        id={regionId}
        className="bldr-inspector__section-region"
        role="region"
        aria-labelledby={toggleId}
        hidden={!expanded}
      >
        <div className="bldr-inspector__rows">
          {section.entries.map((entry) =>
            entry.kind === 'pair' ? (
              <InspectorPropertyPair key={entry.id} entry={entry} scope={scope} />
            ) : (
              <InspectorPropertyRow
                key={`${scope.nodeId}:${scope.bucket}:${entry.property[0]}`}
                scope={scope}
                propKey={entry.property[0]}
                schema={entry.property[1]}
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
});
