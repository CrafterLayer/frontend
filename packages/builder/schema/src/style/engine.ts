/**
 * The class-patch engine (style-manager DESIGN.md §A.3, D1–D3).
 *
 * Pure and headless: a `className` and a list of person-sized intents in, the
 * next `className` out. The panel, the quick bar, the canvas handles and the
 * agent tools all call this, so an edit behaves the same whoever makes it.
 *
 * Rules:
 * - An intent removes its property's whole family at its bucket and state,
 *   then writes one canonical class (sided properties: the fewest classes).
 * - Equal sides collapse (`pbs-4 pbe-4 ps-4 pe-4` → `p-4`); editing one side
 *   expands the shorthand first.
 * - `null` resets: it removes only the class behind the value there.
 * - Every class produced passes `unknownUtilityClasses` (the live compiler's
 *   oracle when registered) and, in tokens mode, the theming law.
 */
import { unknownUtilityClasses } from '../custom-code/utility-vocabulary';
import {
  isStylePropertyId,
  STYLE_PROPERTIES,
  type StylePropertyDef,
  type StylePropertyId,
} from './catalogue';
import {
  bucketKey,
  bucketLimit,
  isValidCustomWidth,
  slotPrefix,
  splitClassList,
  STYLE_STATES,
} from './class-syntax';
import { matchUtility, slotsForSide, valueKey, writeUtility, type LogicalSlot } from './codec';
import {
  atSlot,
  collapseSides,
  matchFor,
  readEntries,
  sideMapOf,
  splice,
  type Entry,
  type SideMap,
} from './entries';
import { normalizeResponsive } from './responsive';
import { tokensModeRejections } from './tokens-mode';
import type {
  ApplyStyleOptions,
  ApplyStyleResult,
  ReadStyleOptions,
  ResolvedStyle,
  StyleBucket,
  StyleIntent,
  StyleMode,
  StyleSource,
  StyleState,
  StyleValue,
} from './types';

type Step =
  | { ok: true; classes: string[]; produced: ReadonlyMap<string, StylePropertyId> }
  | { ok: false; message: string };

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function describeBucket(bucket: StyleBucket): string {
  return typeof bucket === 'object' ? `≤ ${String(bucket.maxWidth)}px` : bucket;
}

function preflight(intent: StyleIntent, mode: StyleMode): string | undefined {
  if (!isStylePropertyId(intent.property))
    return `"${String(intent.property)}" is not a style property.`;
  const def = STYLE_PROPERTIES[intent.property];
  if (def.storage !== 'class') {
    return `${def.labels.en} is stored in the ${def.attribute ?? ''} attribute, not as a class; set the attribute instead.`;
  }
  if (typeof intent.bucket === 'object' && !isValidCustomWidth(intent.bucket.maxWidth)) {
    return `A custom breakpoint needs a whole number of pixels between 1 and 99999, not ${String(intent.bucket.maxWidth)}.`;
  }
  if (!STYLE_STATES.includes(intent.state))
    return `"${intent.state as string}" is not a style state.`;
  if (def.baseOnly === true && (intent.bucket !== 'base' || intent.state !== 'default')) {
    return `${def.labels.en} applies to every screen size and state; it cannot be set for ${describeBucket(intent.bucket)} / ${intent.state}.`;
  }
  if (mode === 'tokens') {
    if (intent.value?.kind === 'palette' || intent.value?.kind === 'raw') {
      return `${def.labels.en}: this element takes theme tokens and scale steps only, not ${intent.value.kind === 'raw' ? 'an exact value' : 'a palette colour'}.`;
    }
    if (typeof intent.bucket === 'object') {
      return `${def.labels.en}: this element takes the standard screen sizes only, not a custom breakpoint.`;
    }
  }
  if (intent.side !== undefined && def.sides === undefined && intent.side !== 'all') {
    return `${def.labels.en} has no sides; "${intent.side}" does not apply.`;
  }
  return undefined;
}

/** The family members of a class at a slot, for a non-sided property. */
function plainMembers(
  entries: readonly Entry[],
  def: StylePropertyDef,
  bucket: StyleBucket,
  state: StyleState,
): Entry[] {
  return entries.filter((entry) => {
    const scope = entry.parsed.scope;
    if (
      scope.kind !== 'engine' ||
      scope.state !== state ||
      bucketKey(scope.bucket) !== bucketKey(bucket)
    ) {
      return false;
    }
    return entry.matches.some(
      (match) =>
        match.property === def.id || STYLE_PROPERTIES[match.property].family === def.family,
    );
  });
}

