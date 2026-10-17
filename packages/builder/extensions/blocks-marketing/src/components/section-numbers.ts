/**
 * Numbers a section prints from numeric props — a rating average, a share of
 * reviews, an amount raised — in the page's digits. Countdown's
 * `dateLanguage` set the convention: `'ar'` prints Arabic-Indic digits
 * (٤٫٧, ٧٨٪), `'en'` Latin ones. Schema-safe (no React): the enum is shared
 * with the schemas that declare the prop.
 */
export const numberLanguages = ['en', 'ar'] as const;
export type NumberLanguage = (typeof numberLanguages)[number];

const LOCALES: Readonly<Record<NumberLanguage, string>> = { en: 'en', ar: 'ar-u-nu-arab' };

export function formatNumber(
  value: number,
  language: NumberLanguage,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(LOCALES[language], options).format(value);
}

/** `part / whole` as a whole percentage ("78%", "٧٨٪"); 0 when there is nothing to divide. */
export function formatShare(part: number, whole: number, language: NumberLanguage): string {
  return formatNumber(whole > 0 ? part / whole : 0, language, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
}

/** `part / whole` as a CSS percentage for a bar, clamped to 0–100%. */
export function shareWidth(part: number, whole: number): string {
  const ratio = whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0;
  return `${String(Math.round(ratio * 1000) / 10)}%`;
}
