/**
 * The agent panel's copy: one catalog, two authored locales, typed keys (SPEC §4.0,
 * §7.1, WP-04). Components never write a user-visible string; they render
 * `t(locale, key, params)`, or `tParts` when an interpolated title must sit in `<bdi>`.
 *
 * Filling a template:
 * - a param slot (`{title}`, `{n}`) takes `params[slot]`; a number is formatted with
 *   Latin digits for the locale («1,234»), a string is inserted as it is;
 * - a noun slot (`{sections}`, `{minutes}`, `{blocks}`) takes the counted noun for
 *   `params.n`, in its nominative form (`nouns.ts`): «3 أقسام», «قسمان», "1 section";
 * - a plural entry picks its form by the CLDR category of `params[entry.by ?? 'n']`, and
 *   its authored `zero` form for exactly 0 in either locale.
 *
 * A missing param is a bug in the caller. In development and tests it throws, naming the
 * key and the slot, so a component test fails on it; in a production build the slot is
 * left empty, because a raw `{title}` on screen would be worse than a short sentence.
 */
import type { AnnouncementKey, CopyParams, Locale } from '../model/view-types';

import { ar } from './ar';
import { en } from './en';
import { formatList, formatNumber, pluralCategory, type PluralCategory } from './format';
import { announceKey, isPluralEntry, type ArEntry, type EnEntry, type Key } from './keys';
import { countNoun, isNounSlot, NOUN_SLOTS } from './nouns';

export {
  formatClock,
  formatDate,
  formatList,
  formatNumber,
  formatRelativeTime,
  formatWhen,
  localeTag,
  pluralCategory,
  stopShortcut,
  type PluralCategory,
} from './format';
export {
  ACTION_KEYS,
  ANNOUNCEMENT_KEYS,
  announceKey,
  buildTitleKey,
  ERROR_CAUSE_KEY,
  ERROR_PAGE_KEY,
  JUMP_LABEL_KEY,
  KEYS,
  MENU_ITEM_KEY,
  PLAN_PROBLEM_KEY,
  QUEUE_CAPTION_KEY,
  STARTER_KEYS,
  STATUS_KEYS,
  UNDO_UNAVAILABLE_KEY,
  type AnnounceKey,
  type Key,
} from './keys';
export { countNoun, type CountedNoun } from './nouns';

/**
 * One piece of a rendered string. `value` pieces came from a slot, so a component can
 * isolate them (`<bdi>`, SPEC §4.0 "Every interpolated title is wrapped in `<bdi>`")
 * while `text` pieces are the catalog's own words.
 */
export type CopyPart =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'value'; readonly slot: string; readonly text: string };

const CATALOGS: Readonly<Record<Locale, Readonly<Record<Key, ArEntry | EnEntry>>>> = { ar, en };

const NO_PARAMS: CopyParams = {};
const SLOT = /\{([A-Za-z]+)\}/gu;

// Vite defines `DEV` for `vite` and vitest, and `MODE` is 'test' under vitest; a
// production build has neither, so it degrades instead of throwing.
const STRICT = import.meta.env['DEV'] === true || import.meta.env['MODE'] === 'test';

function fault(locale: Locale, key: Key, problem: string): void {
  if (STRICT) throw new Error(`copy ${locale} "${key}": ${problem}`);
}

function countParam(locale: Locale, key: Key, params: CopyParams, name: string): number | null {
  const value = params[name];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  fault(locale, key, `param "${name}" must be a finite number, got ${JSON.stringify(value)}`);
  return null;
}

type Forms = Readonly<Partial<Record<PluralCategory, string>>> & { readonly other: string };

/**
 * The form for `count`: an authored `zero` for exactly 0 (English has no CLDR zero
 * category, so this is ICU's `=0`; for Arabic it is the same set), else the CLDR
 * category's form, else `other`.
 */
function formFor(locale: Locale, count: number, forms: Forms): string {
  if (count === 0 && forms.zero !== undefined) return forms.zero;
  return forms[pluralCategory(locale, count)] ?? forms.other;
}