function applyPlain(classes: string[], def: StylePropertyDef, intent: StyleIntent): Step {
  const entries = readEntries(classes.join(' '));
  const members = plainMembers(entries, def, intent.bucket, intent.state);
  const prefix = slotPrefix(intent.bucket, intent.state);
  const insert: string[] = [];
  const produced = new Map<string, StylePropertyId>();

  /* A two-axis shorthand keeps its other half: `size-8` → `block-8`. */
  for (const member of members) {
    const shorthand = matchFor(member, def.id)?.shorthand;
    if (shorthand === undefined) continue;
    const half = `${shorthand.counterpart}-${shorthand.suffix}`;
    const counterpart = matchUtility(half)[0]?.property;
    /* Already set directly at this slot (`block-4`, or `h-4` for block size)? Then the half is moot. */
    const counterpartTaken = entries.some(
      (entry) =>
        atSlot(entry, intent.bucket, intent.state) &&
        entry.matches.some(
          (match) => match.property === counterpart && match.shorthand === undefined,
        ),
    );
    if (!counterpartTaken) insert.push(`${prefix}${half}`);
  }

  if (intent.value !== null) {
    const written = writeUtility(def, intent.value);
    if (!written.ok) return written;
    for (const utility of written.classes) {
      /* The gradient pair's `rtl:` half goes after the slot prefix: `max-md:rtl:…`. */
      const name = `${prefix}${utility}`;
      insert.push(name);
      produced.set(name, def.id);
    }
  }
  return {
    ok: true,
    classes: splice(classes, new Set(members.map((member) => member.raw)), insert),
    produced,
  };
}

function applySided(classes: string[], def: StylePropertyDef, intent: StyleIntent): Step {
  const side = intent.side ?? 'all';
  const covered = slotsForSide(def, side);
  if (covered === undefined) {
    return fail(
      `${def.labels.en} has no side "${side}"; use ${def.sides === 'corners' ? 'a corner (start-start …) or inline-start/inline-end/block-start/block-end' : 'block-start, block-end, inline-start, inline-end, block, inline or all'}.`,
    );
  }
  if (intent.value !== null) {
    const probe = writeUtility(def, intent.value, def.sidePrefixes?.logical.all);
    if (!probe.ok) return probe;
  }
  const entries = readEntries(classes.join(' '));
  const here = entries.filter((entry) => atSlot(entry, intent.bucket, intent.state));
  const map: SideMap = sideMapOf(here, def.id);
  for (const slot of covered) {
    if (intent.value === null) map.delete(slot);
    else map.set(slot, { value: intent.value, raw: '' });
  }
  const remove = new Set<string>();
  for (const entry of here) {
    const match = matchFor(entry, def.id);
    if (match === undefined) continue;
    const readsSides = (match.sides?.length ?? 0) > 0;
    const overlapsCovered = (match.overlaps ?? []).some((slot) => covered.includes(slot));
    if (readsSides || overlapsCovered) remove.add(entry.raw);
  }
  const collapsed = collapseSides(def, map);
  if (!collapsed.ok) return collapsed;
  const prefix = slotPrefix(intent.bucket, intent.state);
  const insert = collapsed.classes.map((utility) => `${prefix}${utility}`);
  return {
    ok: true,
    classes: splice(classes, remove, insert),
    produced: new Map(insert.map((name) => [name, def.id] as const)),
  };
}

/**
 * Apply intents in order. All or nothing: the first refused intent refuses
 * the whole batch, and the message names the property and the class.
 */
