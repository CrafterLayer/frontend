import type { z } from 'zod';

import { propsShapeOf, unwrapSchema } from '../../fields/resolve-field';

/** The row's prop path relative to `props` (indices as numbers), for part bindings. */
export function relativePropPath(fieldPath: readonly (string | number)[]): (string | number)[] {
  if (fieldPath[0] === 'props') return fieldPath.slice(1);
  if (fieldPath[0] === 'responsive') return fieldPath.slice(2);
  return [...fieldPath];
}

/** Which object keys a LinkField edits, for a row the block declares `kind: 'link'`. */
export function declaredLinkKeys(schema: z.ZodType): { textKey?: string; hrefKey: string } {
  const keys = Object.keys(propsShapeOf(unwrapSchema(schema)));
  const textKey = ['label', 'text', 'title'].find((key) => keys.includes(key));
  const hrefKey = ['href', 'url', 'link'].find((key) => keys.includes(key)) ?? 'href';
  return textKey === undefined ? { hrefKey } : { textKey, hrefKey };
}

/** An inherited scalar as the placeholder text a text or number control shows. */
export function placeholderOf(baseValue: unknown): string | undefined {
  if (typeof baseValue === 'string') return baseValue;
  if (typeof baseValue === 'number' || typeof baseValue === 'boolean') return String(baseValue);
  return undefined;
}
