import { z } from 'zod';

import { builderSiteShape, sitePageSchema, type BuilderSite } from './types';

/*
  What lets `validateSite` skip the pages a transaction did not touch
  (2026-10-12).

  The site door validates the whole site on every commit, so adding one empty
  page cost O(every node of every page) — and the site got slower to edit with
  every page it gained. Immer hands each production back deep-frozen, with every
  untouched page as the very same object, so per-page work done once for a
  frozen page object is still the answer while that object exists.

  Every result kept here is a pure function of a FROZEN key, which cannot change
  under it, so reuse changes the time an answer takes and never the answer.
  Unfrozen values are never kept. The tables are WeakMaps: an entry lives exactly
  as long as the page (or document, or member) it describes.
*/

/** `compute(key)`, or the result kept from an earlier call with the same frozen key. */
export type SiteValidationMemo = <K extends object, V>(compute: (key: K) => V, key: K) => V;

const tables = new Map<unknown, WeakMap<object, unknown>>();

export const reuseFrozen: SiteValidationMemo = <K extends object, V>(
  compute: (key: K) => V,
  key: K,
): V => {
  if (!Object.isFrozen(key)) return compute(key);
  let table = tables.get(compute);
  if (table === undefined) {
    table = new WeakMap();
    tables.set(compute, table);
  }
  if (table.has(key)) return table.get(key) as V;
  const value = compute(key);
  table.set(key, value);
  return value;
};

type ShapeKey = keyof typeof builderSiteShape;

const SHAPE_KEYS = Object.keys(builderSiteShape) as ShapeKey[];

/*
  The site's strict key set and nothing else: each member is parsed by its own
  schema below, which is also what refuses a REQUIRED member that is missing.
  Optional because a bare `z.unknown()` member refuses an absent key, and
  `codeProjects` and `library` are absent from most sites.
*/
const envelopeSchema = z.strictObject(
  Object.fromEntries(SHAPE_KEYS.map((key) => [key, z.unknown().optional()])) as Record<
    ShapeKey,
    z.ZodOptional<z.ZodUnknown>
  >,
);

const MALFORMED: unique symbol = Symbol('malformed');

type Parse = (value: unknown) => unknown;

/**
 * One member's parse as a stable pair: `plain` for a value that may still
 * change, `kept` for a frozen one, whose output is frozen in turn — a result
 * handed to a later caller must not be writable by an earlier one.
 */
function parser(schema: z.ZodType): { readonly plain: Parse; readonly kept: Parse } {
  const plain: Parse = (value) => {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : MALFORMED;
  };
  return { plain, kept: (value) => deepFreeze(plain(value)) };
}

const PAGE = parser(sitePageSchema);
const MEMBERS = Object.fromEntries(
  SHAPE_KEYS.map((key) => [key, parser(builderSiteShape[key] as z.ZodType)]),
) as Record<ShapeKey, ReturnType<typeof parser>>;

function parseMember({ plain, kept }: ReturnType<typeof parser>, value: unknown): unknown {
  return typeof value === 'object' && value !== null && Object.isFrozen(value)
    ? reuseFrozen(kept, value)
    : plain(value);
}

/**
 * What `builderSiteSchema` parses `value` to, member by member — or
 * `undefined` for anything it would refuse, so the caller can ask the whole
 * schema for Zod's own issues. `z.array(sitePageSchema)` succeeds exactly when
 * every page does; the envelope is the same strict key set; the output keeps
 * the schema's key order, so a serialised site is byte-identical.
 */
export function parseSiteByMember(value: unknown): BuilderSite | undefined {
  if (!envelopeSchema.safeParse(value).success) return undefined;
  const raw = value as Record<ShapeKey, unknown>;
  if (!Array.isArray(raw.pages)) return undefined;
  const pages: unknown[] = [];
  for (const page of raw.pages as unknown[]) {
    const parsed = parseMember(PAGE, page);
    if (parsed === MALFORMED) return undefined;
    pages.push(parsed);
  }
  const site: Partial<Record<ShapeKey, unknown>> = {};
  for (const key of SHAPE_KEYS) {
    const parsed = key === 'pages' ? pages : parseMember(MEMBERS[key], raw[key]);
    if (parsed === MALFORMED) return undefined;
    // `builderSiteSchema`'s transform: an absent optional member is no key at all.
    if (parsed !== undefined) site[key] = parsed;
  }
  return site as BuilderSite;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
