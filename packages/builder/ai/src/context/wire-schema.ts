import type { JsonValue } from '@craftkit/builder-schema';

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
 */

type JsonRecord = Record<string, JsonValue>;

/** Fewer shared properties than this are cheaper written out. */
const SHARED_MIN = 8;

const SEO_SUMMARY: JsonRecord = {
  type: 'object',
  description:
    'Page SEO (keyword, pageKind, schemaKinds, site business). Write it with the seo.* tools (seo.meta, seo.business, seo.schema, seo.fix), never by hand.',
};

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
  const summarised =
    isRecord(properties) && isRecord(properties['seo'])
      ? { ...rest, properties: { ...properties, seo: SEO_SUMMARY } }
      : rest;
  return compact(summarised);
}
