import {
  isLibraryId,
  isStylePropertyId,
  matchUtility,
  STYLE_PROPERTIES,
  STYLE_PROPERTY_IDS,
  STYLE_STATES,
  styleSidesOf,
  type StyleBucket,
  type StyleIntent,
  type StylePropertyDef,
  type StyleSide,
  type StyleState,
  type StyleValue,
} from '@craftkit/builder-schema';

import { isRecord } from '../tools/agent/shared';
import { no, ok, type Parsed } from './address';

/*
  The agent writes a style the way a person says it — `{"property":"padding",
  "value":"6","side":"inline","bucket":"mobile"}` — and this turns it into the
  P1 engine's StyleIntent. The engine then writes the class (desktop-first
  prefixes, logical sides, family replacement), exactly as the panel does.

  A value is read in this order:
    null                 → reset (remove only the class behind it)
    {kind,…}             → a StyleValue as the engine types it
    one of the options   → keyword ("flex", "center", "column")
    "palette:<id>"       → a site palette colour, written bg-(--ck-c-<id>)
    a theme token/step   → token ("accent", "4", "lg", "accent/80", "-2")
    anything else        → an exact CSS value ("17px", "#0f766e", "0 1px 2px …")
  The catalogue decides what a property admits; the engine refuses the rest
  with a sentence naming the property and the class.
*/

export interface StyleEntry {
  readonly property: string;
  readonly value: unknown;
  readonly bucket?: unknown;
  readonly state?: unknown;
  readonly side?: unknown;
}

export interface ParsedStyles {
  readonly intents: readonly StyleIntent[];
  /** `direction` is an attribute (§A.2), so it rides beside the class edit. */
  readonly dir?: string | null;
}

const ENTRY_KEYS = ['property', 'value', 'bucket', 'state', 'side'] as const;
const BUCKETS = ['base', 'tablet', 'mobile'] as const;
const DIRECTIONS = ['rtl', 'ltr', 'auto'] as const;
const STYLE_VALUE_KINDS = ['token', 'palette', 'raw', 'keyword'] as const;

function parseBucket(value: unknown): Parsed<StyleBucket> {
  if (value === undefined) return ok('base');
  if (typeof value === 'string' && (BUCKETS as readonly string[]).includes(value)) return ok(value as StyleBucket);
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return ok({ maxWidth: value });
  if (isRecord(value) && typeof value['maxWidth'] === 'number') return ok({ maxWidth: value['maxWidth'] });
  return no('"bucket" is base, tablet, mobile, or a max width in px (e.g. 600).');
}

function parseState(value: unknown): Parsed<StyleState> {
  if (value === undefined) return ok('default');
  if (typeof value === 'string' && (STYLE_STATES as readonly string[]).includes(value)) return ok(value as StyleState);
  return no(`"state" is one of ${STYLE_STATES.join(', ')}.`);
}

function parseSide(def: StylePropertyDef, value: unknown): Parsed<StyleSide | undefined> {
  if (value === undefined) return ok(undefined);
  const sides = styleSidesOf(def.id);
  if (typeof value === 'string' && (sides as readonly string[]).includes(value)) return ok(value as StyleSide);
  if (sides.length === 0) return no(`${def.id} has no sides; drop "side".`);
  return no(`"side" for ${def.id} is one of ${sides.join(', ')}.`);
}

/** The utility prefix a token is written after, for matching `"4"` against `p-4`. */
function tokenPrefix(def: StylePropertyDef): string | undefined {
  return def.prefix ?? def.sidePrefixes?.logical.all;
}

