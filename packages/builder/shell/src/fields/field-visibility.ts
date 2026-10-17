import type { z } from 'zod';

import type { FieldRowState, FieldSibling, FieldTypeDef } from '@craftkit/builder-schema';

/**
 * A row's sibling props, in declaration order: every prop of `shape` except
 * `ownKey`, with its schema (so a field finds what it needs by MARKER) and its
 * stored value. `values` is the node's base `props`.
 */
export function fieldSiblingsOf(
  shape: Readonly<Record<string, z.ZodType>>,
  values: Readonly<Record<string, unknown>> | undefined,
  ownKey: string,
): readonly FieldSibling[] {
  return Object.entries(shape)
    .filter(([key]) => key !== ownKey)
    .map(([key, schema]) => ({ key, schema, value: values?.[key] }));
}

/**
 * Whether a field type's `hidden` rule leaves this row out. The row state is
 * built lazily, so a static rule (or none) costs nothing; a rule that throws
 * keeps the row — a broken contribution must never take a control away.
 */
export function isFieldRowHidden(rule: FieldTypeDef['hidden'], row: () => FieldRowState): boolean {
  if (rule === undefined || typeof rule === 'boolean') return rule === true;
  try {
    return rule(row());
  } catch {
    return false;
  }
}
