import type { z } from 'zod';

import { enumValuesOf } from '../../fields/resolve-field';
import { isSegmentOption, segmentKind } from './segment-icons';
import type { SchemaFacts } from './types';

/*
  Facts about a SCHEMA, cached per schema identity.

  Everything here is a pure function of the zod object, which is immutable and
  shared by every row ever built from it — so each answer is computed once and
  kept in a WeakMap keyed by the schema itself (the entry goes away with it).

  The cached DEFAULT VALUE is shared too, and consumers treat it as immutable:
  the repeater copies before it edits, and the kernel validates every write —
  nothing holds it as its own mutable state. zod 4 hands out a fresh `[]` / `{}`
  per parse, which is what made every empty-default repeater row churn: a new
  reference on each render read as "the value moved".
*/

const DEFAULTS = new WeakMap<z.ZodType, { readonly value: unknown }>();

/**
 * Asking zod to parse `undefined` is the version-safe way to get a default: a
 * schema WITH one answers with it, and one without simply fails. No internals
 * are poked, so a zod upgrade cannot silently change the answer. One parse per
 * schema, ever.
 */
export function schemaDefault(schema: z.ZodType): unknown {
  const cached = DEFAULTS.get(schema);
  if (cached !== undefined) {
    return cached.value;
  }
  const parsed = schema.safeParse(undefined);
  const value = parsed.success ? parsed.data : undefined;
  DEFAULTS.set(schema, { value });
  return value;
}

/**
 * What the block is ACTUALLY set to, which is not always what the document says.
 *
 * A property the document omits still renders — the schema's default is what
 * the page draws. Reading the raw `props` alone showed those rows empty: after
 * the marketing blocks gained `size` and `width`, an existing CTA displayed
 * "—" for both while the page rendered `md` and `fit`. A person then cannot
 * tell what the block is, and choosing the value that is already in force reads
 * as a change when it is a no-op.
 *
 * The OVERRIDE buckets are deliberately excluded by the caller: an absent
 * override means "inherit", and showing the base default there would claim an
 * override exists.
 */
export function effectiveValue(stored: unknown, schema: z.ZodType): unknown {
  return stored !== undefined ? stored : schemaDefault(schema);
}

const FACTS = new WeakMap<z.ZodType, SchemaFacts>();

/** Enum members and whether they form a segmented alignment/direction control. */
export function schemaFacts(schema: z.ZodType): SchemaFacts {
  const cached = FACTS.get(schema);
  if (cached !== undefined) {
    return cached;
  }
  const enumOptions = enumValuesOf(schema);
  const kind = segmentKind(enumOptions);
  const facts: SchemaFacts = {
    enumOptions,
    segmentKind: kind,
    segmentOptions: kind === undefined ? [] : enumOptions.filter(isSegmentOption),
  };
  FACTS.set(schema, facts);
  return facts;
}
