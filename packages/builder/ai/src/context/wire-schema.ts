import { isCustomCodeJsMetaSchema, type JsonValue } from '@craftkit/builder-schema';

/**
 * A block's props schema as the MODEL reads it: the same constraints, fewer
 * characters (final test 2026-09-30: the full landing request grew to 65,288
 * wire tokens against the 64,000 budget once customCode admitted ~90
 * attributes and the page root gained `seo`). The door still validates
 * against the real schema; this is only the catalog's wording.
 *
 * - `$schema` is dropped: one meta URL per block, ~57 characters × every
 *   detailed block, and it tells the model nothing.
 * - An object whose properties are all the same schema (customCode's
 *   `attributes`: every one `{type:string,maxLength:2000}`) is stated once,
 *   as `propertyNames.enum` + `additionalProperties` — the same language.
 * - The page root's `seo` object is summarised: the seo.* tools write it
 *   (and keep sample facts out of it); a model never authors it by hand.
 * - block-parts (2026-10-06): `partStyles` is dropped. Every marketing block
 *   carries it (~330 characters of record schema each), which pushed the
 *   landing request to 67,153 tokens against 64,000. The model styles a part
 *   with `part.style {id, part, style}` (the "Block parts" fragment and the
 *   part.* tool signatures); it never writes the record by hand.
 * - studio (2026-10-12): customCode's `jsMeta` (the Studio's library reference
 *   and param spec, ~2,400 characters) is summarised. The Studio writes it and
 *   nothing teaches a model to; it rode on every request through the escape
 *   hatch, and took the playground's request from ~9,000 to ~13,200 tokens.
 */

type JsonRecord = Record<string, JsonValue>;

// ── block-parts (2026-10-06) ── the per-part styles prop, written through part.style only
const PART_STYLES_KEY = 'partStyles';
// ── /block-parts ──

/** Fewer shared properties than this are cheaper written out. */
const SHARED_MIN = 8;

const SEO_SUMMARY: JsonRecord = {
  type: 'object',
  description:
    'Page SEO (keyword, pageKind, schemaKinds, site business). Write it with the seo.* tools (seo.meta, seo.business, seo.schema, seo.fix), never by hand.',
};

const STUDIO_META_SUMMARY: JsonRecord = {
  type: 'object',
  description:
    'Studio script metadata (library reference, param spec). The Studio writes it; keep it as it is.',
};

/**
 * A block's props JSON with every Studio-written prop (`jsMeta`, found by its declaration, never by
 * name) reduced to a sentence. Its name stays, so a model still sees the block has it.
 */
export function withStudioSummaries(json: JsonValue, props: unknown): JsonValue {
  const shape = (props as { shape?: Record<string, unknown> } | undefined)?.shape;
  const properties = isRecord(json) ? json['properties'] : undefined;
  if (shape === undefined || !isRecord(json) || !isRecord(properties)) return json;
  const studio = Object.keys(shape).filter((key) =>
    isCustomCodeJsMetaSchema(shape[key] as Parameters<typeof isCustomCodeJsMetaSchema>[0]),
  );
  if (studio.length === 0) return json;
  return { ...json, properties: { ...properties, ...Object.fromEntries(studio.map((key) => [key, STUDIO_META_SUMMARY])) } };
}

function isRecord(value: JsonValue | undefined): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sharedProperties(node: JsonRecord): JsonRecord | undefined {
  const properties = node['properties'];
  if (!isRecord(properties) || node['additionalProperties'] !== false || node['required'] !== undefined) {
    return undefined;
  }
  const names = Object.keys(properties);
  if (names.length < SHARED_MIN) return undefined;
  const first = JSON.stringify(properties[names[0] ?? '']);
  if (!names.every((name) => JSON.stringify(properties[name]) === first)) return undefined;
  const rest: JsonRecord = { ...node };
  delete rest['properties'];
  return { ...rest, propertyNames: { enum: names }, additionalProperties: properties[names[0] ?? ''] ?? {} };
}

function compact(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(compact);
  if (!isRecord(value)) return value;
  const out: JsonRecord = {};
  for (const [key, child] of Object.entries(value)) out[key] = compact(child);
  return sharedProperties(out) ?? out;
}

export function wirePropsSchema(schema: JsonValue): JsonValue {
  if (!isRecord(schema)) return schema;
  const rest: JsonRecord = { ...schema };
  delete rest['$schema'];
  const properties = rest['properties'];
  const summarised: JsonRecord =
    isRecord(properties) && isRecord(properties['seo'])
      ? { ...rest, properties: { ...properties, seo: SEO_SUMMARY } }
      : rest;
  // ── block-parts (2026-10-06) ──
  const wired = summarised['properties'];
  if (isRecord(wired) && Object.hasOwn(wired, PART_STYLES_KEY)) {
    const kept: JsonRecord = { ...wired };
    delete kept[PART_STYLES_KEY];
    const required = summarised['required'];
    summarised['properties'] = kept;
    if (Array.isArray(required)) summarised['required'] = required.filter((name) => name !== PART_STYLES_KEY);
  }
  // ── /block-parts ──
  return compact(summarised);
}
