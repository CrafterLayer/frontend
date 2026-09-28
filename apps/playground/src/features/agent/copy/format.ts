/**
 * The panel's Intl formatters (SPEC §4.0 "Punctuation and direction", §4.17 RunClock,
 * §4.18 HistoryRow). Pure: every function takes the time it formats *and* the time it
 * formats against, so a story, a test and a revived record all read the same text.
 *
 * Arabic always formats as `ar-JO-u-nu-latn` (SPEC A.2). Measured with Node 24's ICU 78:
 * - `ar-u-nu-latn` gives «21 سبتمبر»: the Gulf/Egyptian month names, not the Levantine
 *   «أيلول» a Jordanian or Palestinian reader expects;
 * - plain `ar-JO` gives «١٢»: Arabic-Indic digits, which this panel never shows, because
 *   counts, clocks and hex values sit beside Latin model and block names;
 * - `ar-JO-u-nu-latn` gives «21 أيلول», «قبل دقيقتين» and «1,234».
 * English formats as `en-u-nu-latn`, so a browser whose default numbering system is not
 * Latin cannot change it either.
 *
 * Intl objects are cached per locale: `t()` formats every number it interpolates, and a
 * thread of builds re-renders on every build event.
 */
import type { Locale } from '../model/view-types';

/** The six CLDR plural categories. English uses only `one` and `other`; Arabic all six. */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

const TAGS: Readonly<Record<Locale, string>> = {
  ar: 'ar-JO-u-nu-latn',
  en: 'en-u-nu-latn',
};

/** The BCP 47 tag every formatter in the panel uses for `locale`. */
export function localeTag(locale: Locale): string {
  return TAGS[locale];
}

function cached<T>(make: (tag: string) => T): (locale: Locale) => T {
  const cache = new Map<Locale, T>();
  return (locale) => {
    let value = cache.get(locale);
    if (value === undefined) {
      value = make(TAGS[locale]);
      cache.set(locale, value);
    }
    return value;
  };
}

const pluralRules = cached((tag) => new Intl.PluralRules(tag));
// Two decimals are enough for every number the catalog shows: counts are integers and a
// contrast ratio reads "4.57" (WCAG thresholds are 3 and 4.5).
const numbers = cached((tag) => new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }));
const relative = cached((tag) => new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }));
const lists = cached((tag) => new Intl.ListFormat(tag, { type: 'conjunction', style: 'long' }));
const dayMonth = cached((tag) => new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }));
const dayMonthYear = cached(
  (tag) => new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric' }),
);

/**
 * The CLDR plural category of `n` (SPEC §4.0, verified): Arabic 0 zero, 1 one, 2 two,
 * 3 to 10 few, 11 to 99 many, 100 to 102 other, and 103 few again.
 */
export function pluralCategory(locale: Locale, n: number): PluralCategory {
  return pluralRules(locale).select(n);
}

/** A number with Latin digits, grouped, at most two decimals: «1,234», "4.57". */
export function formatNumber(locale: Locale, n: number): string {
  return numbers(locale).format(n);
}

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * The run clock, `m:ss` (SPEC §4.8 "final time `m:ss`", frames "0:04", "2:21"). It is
 * the same in both locales: it sits in `<bdi dir="ltr">`. Minutes keep counting past the
 * hour ("62:03") rather than growing a third field, because the RunBar reserves 4.5ch.
 */
export function formatClock(ms: number): string {
  const seconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / MS_PER_SECOND)) : 0;
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Whole local calendar days from `at` to `now` (0 on the same day). */
function calendarDaysBetween(at: number, now: number): number {
  const start = new Date(at);
  const end = new Date(now);
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endDay - startDay) / MS_PER_DAY);
}

/**
 * How long ago `at` was, as the locale says it: «الآن», «قبل دقيقتين», «قبل 5 ساعات»,
 * «أمس», «قبل 3 أيام» / "now", "2 minutes ago", "yesterday". `numeric: 'auto'` lets
 * ICU put the genitive after «قبل» and say «أمس» instead of «قبل يوم واحد».
 * Under a minute, and for a time ahead of `now` (a skewed clock), it is "now". Hours are
 * counted only within today: last night at 20:00 is «أمس», not «قبل 16 ساعة», because a
 * person places a conversation by the day they had it.
 */
export function formatRelativeTime(locale: Locale, at: number, now: number): string {
  const elapsed = Math.max(0, now - at);
  const format = relative(locale);
  if (elapsed < MS_PER_MINUTE) return format.format(0, 'second');
  if (elapsed < MS_PER_HOUR) return format.format(-Math.floor(elapsed / MS_PER_MINUTE), 'minute');
  const days = calendarDaysBetween(at, now);
  if (days < 1) return format.format(-Math.floor(elapsed / MS_PER_HOUR), 'hour');
  return format.format(-days, 'day');
}

/**
 * A short date: «21 أيلول» / "21 Sep", with the year only when it is not `now`'s year.
 * English is assembled day-first from parts to match the SPEC's frames ("21 Sep"): `en`
 * alone writes "Sep 21", and `en-GB` writes "21 Sept" since ICU 72.
 */
export function formatDate(locale: Locale, at: number, now: number): string {
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  const format = sameYear ? dayMonth(locale) : dayMonthYear(locale);
  if (locale === 'ar') return format.format(at);
  const parts = format.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  const dayAndMonth = `${part('day')} ${part('month')}`;
  return sameYear ? dayAndMonth : `${dayAndMonth} ${part('year')}`;
}

/** Relative times reach back this many calendar days; older ones show a date (SPEC §4.0). */
const RELATIVE_DAYS = 6;

/**
 * A conversation's time in HistoryRow (SPEC §3.13, §4.18): relative within six calendar
 * days, a date after that. It stands alone at the row's end, so English starts with a
 * capital ("Now", "Yesterday"); Arabic has no case.
 */
export function formatWhen(locale: Locale, at: number, now: number): string {
  if (calendarDaysBetween(at, now) > RELATIVE_DAYS) return formatDate(locale, at, now);
  const text = formatRelativeTime(locale, at, now);
  return locale === 'en' ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** A list joined the way the locale joins it: "a, b, and c" / «أ وب وج». */
export function formatList(locale: Locale, items: readonly string[]): string {
  return lists(locale).format(items);
}

/** The Stop shortcut's name for `stop.tooltip`'s `{shortcut}` (SPEC §4.17). */
export function stopShortcut(isMac: boolean): string {
  return isMac ? '⌘.' : 'Ctrl+.';
}