/** Read a string value the way the panel's control would mean it. */
export function readStyleValue(def: StylePropertyDef, raw: string): StyleValue {
  const text = raw.trim();
  const option = def.options?.find((entry) => entry.value === text && entry.legacy !== true);
  if (option !== undefined) return { kind: 'keyword', keyword: option.value };
  const palette = /^(?:palette:|\(--ck-c-|--ck-c-)([a-z][a-z0-9-]{0,47})\)?$/u.exec(text)?.[1];
  if (palette !== undefined && isLibraryId(palette)) return { kind: 'palette', id: palette };
  const prefix = tokenPrefix(def);
  if (prefix !== undefined && !/[\s[\]()#]/u.test(text)) {
    const negative = text.startsWith('-');
    const base = negative ? `-${prefix}-${text.slice(1)}` : `${prefix}-${text}`;
    const hit = matchUtility(base).find(
      (match) => (match.property === def.id || STYLE_PROPERTIES[match.property].family === def.family) && match.value.kind === 'token',
    );
    if (hit !== undefined) return hit.value;
  }
  return { kind: 'raw', css: text };
}

function parseValue(def: StylePropertyDef, value: unknown): Parsed<StyleValue | null> {
  if (value === null) return ok(null);
  if (typeof value === 'number') return ok(readStyleValue(def, String(value)));
  if (typeof value === 'string') {
    if (value.trim() === '') return no(`${def.id}: "value" is empty; send null to reset.`);
    return ok(readStyleValue(def, value));
  }
  if (isRecord(value) && typeof value['kind'] === 'string' && (STYLE_VALUE_KINDS as readonly string[]).includes(value['kind'])) {
    const kind = value['kind'];
    const field = kind === 'token' ? 'token' : kind === 'palette' ? 'id' : kind === 'raw' ? 'css' : 'keyword';
    const inner = value[field];
    if (typeof inner !== 'string' || inner === '') return no(`${def.id}: a ${kind} value needs "${field}".`);
    return ok({ kind, [field]: inner } as unknown as StyleValue);
  }
  return no(`${def.id}: "value" is a string ("4", "accent", "17px", "palette:brand"), a number, or null to reset.`);
}

function parseDirection(entry: Readonly<Record<string, unknown>>): Parsed<string | null> {
  if (entry['bucket'] !== undefined || entry['state'] !== undefined || entry['side'] !== undefined) {
    return no('direction is the element\'s dir attribute: it takes no bucket, state or side.');
  }
  const value = entry['value'];
  if (value === null) return ok(null);
  if (typeof value === 'string' && (DIRECTIONS as readonly string[]).includes(value)) return ok(value);
  return no('direction value is rtl, ltr, auto, or null to remove it.');
}

/** Parse the `styles` array of element.style / the quick bar's agent twin. */
export function parseStyleEntries(value: unknown): Parsed<ParsedStyles> {
  if (!Array.isArray(value) || value.length === 0) {
    return no('"styles" must be a non-empty array of {property, value, bucket?, state?, side?}.');
  }
  if (value.length > 40) return no('"styles" holds at most 40 entries per call.');
  const intents: StyleIntent[] = [];
  let dir: string | null | undefined;
  for (const [index, entry] of (value as unknown[]).entries()) {
    const where = `styles[${String(index)}]`;
    if (!isRecord(entry)) return no(`${where} must be {property, value, bucket?, state?, side?}.`);
    const extra = Object.keys(entry).filter((key) => !(ENTRY_KEYS as readonly string[]).includes(key));
    if (extra.length > 0) return no(`${where}: unknown keys ${extra.join(', ')}; use ${ENTRY_KEYS.join(', ')}.`);
    if (!Object.hasOwn(entry, 'value')) return no(`${where}: "value" is required (null resets).`);
    const property = entry['property'];
    if (typeof property !== 'string' || !isStylePropertyId(property)) {
      return no(`${where}: "property" is one of ${STYLE_PROPERTY_IDS.filter((id) => STYLE_PROPERTIES[id].storage === 'class').join(', ')}, direction.`);
    }
    const def = STYLE_PROPERTIES[property];
    if (property === 'direction') {
      const parsed = parseDirection(entry);
      if (!parsed.ok) return no(`${where}: ${parsed.error}`);
      dir = parsed.value;
      continue;
    }
    if (def.storage === 'attribute') {
      return no(`${where}: ${property} is an animation attribute · use element.animate (preset / hover).`);
    }
    const bucket = parseBucket(entry['bucket']);
    if (!bucket.ok) return no(`${where}: ${bucket.error}`);
    const state = parseState(entry['state']);
    if (!state.ok) return no(`${where}: ${state.error}`);
    const side = parseSide(def, entry['side']);
    if (!side.ok) return no(`${where}: ${side.error}`);
    const parsed = parseValue(def, entry['value']);
    if (!parsed.ok) return no(`${where}: ${parsed.error}`);
    intents.push({
      property,
      value: parsed.value,
      bucket: bucket.value,
      state: state.value,
      ...(side.value === undefined ? {} : { side: side.value }),
    });
  }
  return ok(dir === undefined ? { intents } : { intents, dir });
}
