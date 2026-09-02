import { EMPTY_STATE_COPY } from './constants';
import { INSPECTOR_ICONS } from './Inspector.icons';

export type InspectorEmptyStateKind = keyof typeof EMPTY_STATE_COPY;

/**
 * The three ways the panel has nothing to edit. An unregistered type is NOT
 * "nothing to edit" — it says what happened, in a warning tone.
 */
export function InspectorEmptyState({ kind }: { readonly kind: InspectorEmptyStateKind }) {
  if (kind === 'invitation') {
    return (
      <div className="bldr-inspector__invitation">
        <span className="bldr-inspector__invitation-icon">{INSPECTOR_ICONS.invitation}</span>
        <p className="bldr-inspector__empty">{EMPTY_STATE_COPY.invitation}</p>
      </div>
    );
  }
  return (
    <p
      className="bldr-inspector__empty"
      data-tone={kind === 'unknown-type' ? 'warning' : undefined}
    >
      {EMPTY_STATE_COPY[kind]}
    </p>
  );
}
