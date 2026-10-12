/*
  Property-path access for animated targets (creative engines, 2026-10-12).

  A key is a property name or a dotted path ("scale.x", "position.y"), at most four segments deep.
  Paths never walk into `__proto__`, `prototype` or `constructor`, and only numbers are written,
  so a tween cannot be used to reach or replace functions or prototypes.
*/

const BLOCKED = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_DEPTH = 4;

export interface PropRef {
  readonly holder: Record<string, unknown>;
  readonly key: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

/** Resolve a property path to its owning object, or undefined when any step is missing. */
export function resolveProp(target: unknown, path: string): PropRef | undefined {
  if (typeof path !== 'string' || path === '') return undefined;
  const parts = path.split('.');
  if (parts.length > MAX_DEPTH || parts.some((part) => part === '' || BLOCKED.has(part))) {
    return undefined;
  }
  const key = parts[parts.length - 1];
  if (key === undefined) return undefined;
  let holder: unknown = target;
  for (const part of parts.slice(0, -1)) {
    if (!isObject(holder)) return undefined;
    holder = holder[part];
  }
  if (!isObject(holder)) return undefined;
  return { holder, key };
}

export function readNumber(ref: PropRef): number | undefined {
  const value = ref.holder[ref.key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function writeNumber(ref: PropRef, value: number): void {
  if (Number.isFinite(value)) ref.holder[ref.key] = value;
}
