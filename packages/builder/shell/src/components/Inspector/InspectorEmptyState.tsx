import { EMPTY_STATE_COPY } from './constants';
import { INSPECTOR_ICONS } from './Inspector.icons';
import type { InspectorEmptyCopy } from './Inspector.labels';

export type InspectorEmptyStateKind = keyof typeof EMPTY_STATE_COPY;

/**
 * The three ways the panel has nothing to edit. An unregistered type is NOT
 * "nothing to edit" — it says what happened, in a warning tone. `copy` is the
 * editor language's wording (arabic-editor); English by default.
 */
export function InspectorEmptyState({
  kind,
  copy = EMPTY_STATE_COPY,
}: {
  readonly kind: InspectorEmptyStateKind;
  readonly copy?: InspectorEmptyCopy | undefined;
}) {
  if (kind === 'invitation') {
    return (
      <div className="bldr-inspector__invitation">
        <span className="bldr-inspector__invitation-icon">{INSPECTOR_ICONS.invitation}</span>
        <p className="bldr-inspector__empty">{copy.invitation}</p>
      </div>
    );
  }
  return (
    <p
      className="bldr-inspector__empty"
      data-tone={kind === 'unknown-type' ? 'warning' : undefined}
    >
      {copy[kind]}
    </p>
  );
}
