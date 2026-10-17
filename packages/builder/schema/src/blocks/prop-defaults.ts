import type { z } from 'zod';

import type { JsonValue } from '../json/json-value';

/**
 * The default values a block schema declares for props a document omits.
 *
 * ## Why this exists
 *
 * A block schema says `spacing: z.enum(sectionSpacings).default('lg')`, and
 * every reader of that line reasonably assumes a document without `spacing`
 * renders at `lg`. It did not. Nothing on the render path ever parsed props
 * against the schema — `resolveResponsiveProps` returns the stored props merged
 * with breakpoint overrides and stops there — so an omitted prop arrived as
 * `undefined` and was interpolated straight into a class name.
 *
 * Measured in a real browser on the playground's own landing document, that
 * produced eight class names matching no rule at all:
 * `mkt-section--spacing-undefined`, `mkt-section__content--width-undefined`,
 * `mkt-section--tone-undefined`, `mkt-cta--undefined`, and more. The hero's
 * computed block padding was `0px`. Every section on the page was running
 * without the spacing, width, and tone its schema promised.
 *
 * ## Why defaults are FILLED rather than the props PARSED
 *
 * A full `schema.props.parse()` would be the obvious fix and is the wrong one
 * here, for two concrete reasons:
 *
 * 1. **The inline-edit boundary.** In edit mode the renderer replaces one
 *    prop's value with a React element so a block renders its editor exactly
 *    where the text lives. A parse would reject that element and take the whole
 *    canvas down the moment someone clicked into a heading.
 * 2. **Parsing coerces.** A parse does not only add missing keys; it can
 *    transform present ones. Repairing a rendering bug is no reason to start
 *    silently rewriting values a person actually stored.
 *
 * Filling only ABSENT keys is the smallest change that makes the declaration
 * true, and it cannot alter a single value a document already holds.
 */
interface DefaultableDef {
  type: string;
  innerType?: z.ZodType;
  defaultValue?: JsonValue;
  shape?: Record<string, z.ZodType>;
}

function defOf(schema: z.ZodType): DefaultableDef {
  return schema._zod.def;
}

/**
 * The default a single prop schema declares, or `undefined` for none.
 *
 * Wrappers are peeled because `.default('lg').optional()` and
 * `.optional().default('lg')` are both things a schema author writes, and only
 * one of them puts the default on the outside.
 */
function declaredDefault(schema: z.ZodType): JsonValue | undefined {
  let current: z.ZodType | undefined = schema;
  for (let depth = 0; current !== undefined && depth < 8; depth += 1) {
    const def = defOf(current);
    if (def.type === 'default' && def.defaultValue !== undefined) {
      return def.defaultValue;
    }
    if (def.type !== 'optional' && def.type !== 'nullable' && def.type !== 'default') {
      return undefined;
    }
    current = def.innerType;
  }
  return undefined;
}

/*
  Per-SCHEMA cache, keyed by the schema object's identity.

  A block's defaults cannot change while its schema object lives, and this runs
  on the render path for every node on every frame. Walking the shape each time
  is pure waste; a WeakMap keeps the result for exactly as long as the schema
  itself is alive, and a re-registered block is a different object that
  correctly gets its own entry — the same reasoning the shell's field-type
  cache already uses.
*/
const defaultsBySchema = new WeakMap<z.ZodType, Readonly<Record<string, JsonValue>>>();

/**
 * Every default a block's props object declares, keyed by prop name.
 *
 * Returns an empty object for anything that is not a zod object, so a block
 * with an unusual schema loses nothing and breaks nothing. The SAME object is
 * returned for the same schema, so a caller may compare results by identity.
 */
export function blockPropDefaults(props: z.ZodType): Readonly<Record<string, JsonValue>> {
  const cached = defaultsBySchema.get(props);
  if (cached !== undefined) {
    return cached;
  }

  const shape = defOf(props).shape;
  const defaults: Record<string, JsonValue> = {};
  if (shape !== undefined) {
    for (const [key, propSchema] of Object.entries(shape)) {
      const value = declaredDefault(propSchema);
      if (value !== undefined) {
        defaults[key] = value;
      }
    }
  }

  const frozen = Object.freeze(defaults);
  defaultsBySchema.set(props, frozen);
  return frozen;
}

/**
 * Stored props with declared defaults filled in for keys the document omits.
 *
 * A key the document HOLDS always wins, including when it holds `null` — that
 * is a stored decision, not an absence. Returns the original object unchanged
 * when nothing is missing, so an already-complete node re-renders with the same
 * props identity and nothing downstream sees a spurious change.
 */
export function withBlockPropDefaults<T extends Record<string, unknown>>(
  stored: T,
  defaults: Readonly<Record<string, JsonValue>>,
): T {
  const missing = Object.keys(defaults).filter((key) => !Object.hasOwn(stored, key));
  if (missing.length === 0) {
    return stored;
  }

  const filled: Record<string, unknown> = { ...stored };
  for (const key of missing) {
    filled[key] = defaults[key];
  }
  return filled as T;
}
