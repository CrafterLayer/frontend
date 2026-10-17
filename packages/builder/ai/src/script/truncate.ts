/**
 * Structural truncation of a script's return value.
 *
 * Vendored from `@cloudflare/codemode@0.5.3`, `src/truncate.ts`
 * (https://www.npmjs.com/package/@cloudflare/codemode, dist/truncate-*.js;
 * source repository https://github.com/cloudflare/agents).
 *
 *   MIT License Copyright (c) 2025 Cloudflare, Inc.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to
 *   deal in the Software without restriction, including without limitation the
 *   rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 *   sell copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice (including the next
 *   paragraph) shall be included in all copies or substantial portions of the
 *   Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *   FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 *   IN THE SOFTWARE.
 *
 * CraftKit changes (2026-10-08): typed; the budget is a character count (no
 * token estimate); a too-long string is cut to fit the budget INCLUDING its
 * marker (the original appended a sentence past the cap); counts print with
 * `String()` instead of `toLocaleString()` (QuickJS has no Intl, and the
 * sandbox's copy in `ck-prelude.js` must produce the same bytes — a parity test
 * pins that).
 *
 * The output is always valid JSON of the same shape, with the largest values
 * cut first. A truncated string ends with a marker, a truncated array ends with
 * a marker element counting the dropped items, and an object that had to lose
 * entries carries a marker entry naming the omitted keys. Every marker contains
 * `--- TRUNCATED ---`.
 */

export const TRUNCATION_MARKER = '--- TRUNCATED ---';

/**
 * The least a string or container is worth keeping at (see `floorSize`). A
 * value that would get fewer serialized characters than this is dropped in
 * favour of its siblings rather than reduced to a bare marker.
 */
const MIN_SLOT = 128;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Cut plain text to `maxChars`, marker included. */
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const suffix = `\n${TRUNCATION_MARKER} ${String(text.length)} chars`;
  if (suffix.length >= maxChars) return TRUNCATION_MARKER.slice(0, Math.max(0, maxChars));
  return text.slice(0, maxChars - suffix.length) + suffix;
}

/** Serialized size in characters (compact JSON). */
function size(value: Json): number {
  return JSON.stringify(value).length;
}

/** Only strings and containers can give up characters; scalars are atomic. */
function shrinkable(value: Json): boolean {
  return typeof value === 'string' || (typeof value === 'object' && value !== null);
}

/**
 * The least budget a value is kept at; a scalar must fit whole. The floor
 * never exceeds half the container's own budget, so tiny budgets still keep
 * something rather than nothing.
 */
function floorSize(value: Json, maxChars: number): number {
  const full = size(value);
  return shrinkable(value) ? Math.min(full, MIN_SLOT, Math.max(2, Math.floor(maxChars / 2))) : full;
}

function shrink(value: Json, maxChars: number): Json {
  if (size(value) <= maxChars) return value;
  if (typeof value === 'string') return shrinkString(value, maxChars);
  if (Array.isArray(value)) return shrinkArray(value, maxChars);
  if (typeof value === 'object' && value !== null) return shrinkObject(value, maxChars);
  return value;
}

function shrinkString(value: string, maxChars: number): string {
  const suffix = ` ${TRUNCATION_MARKER} ${String(value.length)} chars`;
  let keep = Math.max(0, maxChars - suffix.length - 2);
  let out = value.slice(0, keep) + suffix;
  while (keep > 0 && size(out) > maxChars) {
    keep = Math.max(0, keep - (size(out) - maxChars));
    out = value.slice(0, keep) + suffix;
  }
  return size(out) <= maxChars ? out : TRUNCATION_MARKER.slice(0, Math.max(0, maxChars - 2));
}

/**
 * Share `available` characters across values by water-filling: values are
 * admitted smallest first, each taking the lesser of its full size and an
 * equal share of what is left. Requires `available >= Σ floorSize(values)`;
 * then every value receives at least its floor.
 */
function allocate(values: readonly Json[], available: number): number[] {
  const sizes = values.map(size);
  const order = sizes.map((_, index) => index).sort((a, b) => (sizes[a] ?? 0) - (sizes[b] ?? 0));
  const allocation = new Array<number>(values.length).fill(0);
  let remaining = available;
  let count = values.length;
  for (const index of order) {
    const alloc = Math.min(sizes[index] ?? 0, Math.floor(remaining / count));
    allocation[index] = alloc;
    remaining -= alloc;
    count -= 1;
  }
  return allocation;
}

