import type { z } from 'zod';

import type { FieldTypeDef, RegistryRead } from '@craftkit/builder-schema';

/**
 * Field resolution (007 contract §1): schema → contributed field type (highest
 * `match(schema)` score > 0, ties by REGISTRATION ORDER) → default control after
 * unwrapping optional/default/nullable → accessible read-only fallback.
 */
export type DefaultControl = 'text' | 'select' | 'switch' | 'number';

export type ResolvedField =
  | { kind: 'contributed'; def: FieldTypeDef }
  | { kind: 'default'; control: DefaultControl }
  | { kind: 'readonly' };

/**
 * The zod-4 introspection surface this module relies on: every schema exposes
 * `_zod.def.type`; wrapper defs carry `innerType`; enum defs carry `entries`.
 */
interface IntrospectableDef {
  type: string;
  innerType?: z.ZodType;
  entries?: Record<string, unknown>;
  shape?: Record<string, z.ZodType>;
}

function defOf(schema: z.ZodType): IntrospectableDef {
  return schema._zod.def;
}

/** Peel optional/default/nullable wrappers down to the core schema (f2). */
export function unwrapSchema(schema: z.ZodType): z.ZodType {
  let current = schema;
  for (;;) {
    const def = defOf(current);
    const isWrapper = def.type === 'optional' || def.type === 'default' || def.type === 'nullable';
    if (!isWrapper || def.innerType === undefined) {
      return current;
    }
    current = def.innerType;
  }
}

/** Enum member strings for select controls; empty for non-enum schemas. */
export function enumValuesOf(schema: z.ZodType): string[] {
  const def = defOf(unwrapSchema(schema));
  if (def.type !== 'enum' || def.entries === undefined) {
    return [];
  }
  return Object.values(def.entries).filter((value): value is string => typeof value === 'string');
}

/**
 * Property schemas of a block's `props` object, in DECLARATION ORDER (the
 * inspector's row order). Empty for anything that is not a zod object.
 */
export function propsShapeOf(schema: z.ZodType): Record<string, z.ZodType> {
  const def = defOf(schema);
  if (def.type !== 'object') {
    return {};
  }
  return def.shape ?? {};
}

/**
 * The default resolution for a schema, ignoring contributions. Also the
 * containment target: a contributed field that fails to load or throws falls
 * back to THIS resolution for that one property (f3).
 */
export function defaultFieldFor(schema: z.ZodType): ResolvedField {
  switch (defOf(unwrapSchema(schema)).type) {
    case 'string':
      return { kind: 'default', control: 'text' };
    case 'enum':
      return { kind: 'default', control: 'select' };
    case 'boolean':
      return { kind: 'default', control: 'switch' };
    case 'number':
      return { kind: 'default', control: 'number' };
    default:
      return { kind: 'readonly' };
  }
}

export function resolveField(registry: RegistryRead, schema: z.ZodType): ResolvedField {
  let winner: FieldTypeDef | undefined;
  let best = 0;
  for (const def of registry.fieldTypes()) {
    let score = 0;
    try {
      score = def.match(schema);
    } catch {
      // A broken contribution must never break resolution — treat as no match.
      score = 0;
    }
    // Strict > keeps the FIRST registration on ties (f1: registration order).
    if (score > best) {
      best = score;
      winner = def;
    }
  }
  if (winner !== undefined) {
    return { kind: 'contributed', def: winner };
  }
  return defaultFieldFor(schema);
}
