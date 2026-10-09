import type { z } from 'zod';

import { propsShapeOf, unwrapSchema } from './resolve-field';

interface SchemaDef {
  readonly type: string;
  readonly innerType?: z.ZodType;
  readonly element?: z.ZodType;
  readonly entries?: Readonly<Record<string, unknown>>;
  readonly values?: readonly unknown[];
}

interface SchemaBag {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly multipleOf?: number;
}

export interface RepeaterSchemaInfo {
  readonly element: z.ZodType;
  readonly min: number;
  readonly max: number | undefined;
}

export type InitialFieldValue =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly reason: string };

function defOf(schema: z.ZodType): SchemaDef {
  return schema._zod.def;
}

function bagOf(schema: z.ZodType): SchemaBag {
  return schema._zod.bag;
}

function finiteBound(value: number | undefined): number | undefined {
  return value === undefined || !Number.isFinite(value)
    ? undefined
    : Math.max(0, Math.floor(value));
}

export function repeaterSchemaInfo(schema: z.ZodType): RepeaterSchemaInfo | undefined {
  const core = unwrapSchema(schema);
  const def = defOf(core);
  if (def.type !== 'array' || def.element === undefined) {
    return undefined;
  }
  const bag = bagOf(core);
  return {
    element: def.element,
    min: finiteBound(bag.minimum) ?? 0,
    max: finiteBound(bag.maximum),
  };
}

function humanize(key: string | undefined): string {
  if (key === undefined || key.trim() === '') {
    return 'item';
  }
  return key
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function parseCandidate(schema: z.ZodType, candidate: unknown): InitialFieldValue | undefined {
  const parsed = schema.safeParse(candidate);
  return parsed.success ? { ok: true, value: parsed.data } : undefined;
}

function stringSeed(schema: z.ZodType, key: string | undefined): InitialFieldValue {
  const core = unwrapSchema(schema);
  const bag = bagOf(core);
  const min = finiteBound(bag.minimum) ?? 0;
  const max = finiteBound(bag.maximum);
  if (max !== undefined && max < min) {
    return { ok: false, reason: 'The item schema has incompatible string bounds.' };
  }

  const base = `New ${humanize(key)}`;
  const room = max ?? Math.max(base.length, min);
  const seeded = base.slice(0, room).padEnd(min, 'x');
  const candidates = [seeded, 'x'.repeat(Math.max(min, 1)).slice(0, room), ''.padEnd(min, 'x')];
  for (const candidate of candidates) {
    const parsed = parseCandidate(schema, candidate);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return { ok: false, reason: 'The item schema does not expose a valid starting string.' };
}

function numberSeed(schema: z.ZodType): InitialFieldValue {
  const bag = bagOf(unwrapSchema(schema));
  const lower = bag.exclusiveMinimum ?? bag.minimum;
  const upper = bag.exclusiveMaximum ?? bag.maximum;
  const step = bag.multipleOf === undefined || bag.multipleOf === 0 ? 1 : Math.abs(bag.multipleOf);
  const candidates = [
    lower !== undefined && upper !== undefined ? lower + (upper - lower) / 2 : undefined,
    bag.minimum,
    bag.maximum,
    bag.exclusiveMinimum === undefined ? undefined : bag.exclusiveMinimum + step,
    bag.exclusiveMaximum === undefined ? undefined : bag.exclusiveMaximum - step,
    lower === undefined ? undefined : Math.ceil((lower + Number.EPSILON) / step) * step,
    upper === undefined ? undefined : Math.floor((upper - Number.EPSILON) / step) * step,
    0,
    step,
    -step,
  ].filter(
    (candidate): candidate is number => candidate !== undefined && Number.isFinite(candidate),
  );
  for (const candidate of candidates) {
    const parsed = parseCandidate(schema, candidate);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return { ok: false, reason: 'The item schema does not expose a valid starting number.' };
}

function objectSeed(schema: z.ZodType): InitialFieldValue {
  const candidate: Record<string, unknown> = {};
  for (const [key, propertySchema] of Object.entries(propsShapeOf(unwrapSchema(schema)))) {
    if (propertySchema.safeParse(undefined).success) {
      continue;
    }
    const property = initialValueForSchema(propertySchema, key);
    if (!property.ok) {
      return property;
    }
    candidate[key] = property.value;
  }
  return (
    parseCandidate(schema, candidate) ?? {
      ok: false,
      reason: 'The item object cannot be initialized from its declared fields.',
    }
  );
}

function arraySeed(schema: z.ZodType): InitialFieldValue {
  const info = repeaterSchemaInfo(schema);
  if (info === undefined) {
    return { ok: false, reason: 'The item schema is not an array.' };
  }
  const candidate: unknown[] = [];
  for (let index = 0; index < info.min; index += 1) {
    const element = initialValueForSchema(info.element);
    if (!element.ok) {
      return element;
    }
    candidate.push(element.value);
  }
  return (
    parseCandidate(schema, candidate) ?? {
      ok: false,
      reason: 'The nested array cannot be initialized within its declared bounds.',
    }
  );
}

export function initialValueForSchema(schema: z.ZodType, key?: string): InitialFieldValue {
  const undefinedValue = schema.safeParse(undefined);
  if (undefinedValue.success && undefinedValue.data !== undefined) {
    return { ok: true, value: undefinedValue.data };
  }

  const nullValue = schema.safeParse(null);
  if (nullValue.success) {
    return { ok: true, value: nullValue.data };
  }

  const core = unwrapSchema(schema);
  const def = defOf(core);
  switch (def.type) {
    case 'string':
      return stringSeed(schema, key);
    case 'enum': {
      for (const candidate of Object.values(def.entries ?? {})) {
        const parsed = parseCandidate(schema, candidate);
        if (parsed !== undefined) {
          return parsed;
        }
      }
      break;
    }
    case 'literal': {
      for (const candidate of def.values ?? []) {
        const parsed = parseCandidate(schema, candidate);
        if (parsed !== undefined) {
          return parsed;
        }
      }
      break;
    }
    case 'boolean':
      return (
        parseCandidate(schema, false) ?? {
          ok: false,
          reason: 'The item schema rejected its boolean starting value.',
        }
      );
    case 'number':
      return numberSeed(schema);
    case 'object':
      return objectSeed(schema);
    case 'array':
      return arraySeed(schema);
    default:
      break;
  }
  return {
    ok: false,
    reason: `The ${def.type} item schema needs a declared default before it can be added.`,
  };
}

function nonEmptyText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = value.trim();
  return text === '' ? undefined : text;
}

export function repeaterItemLabel(
  schema: z.ZodType,
  value: unknown,
  index: number,
  /** The name of an item with no words of its own, in the editor's language. */
  itemName: (position: number) => string = (position) => `Item ${String(position)}`,
): string {
  const direct = nonEmptyText(value);
  if (direct !== undefined) {
    return direct;
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Readonly<Record<string, unknown>>;
    const stringFields = Object.entries(propsShapeOf(unwrapSchema(schema))).filter(
      ([, propertySchema]) => defOf(unwrapSchema(propertySchema)).type === 'string',
    );
    const required = stringFields.find(
      ([key, propertySchema]) =>
        !propertySchema.safeParse(undefined).success && nonEmptyText(record[key]) !== undefined,
    );
    const first = required ?? stringFields.find(([key]) => nonEmptyText(record[key]) !== undefined);
    if (first !== undefined) {
      return nonEmptyText(record[first[0]]) ?? itemName(index + 1);
    }
  }

  return itemName(index + 1);
}
