import { normalizeDigits } from '../data-text';

/**
 * The period after the last one (2026-10-14), to label a projection: the next year, quarter,
 * month (English, short or long, in the case it was typed; or Arabic, either calendar's names)
 * or week. Undefined when the labels follow no pattern it knows — the page then says "next
 * period". A label only: the value beside it is the linear trend's, flagged as a projection.
 */

const EN_MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;
const AR_MONTHS = [
  [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ],
  [
    'كانون الثاني',
    'شباط',
    'آذار',
    'نيسان',
    'أيار',
    'حزيران',
    'تموز',
    'آب',
    'أيلول',
    'تشرين الأول',
    'تشرين الثاني',
    'كانون الأول',
  ],
] as const;

function fold(text: string): string {
  return text.trim().replace(/[أإآ]/gu, 'ا').replace(/ة/gu, 'ه').replace(/ى/gu, 'ي');
}

function cased(word: string, like: string): string {
  if (like === like.toUpperCase()) return word.toUpperCase();
  if (/^\p{Lu}/u.test(like)) return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
  return word;
}

/** An English month in the shape `last` has: "Mar" → "Apr", "december 2024" → "january 2025". */
function nextEnglishMonth(last: string): string | undefined {
  const match = /^([A-Za-z]+)\.?(?:([\s-]+)('?\d{2,4}))?$/u.exec(last.trim());
  if (match === null) return undefined;
  const [, word = '', gap = ' ', year] = match;
  const lower = word.toLowerCase();
  const at = lower.length < 3 ? -1 : EN_MONTHS.findIndex((month) => month.startsWith(lower));
  if (at < 0) return undefined;
  const nextAt = (at + 1) % 12;
  const full = EN_MONTHS[nextAt] ?? '';
  const name = cased(lower === EN_MONTHS[at] ? full : full.slice(0, 3), word);
  if (year === undefined) return name;
  if (nextAt !== 0) return `${name}${gap}${year}`;
  const digits = year.replace("'", '');
  const next = String(Number(digits) + 1).padStart(digits.length, '0');
  return `${name}${gap}${year.startsWith("'") ? "'" : ''}${next}`;
}

function nextArabicMonth(last: string): string | undefined {
  const folded = fold(last);
  for (const calendar of AR_MONTHS) {
    const at = calendar.findIndex((month) => fold(month) === folded);
    if (at >= 0) return calendar[(at + 1) % 12];
  }
  return undefined;
}

/** The label after the last of `labels`, or undefined. */
export function nextPeriodLabel(labels: readonly string[]): string | undefined {
  const last = labels.at(-1)?.trim();
  if (last === undefined || last === '') return undefined;
  const plain = normalizeDigits(last);
  if (/^(?:19|20)\d{2}$/u.test(plain)) return String(Number(plain) + 1);
  const quarter = /^([Qq])([1-4])(?:([\s-]+)((?:19|20)?\d{2}))?$/u.exec(plain);
  if (quarter !== null) {
    const [, q = 'Q', n = '1', gap = ' ', year] = quarter;
    const nextQuarter = (Number(n) % 4) + 1;
    if (year === undefined) return `${q}${String(nextQuarter)}`;
    const nextYear = nextQuarter === 1 ? String(Number(year) + 1).padStart(year.length, '0') : year;
    return `${q}${String(nextQuarter)}${gap}${nextYear}`;
  }
  const week = /^((?:week|wk|w)\s?)(\d{1,2})$/iu.exec(plain);
  if (week !== null) return `${week[1] ?? ''}${String(Number(week[2]) + 1)}`;
  return nextEnglishMonth(last) ?? nextArabicMonth(last);
}
