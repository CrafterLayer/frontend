/**
 * Law J (JSON purity): the document admits only plain serializable data.
 * `JsonValue` is the type-level half; `findJsonViolation` is the runtime walk used
 * by the dispatch door and the document validator.
 */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;

/** Law J's maximum depth for each stored JSON value. */
export const MAX_JSON_DEPTH = 128;

/**
 * Object keys Law J refuses. They are the keys that cannot be WRITTEN safely:
 * the kernel's patch door rejects them as path segments, so a document holding
 * one would project to text that parses back into patches the door refuses —
 * `parse(project(d))` would not reproduce `d`. Refusing them here keeps the
 * accepted domain and the applicable domain the same set, exactly as
 * MAX_JSON_DEPTH does (011 T033 review, second residual).
 */
export const RESERVED_JSON_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

export type JsonViolationKind =
  | 'function'
  | 'undefined'
  | 'bigint'
  | 'symbol'
  | 'non-finite-number'
  | 'max-depth'
  | 'reserved-key'
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
  return walk(value, [], new Set(), 0);
}

export function isJsonValue(value: unknown): value is JsonValue {
  return findJsonViolation(value) === undefined;
}

function walk(
  value: unknown,
  path: (string | number)[],
  seen: Set<object>,
  depth: number,
): JsonViolation | undefined {
  if (depth > MAX_JSON_DEPTH) {
    return { path, kind: 'max-depth' };
  }

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
        const violation = walk(value[index], [...path, index], seen, depth + 1);
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
      if (RESERVED_JSON_KEYS.has(key)) {
        return { path: [...path, key], kind: 'reserved-key' };
      }
      const violation = walk(entry, [...path, key], seen, depth + 1);
      if (violation !== undefined) {
        return violation;
      }
    }
    return undefined;
  } finally {
    seen.delete(objectValue);
  }
}

/**
 * Canonicalise the one JSON value the validator admits but no textual
 * projection can carry: `-0`. `Number.isFinite(-0)` is true, yet
 * `JSON.stringify(-0)` prints `"0"`, so a document holding it can never
 * survive a project→parse round trip (011 research R2, verified by execution).
 * It is normalised at the DOCUMENT BOUNDARY — the dispatch door and the load
 * path — rather than taught to every future printer, because `-0` is a value
 * no author can intend.
 *
 * Identity-preserving: a subtree containing no `-0` comes back by REFERENCE,
 * so canonicalising a clean value allocates nothing and `===` still means
 * "unchanged". Non-JSON shapes pass through untouched — the validator owns
 * rejection; this function only normalises.
 *
 * That last sentence has to hold for CYCLES too. A circular object is not a
 * JSON value, so it must reach the validator and be refused there with a typed
 * error; recursing into it instead blew the stack with a bare `RangeError`
 * before the door could speak (011 T033 review, finding 7). The seen-set makes
 * the promise true rather than aspirational.
 */
export function canonicalizeJsonValue<T>(value: T): T {
  // A cyclic graph is not a JSON value at all, so it is handed back WHOLE and
  // untouched — normalising half of a value the door is about to refuse would
  // only obscure what the author actually sent.
  return isCyclic(value, new Set<object>()) ? value : canonicalize(value);
}

/**
 * True cycle detection, not "seen before": the same object reached twice down
 * two different branches is a DAG, which is perfectly valid JSON once printed
 * and must still be canonicalised. Only a reference that reappears on its OWN
 * ancestor path is a cycle, so entries leave the path on the way out.
 */
function isCyclic(value: unknown, path: Set<object>): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (path.has(value)) {
    return true;
  }
  path.add(value);
  const children: unknown[] = Array.isArray(value)
    ? value
    : Object.values(value as Record<string, unknown>);
  for (const child of children) {
    if (isCyclic(child, path)) {
      return true;
    }
  }
  path.delete(value);
  return false;
}

function canonicalize<T>(value: T): T {
  if (typeof value === 'number') {
    return (Object.is(value, -0) ? 0 : value) as T;
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    let changed: unknown[] | null = null;
    for (let index = 0; index < value.length; index += 1) {
      const entry: unknown = value[index];
      const canonical = canonicalize(entry);
      // `!==` is blind to the one change we make (`0 !== -0` is false); Object.is is not.
      if (!Object.is(canonical, entry) && changed === null) {
        changed = value.slice();
      }
      if (changed !== null) {
        changed[index] = canonical;
      }
    }
    return (changed ?? value) as T;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }
  let changedObject: Record<string, unknown> | null = null;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const canonical = canonicalize(entry);
    if (!Object.is(canonical, entry) && changedObject === null) {
      changedObject = { ...(value as Record<string, unknown>) };
    }
    if (changedObject !== null) {
      changedObject[key] = canonical;
    }
  }
  return (changedObject ?? value) as T;
}
