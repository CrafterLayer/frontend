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

/** Displays under which `flex-direction` / `flex-wrap` do nothing (hidden and contents keep them for later). */
const NOT_FLEX = new Set(['block', 'grid', 'inline', 'inline-block', 'inline-grid', 'flow-root']);

/**
 * A Display change away from flex also clears the flex-only properties at the
 * same bucket and state, in the SAME write (one transaction, one Undo).
 * Choosing Grid on a `flex flex-col` card left `grid flex-col`: a dead class
 * the panel kept showing as a live Direction.
 */
export function withDisplayCleanup(edits: readonly StyleEdit[]): readonly StyleEdit[] {
  const leavesFlex = edits.some(
    ({ property, value }) =>
      property === 'display' && value?.kind === 'keyword' && NOT_FLEX.has(value.keyword),
  );
  if (!leavesFlex) return edits;
  const touched = new Set(edits.map(({ property }) => property));
  const clears = (['flexDirection', 'flexWrap'] as const)
    .filter((property) => !touched.has(property))
    .map((property) => ({ property, value: null }));
  return [...edits, ...clears];
}
