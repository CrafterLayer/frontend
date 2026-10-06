/**
 * A class list, read once into engine terms: each class with its scope and
 * the catalogue properties it sets. Shared by the engine, the responsive
 * normaliser and the copy/paste helpers.
 */
import { STYLE_PROPERTIES, type StylePropertyDef, type StylePropertyId } from './catalogue';
import { bucketKey, parseClass, splitClassList, type ParsedClass } from './class-syntax';
import { matchUtility, valueKey, writeUtility, type LogicalSlot, type UtilityMatch } from './codec';
import type { StyleBucket, StyleState, StyleValue } from './types';

export interface Entry {
  readonly raw: string;
  readonly parsed: ParsedClass;
  readonly matches: readonly UtilityMatch[];
}

export function readEntries(className: string): Entry[] {
  const seen = new Set<string>();
  const entries: Entry[] = [];
  for (const raw of splitClassList(className)) {
    if (seen.has(raw)) continue;
    seen.add(raw);
    const parsed = parseClass(raw);
    const rtl = parsed.scope.kind === 'engine' && parsed.scope.rtl;
    entries.push({ raw, parsed, matches: matchUtility(parsed.base, rtl) });
  }
  return entries;
}

/** Whether an entry sits exactly at this engine slot. */
export function atSlot(entry: Entry, bucket: StyleBucket, state: StyleState): boolean {
  const scope = entry.parsed.scope;
  return (
    scope.kind === 'engine' &&
    scope.state === state &&
    bucketKey(scope.bucket) === bucketKey(bucket)
  );
}

export function matchFor(entry: Entry, property: StylePropertyId): UtilityMatch | undefined {
  return entry.matches.find((match) => match.property === property);
}

/** Properties sharing a conflict family (or the property itself, by id). */
export function propertiesOfFamily(family: string): StylePropertyDef[] {
  return Object.values(STYLE_PROPERTIES).filter(
    (def) => def.family === family || def.id === family,
  );
}

// ── Side maps ──────────────────────────────────────────────────────────────

export interface SideValue {
  readonly value: StyleValue;
  readonly raw: string;
}

export type SideMap = Map<LogicalSlot, SideValue>;

/** The sides a set of classes resolves to, in Tailwind's CSS precedence (all < pair < one). */
export function sideMapOf(entries: readonly Entry[], property: StylePropertyId): SideMap {
  const map: SideMap = new Map();
  const relevant = entries
    .map((entry) => ({ entry, match: matchFor(entry, property) }))
    .filter(
      (item): item is { entry: Entry; match: UtilityMatch } => item.match?.sides !== undefined,
    );
  for (const level of [0, 1, 2]) {
    for (const { entry, match } of relevant) {
      if (match.level !== level) continue;
      for (const side of match.sides ?? []) map.set(side, { value: match.value, raw: entry.raw });
    }
  }
  return map;
}

const BOX_ORDER: readonly LogicalSlot[] = [
  'block-start',
  'block-end',
  'inline-start',
  'inline-end',
];
const CORNER_ORDER: readonly LogicalSlot[] = ['start-start', 'start-end', 'end-start', 'end-end'];

function sameAt(map: SideMap, a: LogicalSlot, b: LogicalSlot): boolean {
  const first = map.get(a);
  const second = map.get(b);
  return (
    first !== undefined && second !== undefined && valueKey(first.value) === valueKey(second.value)
  );
}

/**
 * The fewest classes that write a side map: equal sides collapse to the
 * shorthand (`p`, `py`, `px`; `rounded`, `rounded-s` …).
 * Returns utilities without variants, or a message naming what failed.
 */
export function collapseSides(
  def: StylePropertyDef,
  map: SideMap,
): { ok: true; classes: string[] } | { ok: false; message: string } {
  const logical = def.sidePrefixes?.logical ?? {};
  const groups: { prefix: string | undefined; value: StyleValue }[] = [];
  const take = (side: keyof typeof logical, slot: LogicalSlot): void => {
    const value = map.get(slot)?.value;
    if (value !== undefined) groups.push({ prefix: logical[side], value });
  };
  const order = def.sides === 'corners' ? CORNER_ORDER : BOX_ORDER;
  const first = map.get(order[0] ?? 'block-start');
  const allEqual =
    order.every((slot) => map.has(slot)) &&
    order.every((slot) => sameAt(map, order[0] ?? slot, slot));

  if (allEqual && first !== undefined) {
    groups.push({ prefix: logical.all, value: first.value });
  } else if (def.sides === 'corners') {
    /*
      Two ways to pair corners: by inline edge (rounded-s / rounded-e) or by
      block edge (rounded-t / rounded-b). Use whichever needs fewer classes;
      on a tie, the inline-edge pairs (they read as start/end in the panel).
    */
    const schemes: readonly (readonly [keyof typeof logical, LogicalSlot, LogicalSlot])[][] = [
      [
        ['inline-start', 'start-start', 'end-start'],
        ['inline-end', 'start-end', 'end-end'],
      ],
      [
        ['block-start', 'start-start', 'start-end'],
        ['block-end', 'end-start', 'end-end'],
      ],
    ];
    const cost = (scheme: (typeof schemes)[number]): number =>
      scheme.reduce(
        (total, [, a, b]) =>
          total + (sameAt(map, a, b) ? 1 : Number(map.has(a)) + Number(map.has(b))),
        0,
      );
    const [byInline, byBlock] = schemes;
    const best =
      byInline !== undefined && byBlock !== undefined && cost(byBlock) < cost(byInline)
        ? byBlock
        : byInline;
    for (const [pair, a, b] of best ?? []) {
      if (sameAt(map, a, b)) take(pair, a);
      else {
        take(a, a);
        take(b, b);
      }
    }
  } else {
    if (sameAt(map, 'block-start', 'block-end')) take('block', 'block-start');
    else {
      take('block-start', 'block-start');
      take('block-end', 'block-end');
    }
    if (sameAt(map, 'inline-start', 'inline-end')) take('inline', 'inline-start');
    else {
      take('inline-start', 'inline-start');
      take('inline-end', 'inline-end');
    }
  }

  const classes: string[] = [];
  for (const group of groups) {
    if (group.prefix === undefined) continue;
    const written = writeUtility(def, group.value, group.prefix);
    if (!written.ok) return written;
    classes.push(...written.classes);
  }
  return { ok: true, classes };
}

/**
 * Remove `remove` from the list and put `insert` where the first removed class
 * was (or at the end), so re-applying the same edit leaves the order alone.
 */
export function splice(
  classes: readonly string[],
  remove: ReadonlySet<string>,
  insert: readonly string[],
): string[] {
  const out: string[] = [];
  let placed = false;
  for (const name of classes) {
    if (!remove.has(name)) {
      out.push(name);
    } else if (!placed) {
      out.push(...insert);
      placed = true;
    }
  }
  if (!placed) out.push(...insert);
  return out.filter((name, index) => out.indexOf(name) === index);
}