export function applyStyleIntents(
  className: string,
  intents: readonly StyleIntent[],
  options: ApplyStyleOptions,
): ApplyStyleResult {
  const original = splitClassList(className);
  let classes = original.filter((name, index) => original.indexOf(name) === index);
  const produced = new Map<string, StylePropertyId>();

  for (const intent of intents) {
    const problem = preflight(intent, options.mode);
    if (problem !== undefined) return fail(problem);
    const def = STYLE_PROPERTIES[intent.property];
    classes = splitClassList(normalizeResponsive(classes.join(' '), def.family));
    const step =
      def.sides === undefined ? applyPlain(classes, def, intent) : applySided(classes, def, intent);
    if (!step.ok) return step;
    classes = step.classes;
    for (const [name, property] of step.produced) produced.set(name, property);
  }

  const before = new Set(original);
  const after = new Set(classes);
  const added = classes.filter((name) => !before.has(name));
  const removed = original.filter(
    (name, index) => !after.has(name) && original.indexOf(name) === index,
  );

  const unknown = unknownUtilityClasses(added.join(' '));
  if (unknown.length > 0) {
    const name = unknown[0] ?? '';
    const property = produced.get(name);
    const label =
      property === undefined
        ? 'this edit'
        : `${STYLE_PROPERTIES[property].labels.en} (${property})`;
    return fail(`"${name}" (written for ${label}) is not a class the page can style.`);
  }
  if (options.mode === 'tokens') {
    const [rejection] = tokensModeRejections(added.join(' '));
    if (rejection !== undefined) {
      const property = produced.get(rejection.utility);
      return fail(
        property === undefined
          ? rejection.message
          : `${STYLE_PROPERTIES[property].labels.en} (${property}): ${rejection.message}`,
      );
    }
  }
  return { ok: true, className: classes.join(' '), added, removed };
}

// ── Reading ────────────────────────────────────────────────────────────────

interface ResolutionStep {
  readonly bucket: StyleBucket;
  readonly state: StyleState;
  readonly source: Exclude<StyleSource, 'named-style'>;
}

/** Larger buckets (desktop-first): the ones whose `max-width` is wider, narrowest first. */
function bucketChain(bucket: StyleBucket, entries: readonly Entry[]): StyleBucket[] {
  const known = new Map<string, StyleBucket>([
    ['mobile', 'mobile'],
    ['tablet', 'tablet'],
    ['base', 'base'],
  ]);
  for (const entry of entries) {
    if (entry.parsed.scope.kind === 'engine')
      known.set(bucketKey(entry.parsed.scope.bucket), entry.parsed.scope.bucket);
  }
  const limit = bucketLimit(bucket);
  const larger = [...known.values()]
    .filter((candidate) => bucketLimit(candidate) > limit)
    .sort((a, b) => bucketLimit(a) - bucketLimit(b));
  return [bucket, ...larger];
}

function resolutionSteps(
  at: { bucket: StyleBucket; state: StyleState },
  entries: readonly Entry[],
): ResolutionStep[] {
  const chain = bucketChain(at.bucket, entries);
  const steps: ResolutionStep[] = chain.map((bucket, index) => ({
    bucket,
    state: at.state,
    source: index === 0 ? 'here' : 'larger-bucket',
  }));
  if (at.state !== 'default') {
    for (const bucket of chain) steps.push({ bucket, state: 'default', source: 'default-state' });
  }
  return steps;
}

const NAMED_STYLE_MARKER = /^ck-s-([a-z][a-z0-9-]{0,47})$/u;

/** The utilities of the named styles an element references, in marker order. */
export function namedStyleUtilities(
  className: string,
  styles: Readonly<Record<string, string>> | undefined,
): string {
  if (styles === undefined) return '';
  return splitClassList(className)
    .map((name) => NAMED_STYLE_MARKER.exec(name)?.[1])
    .filter((id): id is string => id !== undefined)
    .map((id) => styles[id] ?? '')
    .join(' ');
}

function plainAt(
  entries: readonly Entry[],
  def: StylePropertyDef,
  step: ResolutionStep,
): { value: StyleValue; raw: string } | undefined {
  const hits = entries.filter(
    (entry) =>
      atSlot(entry, step.bucket, step.state) &&
      matchFor(entry, def.id)?.rtlPartner !== true &&
      matchFor(entry, def.id) !== undefined,
  );
  if (hits.length === 0) return undefined;
  /* A direct class beats a shorthand half (`inline-4` over `size-8`), then the last one wins. */
  const direct = hits.filter((entry) => matchFor(entry, def.id)?.shorthand === undefined);
  const pool = direct.length > 0 ? direct : hits;
  if (def.multi === true) {
    const words = pool
      .map((entry) => matchFor(entry, def.id)?.value)
      .flatMap((value) => (value?.kind === 'keyword' ? [value.keyword] : []));
    return {
      value: { kind: 'keyword', keyword: words.join(' ') },
      raw: pool.map((entry) => entry.raw).join(' '),
    };
  }
  const last = pool[pool.length - 1];
  const value = last === undefined ? undefined : matchFor(last, def.id)?.value;
  return last === undefined || value === undefined ? undefined : { value, raw: last.raw };
}

