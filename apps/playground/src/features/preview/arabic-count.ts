/**
 * The words that follow a count in Arabic, by the count's form. Each is the
 * nominative phrase a label reads: «صفحة واحدة», «صفحتان», «3 صفحات», «11 صفحة».
 */
export interface ArabicCountForms {
  /** The whole phrase for one, without a digit: «صفحة واحدة». */
  readonly one: string;
  /** The dual, without a digit: «صفحتان». */
  readonly two: string;
  /** After 3 to 10 (and 103 to 110, …): the plural, «صفحات». */
  readonly few: string;
  /** After 11 to 99 (and 111 to 199, …): the singular tamyīz, «صفحة» / «رابطًا». */
  readonly many: string;
  /** After 0, 100, 101, 102, 200, …: the singular genitive. Defaults to `many`. */
  readonly other?: string | undefined;
}

/**
 * A count with its Arabic agreement, digits kept Latin (the editor's rule).
 *
 * Arabic has four everyday forms after a number: one, two (the dual), three to
 * ten (the plural) and eleven upward (the singular) — a single "N pages"
 * template reads as a mistake to a native reader. The same split as the shell's
 * `arabicCount` in `fields/field-labels.ts` (not exported from the package),
 * plus CLDR's `other` for the hundreds, where an accusative tamyīz such as
 * «رابطًا» turns genitive («100 رابط»).
 */
export function arabicCount(count: number, forms: ArabicCountForms): string {
  if (count === 1) return forms.one;
  if (count === 2) return forms.two;
  const tail = count % 100;
  if (tail >= 3 && tail <= 10) return `${String(count)} ${forms.few}`;
  if (tail >= 11 && tail <= 99) return `${String(count)} ${forms.many}`;
  return `${String(count)} ${forms.other ?? forms.many}`;
}

/** «صفحة واحدة», «صفحتان», «3 صفحات», «11 صفحة». */
export const AR_PAGES: ArabicCountForms = {
  one: 'صفحة واحدة',
  two: 'صفحتان',
  few: 'صفحات',
  many: 'صفحة',
};

/** «مصدر مشترك واحد», «مصدران مشتركان», «3 مصادر مشتركة», «11 مصدرًا مشتركًا». */
export const AR_SHARED_SOURCES: ArabicCountForms = {
  one: 'مصدر مشترك واحد',
  two: 'مصدران مشتركان',
  few: 'مصادر مشتركة',
  many: 'مصدرًا مشتركًا',
  other: 'مصدر مشترك',
};
