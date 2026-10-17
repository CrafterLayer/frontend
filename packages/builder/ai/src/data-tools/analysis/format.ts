/**
 * Numbers as a report page prints them (2026-10-14), in the page's language: an Arabic page gets
 * Arabic-Indic digits and separators (`ar-u-nu-arab`, as the marketing blocks' count-up does for
 * 'ar'), an English page Latin ones. The unit the person typed stays on the number (`$1,200`,
 * `١٬٢٠٠ ر.س`, `45%`); percentages carry one decimal. Only computed values pass through here.
 */

export type ReportLang = 'en' | 'ar';

export interface Unit {
  /** What stood before the numbers (`$`, `SAR `), '' for none. */
  readonly prefix: string;
  /** What stood after them (`%`, ` kg`, ` ر.س`), '' for none. */
  readonly suffix: string;
}

export const NO_UNIT: Unit = { prefix: '', suffix: '' };
export const PERCENT_UNIT: Unit = { prefix: '', suffix: '%' };

const LOCALES: Readonly<Record<ReportLang, string>> = { en: 'en-US', ar: 'ar-u-nu-arab' };
const FORMATS = new Map<string, Intl.NumberFormat>();

function formatter(lang: ReportLang, min: number, max: number): Intl.NumberFormat {
  const key = `${lang}:${String(min)}:${String(max)}`;
  let format = FORMATS.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(LOCALES[lang], {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      useGrouping: true,
    });
    FORMATS.set(key, format);
  }
  return format;
}

/** The decimals a value needs: none from 100, one from 10, two below. */
function decimals(value: number): number {
  const size = Math.abs(value);
  if (size >= 100) return 0;
  return size >= 10 ? 1 : 2;
}

function signOf(value: number, signed: boolean): string {
  if (value < 0) return '-';
  return signed && value > 0 ? '+' : '';
}

/** A plain number: grouped, rounded to the decimals its size needs. */
export function formatNumber(value: number, lang: ReportLang, signed = false): string {
  const digits = decimals(value);
  const text = formatter(lang, 0, digits).format(Math.abs(value));
  return `${signOf(value, signed)}${text}`;
}

/** A number with its unit, a minus or plus before the currency: `-$1,200`, `+١٢ ر.س`. */
export function formatValue(value: number, unit: Unit, lang: ReportLang, signed = false): string {
  if (unit.suffix.trim() === '%') return formatPercent(value, lang, signed);
  const text = formatNumber(Math.abs(value), lang);
  return `${signOf(value, signed)}${unit.prefix}${text}${unit.suffix}`;
}

/** A percent number with one decimal: `12.5%`, `١٢٫٥٪`. */
export function formatPercent(value: number, lang: ReportLang, signed = false): string {
  const text = formatter(lang, 1, 1).format(Math.abs(value));
  return `${signOf(value, signed)}${text}${lang === 'ar' ? '٪' : '%'}`;
}

/** A change of a percent column, in points with one decimal: `+4.0`, `+٤٫٠` (the word is the caller's). */
export function formatPoints(value: number, lang: ReportLang, signed = false): string {
  return `${signOf(value, signed)}${formatter(lang, 1, 1).format(Math.abs(value))}`;
}

/** A ratio with two decimals (R², r): `0.97`, `٠٫٩٧`. */
export function formatRatio(value: number, lang: ReportLang): string {
  return `${signOf(value, false)}${formatter(lang, 2, 2).format(Math.abs(value))}`;
}

/** A number shortened (`1.2M`) with its unit, for a card too narrow for every digit. */
export function formatCompact(value: number, unit: Unit, lang: ReportLang): string {
  const text = new Intl.NumberFormat(LOCALES[lang], {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  return `${signOf(value, false)}${unit.prefix}${text}${unit.suffix}`;
}

/** A count: `12`, `١٢`. */
export function formatCount(value: number, lang: ReportLang): string {
  return formatter(lang, 0, 0).format(value);
}
