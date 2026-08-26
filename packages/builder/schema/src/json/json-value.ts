/**
 * Law J (JSON purity): the document admits only plain serializable data.
 * `JsonValue` is the type-level half; `findJsonViolation` is the runtime walk used
 * by the dispatch door and the document validator.
 */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;

export type JsonViolationKind =
  | 'function'
  | 'undefined'
  | 'bigint'
  | 'symbol'
  | 'non-finite-number'
  | 'unsupported-object'
  | 'circular';

export interface JsonViolation {
  path: (string | number)[];
  kind: JsonViolationKind;
}

/**
 * Returns the first violation found in depth-first order, or `undefined` when the
 * value is pure `JsonValue`. Finite numbers only — NaN and ±Infinity are violations.
 */
export function findJsonViolation(value: unknown): JsonViolation | undefined {
  return walk(value, [], new Set());
}

export function isJsonValue(value: unknown): value is JsonValue {
  return findJsonViolation(value) === undefined;
}

function walk(
  value: unknown,
  path: (string | number)[],
  seen: Set<object>,
): JsonViolation | undefined {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return undefined;
    case 'number':
      return Number.isFinite(value) ? undefined : { path, kind: 'non-finite-number' };
    case 'undefined':
      return { path, kind: 'undefined' };
    case 'function':
      return { path, kind: 'function' };
    case 'bigint':
      return { path, kind: 'bigint' };
    case 'symbol':
      return { path, kind: 'symbol' };
    case 'object':
      break;
    default:
      return { path, kind: 'unsupported-object' };
  }

  if (value === null) {
    return undefined;
  }

  const objectValue = value;
  if (seen.has(objectValue)) {
    return { path, kind: 'circular' };
  }
  seen.add(objectValue);

  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          return { path: [...path, index], kind: 'undefined' };
        }
        const violation = walk(value[index], [...path, index], seen);
        if (violation !== undefined) {
          return violation;
        }
      }
      return undefined;
    }

    const prototype: unknown = Object.getPrototypeOf(objectValue);
    if (prototype !== Object.prototype && prototype !== null) {
      return { path, kind: 'unsupported-object' };
    }

    for (const [key, entry] of Object.entries(objectValue)) {
      const violation = walk(entry, [...path, key], seen);
      if (violation !== undefined) {
        return violation;
      }
    }
    return undefined;
  } finally {
    seen.delete(objectValue);
  }
}
