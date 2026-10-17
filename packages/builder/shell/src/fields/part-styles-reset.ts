import type { z } from 'zod';

import {
  partStylesKeyOf,
  planPartDir,
  readPartStyles,
  type BlockParts,
  type JsonValue,
  type Node,
  type PartPlan,
  type PartRef,
} from '@craftkit/builder-schema';

/** `'item.title@2'` → `{ part: 'item.title', index: [2] }`; `'heading'` → no index. */
export function partRefOfStyleKey(key: string): PartRef {
  const at = key.indexOf('@');
  if (at < 0) return { part: key, index: [] };
  return {
    part: key.slice(0, at),
    index: key
      .slice(at + 1)
      .split('.')
      .map((segment) => Number(segment))
      .filter((n) => Number.isInteger(n) && n >= 0),
  };
}

/** The display name of a style key: the part's localized label, plus a 1-based ordinal. */
export function partStyleKeyLabel(
  key: string,
  parts: BlockParts | undefined,
  locale: 'en' | 'ar',
): string {
  const ref = partRefOfStyleKey(key);
  const decl = parts !== undefined && Object.hasOwn(parts, ref.part) ? parts[ref.part] : undefined;
  const name = decl?.label[locale] ?? ref.part;
  return ref.index.length === 0 ? name : `${name} ${ref.index.map((n) => String(n + 1)).join('.')}`;
}

/**
 * Reset one part's own style — its classes AND its direction — as ONE
 * transaction (one setProp of the block's `partStyles` key).
 *
 * An entry holding only a direction goes through `planPartDir(…, null)`, the
 * same planner the Direction control uses. An entry with classes has no
 * single-intent equivalent in `planPartStyle` (it adds or removes one
 * property's classes; it does not know which properties made the stored
 * list), so the entry is removed in one step with the planners' label form:
 * "Reset style · Hero heading".
 */
export function planPartStyleReset(
  node: Node,
  propsSchema: z.ZodType,
  key: string,
  blockName: string,
  partLabel: string,
): PartPlan {
  const propKey = partStylesKeyOf(propsSchema);
  if (propKey === undefined) {
    return { ok: false, message: `${blockName} has no partStyles prop · nothing to reset` };
  }
  const styles = readPartStyles(node.props, propKey);
  const entry = styles[key];
  if (entry === undefined) {
    return { ok: false, message: `${partLabel} has no style of its own · nothing to reset` };
  }
  const hasClasses = entry.className !== undefined && entry.className.trim() !== '';
  if (!hasClasses && entry.dir !== undefined) {
    // planPartDir writes `partStyleKey(ref, 'this')`, which is `key` itself
    // for both shapes (`name` and `name@i`), and drops the emptied entry.
    return planPartDir(node, propsSchema, partRefOfStyleKey(key), null, blockName);
  }
  const raw = node.props[propKey];
  const next: Record<string, unknown> = {};
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    for (const [styleKey, value] of Object.entries(raw as Record<string, unknown>)) {
      if (styleKey !== key) next[styleKey] = value;
    }
  }
  return {
    ok: true,
    steps: [{ command: 'setProp', args: { id: node.id, key: propKey, value: next as JsonValue } }],
    label: `Reset style · ${blockName} ${partLabel}`.slice(0, 160),
  };
}