const MIXED: StyleValue = { kind: 'keyword', keyword: 'mixed' };

/**
 * What every property shows at a bucket and state, and where it comes from:
 * set here, inherited from a larger bucket, from the Default state, or from a
 * named style. Properties with no value anywhere are absent from the map.
 */
export function readStyle(
  className: string,
  at: { readonly bucket: StyleBucket; readonly state: StyleState },
  options?: ReadStyleOptions,
): ReadonlyMap<StylePropertyId, ResolvedStyle> {
  const own = readEntries(className);
  const named = readEntries(namedStyleUtilities(className, options?.namedStyles));
  const steps = resolutionSteps(at, [...own, ...named]);
  const flagged = customBreakpointProperties(className);
  const result = new Map<StylePropertyId, ResolvedStyle>();

  for (const def of Object.values(STYLE_PROPERTIES)) {
    if (def.storage !== 'class') continue;
    const resolved =
      def.sides === undefined
        ? resolvePlain(def, own, named, steps)
        : resolveSided(def, own, named, steps);
    if (resolved === undefined) continue;
    result.set(def.id, flagged.has(def.id) ? { ...resolved, customBreakpoint: true } : resolved);
  }
  return result;
}

function resolvePlain(
  def: StylePropertyDef,
  own: readonly Entry[],
  named: readonly Entry[],
  steps: readonly ResolutionStep[],
): ResolvedStyle | undefined {
  for (const step of steps) {
    const mine = plainAt(own, def, step);
    if (mine !== undefined) return { value: mine.value, className: mine.raw, source: step.source };
    const theirs = plainAt(named, def, step);
    if (theirs !== undefined)
      return { value: theirs.value, className: theirs.raw, source: 'named-style' };
  }
  return undefined;
}

function resolveSided(
  def: StylePropertyDef,
  own: readonly Entry[],
  named: readonly Entry[],
  steps: readonly ResolutionStep[],
): ResolvedStyle | undefined {
  const order: readonly LogicalSlot[] =
    def.sides === 'corners'
      ? ['start-start', 'start-end', 'end-start', 'end-end']
      : ['block-start', 'block-end', 'inline-start', 'inline-end'];
  const sides: Partial<Record<LogicalSlot, ResolvedStyle>> = {};
  for (const step of steps) {
    const mine = sideMapOf(
      own.filter((entry) => atSlot(entry, step.bucket, step.state)),
      def.id,
    );
    const theirs = sideMapOf(
      named.filter((entry) => atSlot(entry, step.bucket, step.state)),
      def.id,
    );
    for (const slot of order) {
      if (sides[slot] !== undefined) continue;
      const hit = mine.get(slot);
      if (hit !== undefined) {
        sides[slot] = { value: hit.value, className: hit.raw, source: step.source };
        continue;
      }
      const inherited = theirs.get(slot);
      if (inherited !== undefined)
        sides[slot] = { value: inherited.value, className: inherited.raw, source: 'named-style' };
    }
  }
  const found = order
    .map((slot) => sides[slot])
    .filter((side): side is ResolvedStyle => side !== undefined);
  const first = found[0];
  if (first === undefined) return undefined;
  const uniform =
    found.length === order.length &&
    found.every((side) => valueKey(side.value) === valueKey(first.value));
  return {
    value: uniform ? first.value : MIXED,
    className: [...new Set(found.map((side) => side.className))].join(' '),
    source: first.source,
    sides,
  };
}

/**
 * Properties that also have classes behind breakpoints the engine does not
 * write (`sm:`, `xl:`, `2xl:`, `@md:`, `min-[…]:`) or has not normalised yet
 * (mobile-first `md:`/`lg:`). The UI shows a badge on these.
 */
export function customBreakpointProperties(className: string): ReadonlySet<StylePropertyId> {
  const flagged = new Set<StylePropertyId>();
  for (const entry of readEntries(className)) {
    const kind = entry.parsed.scope.kind;
    if (kind !== 'custom-breakpoint' && kind !== 'mobile-first') continue;
    for (const match of entry.matches) flagged.add(match.property);
  }
  return flagged;
}
