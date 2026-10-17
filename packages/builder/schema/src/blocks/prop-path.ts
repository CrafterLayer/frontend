/**
 * Reading and writing a value at a nested prop path (block-parts DESIGN §2.4).
 *
 * A path is a list of object keys and array indices: `['items', 2, 'title']`
 * addresses `props.items[2].title`. Both functions are pure. `setAtPropPath`
 * never mutates its input: it copies only the containers on the path and
 * shares every other branch by reference (structural sharing), so a planner
 * can build the next value of a top-level prop from the stored one cheaply.
 */

/** A prop path: object keys and array indices, from the props root down. */
export type PropPath = readonly (string | number)[];

/* Keys that would reach the prototype chain are never addressable. */
const RESERVED_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The value at `path`, or `undefined` when any step is missing, a key is
 * reserved, or a step addresses the wrong kind of container.
 */
export function getAtPropPath(value: unknown, path: PropPath): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current) || !Number.isInteger(segment) || segment < 0) return undefined;
      current = (current as readonly unknown[])[segment];
      continue;
    }
    if (!isPlainRecord(current) || RESERVED_KEYS.has(segment)) return undefined;
    if (!Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * A copy of `value` with `next` at `path`. Containers on the path are copied;
 * everything else is shared. A missing container is created as an array when
 * the next segment is a number, and as an object otherwise. When the value at
 * `path` is already `next` (by `Object.is`), the input is returned unchanged.
 *
 * Throws only for a path no document could hold: a reserved key or a negative
 * or fractional index.
 */
export function setAtPropPath<T>(value: T, path: PropPath, next: unknown): T {
  return setAt(value, path, 0, next) as T;
}

function setAt(value: unknown, path: PropPath, depth: number, next: unknown): unknown {
  if (depth === path.length) return next;
  const segment = path[depth];
  if (typeof segment === 'number') {
    if (!Number.isInteger(segment) || segment < 0) {
      throw new RangeError(`Prop path index ${String(segment)} is not a non-negative integer.`);
    }
    const array: readonly unknown[] = Array.isArray(value) ? value : [];
    const child = setAt(array[segment], path, depth + 1, next);
    if (Array.isArray(value) && segment < value.length && Object.is(child, value[segment])) {
      return value;
    }
    const copy = [...array];
    copy[segment] = child;
    return copy;
  }
  if (segment === undefined || RESERVED_KEYS.has(segment)) {
    throw new RangeError(`Prop path key "${String(segment)}" is reserved.`);
  }
  const record: Record<string, unknown> = isPlainRecord(value) ? value : {};
  const previous = Object.hasOwn(record, segment) ? record[segment] : undefined;
  const child = setAt(previous, path, depth + 1, next);
  if (isPlainRecord(value) && Object.hasOwn(value, segment) && Object.is(child, previous)) {
    return value;
  }
  return { ...record, [segment]: child };
}
