import { InspectorPropertyRow } from './InspectorPropertyRow';
import type { InspectorRowScope, InspectorSectionEntry } from './types';

export interface InspectorPropertyPairProps {
  readonly entry: Extract<InspectorSectionEntry, { kind: 'pair' }>;
  readonly scope: InspectorRowScope;
}

/** A declared pair: one heading, two labelled cells, each still its own row. */
export function InspectorPropertyPair({ entry, scope }: InspectorPropertyPairProps) {
  return (
    <fieldset className="bldr-inspector__property-pair" data-property-pair={entry.id}>
      <legend className="bldr-inspector__property-pair-label">{entry.label}</legend>
      <div className="bldr-inspector__property-pair-values">
        {entry.properties.map(({ property: [propKey, schema], pair }) => (
          <InspectorPropertyRow
            key={`${scope.nodeId}:${scope.bucket}:${propKey}`}
            scope={scope}
            propKey={propKey}
            schema={schema}
            pairItemLabel={pair.cellLabel}
          />
        ))}
      </div>
    </fieldset>
  );
}