function shrinkArray(items: readonly Json[], maxChars: number): Json[] {
  const marker = (dropped: number): string => `${TRUNCATION_MARKER} ${String(dropped)} more items`;
  const floors = items.map((item) => floorSize(item, maxChars));
  const skeleton = (count: number): number => 2 + Math.max(0, count - 1);
  let keep = items.length;
  if (floors.reduce((n, f) => n + f, 0) + skeleton(keep) > maxChars) {
    const tail = size(marker(items.length)) + 1;
    let used = skeleton(0) + tail;
    keep = 0;
    while (keep < items.length && used + (floors[keep] ?? 0) + 1 <= maxChars) {
      used += (floors[keep] ?? 0) + 1;
      keep += 1;
    }
  }
  const kept = items.slice(0, keep);
  const dropped = items.length - keep;
  const tail = dropped > 0 ? size(marker(dropped)) + (keep > 0 ? 1 : 0) : 0;
  const allocation = allocate(kept, maxChars - skeleton(keep) - tail);
  const out: Json[] = kept.map((item, index) => shrink(item, allocation[index] ?? 0));
  if (dropped > 0 && size([...out, marker(dropped)]) <= maxChars) out.push(marker(dropped));
  return out;
}

function shrinkObject(value: Readonly<Record<string, Json>>, maxChars: number): Json {
  const entries = Object.entries(value);
  let markerKey = TRUNCATION_MARKER;
  while (markerKey in value) markerKey += ' ';
  const keyCost = (key: string): number => size(key) + 1;
  const floors = entries.map(([key, entry]) => keyCost(key) + floorSize(entry, maxChars));
  const floorOf = (chars: number): number =>
    Math.min(chars, MIN_SLOT, Math.max(2, Math.floor(maxChars / 2)));
  const byValueSize = entries
    .map((_, index) => index)
    .sort((a, b) => size(entries[b]?.[1] ?? null) - size(entries[a]?.[1] ?? null));
  const dropped = new Set<number>();
  let present = entries.length;
  let floorsSum = floors.reduce((n, f) => n + f, 0);
  let namesLength = 0;
  const noteLength = (): number =>
    `${String(dropped.size)} keys omitted: `.length + namesLength + 2 * (dropped.size - 1);
  const cost = (): number => {
    const marker = dropped.size > 0 ? keyCost(markerKey) + floorOf(noteLength() + 2) : 0;
    const count = present + (dropped.size > 0 ? 1 : 0);
    return 2 + Math.max(0, count - 1) + floorsSum + marker;
  };
  for (const index of byValueSize) {
    if (cost() <= maxChars) break;
    dropped.add(index);
    present -= 1;
    floorsSum -= floors[index] ?? 0;
    namesLength += size(entries[index]?.[0] ?? '') - 2;
  }
  const kept = entries.filter((_, index) => !dropped.has(index));
  const omitted = [...dropped].sort((a, b) => a - b).map((index) => entries[index]?.[0] ?? '');
  const note = `${String(omitted.length)} keys omitted: ${omitted.join(', ')}`;
  if (cost() > maxChars) {
    const room = maxChars - 2 - keyCost(markerKey);
    return room >= 2 ? { [markerKey]: shrink(note, room) } : {};
  }
  const all: [string, Json][] = [...kept];
  if (omitted.length > 0) all.push([markerKey, note]);
  const fixed = 2 + Math.max(0, all.length - 1) + all.reduce((n, [key]) => n + keyCost(key), 0);
  const allocation = allocate(
    all.map(([, entry]) => entry),
    maxChars - fixed,
  );
  const out: Record<string, Json> = {};
  all.forEach(([key, entry], index) => {
    out[key] = shrink(entry, allocation[index] ?? 0);
  });
  return out;
}

/**
 * Shrink a JSON-compatible value until its compact JSON fits `maxChars`.
 * Returns the value itself (same reference) when it already fits, or when it
 * cannot be serialized (cycles, bigint, `undefined`).
 */
/** `JSON.stringify`, or undefined for cycles, BigInt and values JSON cannot hold (undefined, functions). */
function stringifyOrUndefined(value: unknown): string | undefined {
  try {
    const text: unknown = JSON.stringify(value);
    return typeof text === 'string' ? text : undefined;
  } catch {
    return undefined;
  }
}

export function truncateResult(value: unknown, maxChars: number): unknown {
  if (typeof value === 'string') return truncateText(value, maxChars);
  const serialized = stringifyOrUndefined(value);
  if (serialized === undefined || serialized.length <= maxChars) return value;
  const shrunk = shrink(JSON.parse(serialized) as Json, maxChars);
  return size(shrunk) <= maxChars ? shrunk : truncateText(serialized, maxChars);
}

/**
 * The run summary string a script's `return` value becomes: a string stays a
 * string (cut with a marker); anything else becomes compact JSON no longer than
 * `maxChars`. `undefined` (no return) and unserializable values give undefined.
 */
export function scriptResultText(value: unknown, maxChars: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return truncateText(value, maxChars);
  const serialized = stringifyOrUndefined(value);
  if (serialized === undefined) return undefined;
  if (serialized.length <= maxChars) return serialized;
  const shrunk = shrink(JSON.parse(serialized) as Json, maxChars);
  const text = JSON.stringify(shrunk);
  return text.length <= maxChars ? text : truncateText(serialized, maxChars);
}