function templateOf(locale: Locale, key: Key, params: CopyParams): string {
  const entry = CATALOGS[locale][key];
  if (!isPluralEntry(entry)) return entry;
  const count = countParam(locale, key, params, entry.by ?? 'n');
  return count === null ? entry.other : formFor(locale, count, entry);
}

function slotText(locale: Locale, key: Key, params: CopyParams, slot: string): string {
  if (isNounSlot(slot)) {
    const count = countParam(locale, key, params, 'n');
    return count === null ? '' : countNoun(locale, NOUN_SLOTS[slot], count);
  }
  const value = params[slot];
  if (typeof value === 'number') return formatNumber(locale, value);
  if (typeof value === 'string') return value;
  fault(locale, key, `missing param "${slot}"`);
  return '';
}

/** A catalog string split into its own words and its interpolated values. */
export function tParts(
  locale: Locale,
  key: Key,
  params: CopyParams = NO_PARAMS,
): readonly CopyPart[] {
  const template = templateOf(locale, key, params);
  const parts: CopyPart[] = [];
  let from = 0;
  for (const match of template.matchAll(SLOT)) {
    const [whole, slot = ''] = match;
    if (match.index > from) parts.push({ kind: 'text', text: template.slice(from, match.index) });
    parts.push({ kind: 'value', slot, text: slotText(locale, key, params, slot) });
    from = match.index + whole.length;
  }
  if (from < template.length) parts.push({ kind: 'text', text: template.slice(from) });
  return parts;
}

/** A catalog string, filled: `t('ar', 'build.writing', { n: 3 })` → «3 أقسام قيد الكتابة». */
export function t(locale: Locale, key: Key, params: CopyParams = NO_PARAMS): string {
  return tParts(locale, key, params)
    .map((part) => part.text)
    .join('');
}

/** What LiveStatus speaks for an announcement (SPEC §4.3): the `announce.*` sentence. */
export function tAnnounce(
  locale: Locale,
  key: AnnouncementKey,
  params: CopyParams = NO_PARAMS,
): string {
  return t(locale, announceKey(key), params);
}

/**
 * The form for `n` among `forms`, chosen as `t` chooses (an authored `zero` for exactly 0,
 * then the CLDR category, then `other`): for the rare string built outside the catalog
 * (a story fixture, a test). Catalog keys pluralise themselves through `t`.
 */
export function plural(locale: Locale, n: number, forms: Forms): string {
  return formFor(locale, n, forms);
}

/** One catalog string to render: what a model module emits in place of a sentence. */
export interface CopyRef {
  readonly key: Key;
  readonly params?: CopyParams;
}

/**
 * Several catalog phrases as one line, joined the way the locale joins a list, with the
 * line's first letter capitalised in English (Arabic has no case). For `describeImpact`'s
 * parts: «أُضيف عنصران وتغيّر اتجاه الصفحة» / "2 blocks added and the page direction
 * changed", and "The page direction changed" when that part is alone.
 */
export function tList(locale: Locale, refs: readonly CopyRef[]): string {
  const line = formatList(
    locale,
    refs.map((ref) => t(locale, ref.key, ref.params)),
  );
  return locale === 'en' ? line.charAt(0).toUpperCase() + line.slice(1) : line;
}

const MS_PER_MINUTE = 60_000;

/**
 * The estimate line (SPEC §4.8 "Display"): under a minute, its own sentence; otherwise
 * whole minutes rounded up, so the estimate is never optimistic. The §4.8 worked example,
 * 90s, reads "About 2 min left" / «المتبقي تقريبًا: دقيقتان».
 */
export function formatRemaining(locale: Locale, ms: number): string {
  if (ms < MS_PER_MINUTE) return t(locale, 'build.remaining.underMinute');
  return t(locale, 'build.remaining.minutes', { n: Math.ceil(ms / MS_PER_MINUTE) });
}
