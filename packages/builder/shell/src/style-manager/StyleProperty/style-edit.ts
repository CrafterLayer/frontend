import type {
  StyleBucket,
  StyleIntent,
  StylePropertyId,
  StyleSide,
  StyleState,
  StyleValue,
} from '@craftkit/builder-schema';

/** A control's edit, before the panel adds the bucket and state it applies at. */
export interface StyleEdit {
  readonly property: StylePropertyId;
  readonly value: StyleValue | null;
  readonly side?: StyleSide | undefined;
}

/** Intents for the engine at the panel's bucket and state (hook classes stay at base). */
export function intentsAt(
  edits: readonly StyleEdit[],
  bucket: StyleBucket,
  state: StyleState,
  baseOnly: (property: StylePropertyId) => boolean,
): StyleIntent[] {
  return edits.map((edit) => {
    const at = baseOnly(edit.property)
      ? { bucket: 'base' as const, state: 'default' as const }
      : { bucket, state };
    return edit.side === undefined
      ? { property: edit.property, value: edit.value, ...at }
      : { property: edit.property, value: edit.value, side: edit.side, ...at };
  });
}
