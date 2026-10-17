/**
 * Mobile-first → desktop-first normalisation (style-manager DESIGN.md §A.3, D2).
 *
 * The engine writes desktop-first buckets (base, `max-lg:`, `max-md:`). Classes
 * an agent or a person wrote mobile-first (`p-4 md:p-8 lg:p-12`) mean the same
 * thing in the other direction, so on the first edit of a family they are
 * rewritten: the value each width sees is probed at 1280 (desktop), 900
 * (tablet) and 375 (mobile), and written back as base + `max-lg:` + `max-md:`.
 *
 * `p-4 md:p-8` → `p-8 max-md:p-4`. `px-4 lg:px-8` → `px-8 max-lg:px-4`.
 *
 * Left untouched (and reported by `customBreakpointProperties`): `sm:`, `xl:`,
 * `2xl:`, container `@md:` classes; and any family the probe cannot express
 * without a reset value — a value that only exists from `lg:` up has nothing
 * to fall back to below it.
 */
import type { StylePropertyDef } from './catalogue';
import { slotPrefix, splitClassList } from './class-syntax';
import { valueKey } from './codec';
import {
  atSlot,
  collapseSides,
  matchFor,
  propertiesOfFamily,
  readEntries,
  sideMapOf,
  splice,
  type Entry,
  type SideMap,
} from './entries';
import type { StyleState } from './types';

type Layer = 'base' | 'md' | 'lg';

function inLayer(entry: Entry, layer: Layer, state: StyleState): boolean {
  const scope = entry.parsed.scope;
  if (layer === 'base') return atSlot(entry, 'base', state);
  return scope.kind === 'mobile-first' && scope.breakpoint === layer && scope.state === state;
}

/** Rewrite one family's mobile-first `md:`/`lg:` classes as desktop-first buckets. */
export function normalizeResponsive(className: string, family: string): string {
  const original = splitClassList(className);
  let classes = original.filter((name, index) => original.indexOf(name) === index);
  for (const def of propertiesOfFamily(family)) {
    if (def.storage === 'class') classes = normalizeProperty(classes, def);
  }
  return classes.join(' ');
}

function normalizeProperty(classes: string[], def: StylePropertyDef): string[] {
  const entries = readEntries(classes.join(' ')).filter(
    (entry) => matchFor(entry, def.id) !== undefined,
  );
  const states = new Set<StyleState>();
  for (const entry of entries) {
    if (entry.parsed.scope.kind === 'mobile-first') states.add(entry.parsed.scope.state);
  }
  let next = classes;
  for (const state of states) {
    const rewritten = normalizeState(next, entries, def, state);
    if (rewritten === undefined) return classes;
    next = rewritten;
  }
  return next;
}

function normalizeState(
  classes: string[],
  entries: readonly Entry[],
  def: StylePropertyDef,
  state: StyleState,
): string[] | undefined {
  /* Desktop-first classes already present at this state: the two would interleave. Leave it. */
  const mixed = entries.some((entry) => {
    const scope = entry.parsed.scope;
    return scope.kind === 'engine' && scope.state === state && scope.bucket !== 'base';
  });
  if (mixed) return undefined;
  const layers = {
    base: entries.filter((entry) => inLayer(entry, 'base', state)),
    md: entries.filter((entry) => inLayer(entry, 'md', state)),
    lg: entries.filter((entry) => inLayer(entry, 'lg', state)),
  };
  const all = [...layers.base, ...layers.md, ...layers.lg];
  if (all.some((entry) => matchFor(entry, def.id)?.rtlPartner === true)) return undefined;
  const written = def.sides === undefined ? plainProbe(layers) : sidedProbe(def, layers);
  if (written === undefined) return undefined;
  const insert = [
    ...written.desktop.map((utility) => slotPrefix('base', state) + utility),
    ...written.tablet.map((utility) => slotPrefix('tablet', state) + utility),
    ...written.mobile.map((utility) => slotPrefix('mobile', state) + utility),
  ];
  return splice(classes, new Set(all.map((entry) => entry.raw)), insert);
}

interface Probe {
  readonly desktop: readonly string[];
  readonly tablet: readonly string[];
  readonly mobile: readonly string[];
}

function plainProbe(layers: Readonly<Record<Layer, readonly Entry[]>>): Probe | undefined {
  const bases = (layer: readonly Entry[]): string[] | undefined =>
    layer.length === 0 ? undefined : layer.map((entry) => entry.parsed.base);
  const at375 = bases(layers.base);
  const at900 = bases(layers.md) ?? at375;
  const at1280 = bases(layers.lg) ?? at900;
  if (at1280 === undefined || at900 === undefined || at375 === undefined) return undefined;
  const key = (list: readonly string[]): string => list.join(' ');
  return {
    desktop: at1280,
    tablet: key(at900) === key(at1280) ? [] : at900,
    mobile: key(at375) === key(at900) ? [] : at375,
  };
}

function overlay(under: SideMap, over: SideMap): SideMap {
  const map: SideMap = new Map(under);
  for (const [slot, value] of over) map.set(slot, value);
  return map;
}

/** The sides of `next` that differ from `previous`; undefined when a side would need a reset. */
function difference(previous: SideMap, next: SideMap): SideMap | undefined {
  const changed: SideMap = new Map();
  for (const [slot, value] of previous) {
    const now = next.get(slot);
    if (now === undefined) return undefined;
    if (valueKey(now.value) !== valueKey(value.value)) changed.set(slot, now);
  }
  /* `previous` is `next` overlaid with the wider layers, so it has every side `next` has. */
  return changed;
}

function sidedProbe(
  def: StylePropertyDef,
  layers: Readonly<Record<Layer, readonly Entry[]>>,
): Probe | undefined {
  const physicalOnly = [...layers.base, ...layers.md, ...layers.lg].some(
    (entry) => (matchFor(entry, def.id)?.sides?.length ?? 0) === 0,
  );
  if (physicalOnly) return undefined;
  const at375 = sideMapOf(layers.base, def.id);
  const at900 = overlay(at375, sideMapOf(layers.md, def.id));
  const at1280 = overlay(at900, sideMapOf(layers.lg, def.id));
  const tabletDiff = difference(at1280, at900);
  const mobileDiff = difference(at900, at375);
  if (tabletDiff === undefined || mobileDiff === undefined) return undefined;
  const desktop = collapseSides(def, at1280);
  const tablet = collapseSides(def, tabletDiff);
  const mobile = collapseSides(def, mobileDiff);
  if (!desktop.ok || !tablet.ok || !mobile.ok) return undefined;
  return { desktop: desktop.classes, tablet: tablet.classes, mobile: mobile.classes };
}
