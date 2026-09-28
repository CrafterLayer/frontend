/**
 * Counted nouns (SPEC §4.0). The only file in the feature allowed to write a number
 * next to «قسم», «دقيقة» or «عنصر»: `copy-rules.test.ts` scans every other source file
 * for it.
 *
 * Arabic agrees a counted noun with its number in six forms, and the right form also
 * depends on case. These forms are the **nominative** ones, so the catalog puts a
 * `{sections}`, `{minutes}` or `{blocks}` slot only where the noun is a subject, a delayed
 * subject, or stands alone after a colon: «{sections} على الصفحة», «أُضيف {blocks}»,
 * «المتبقي تقريبًا: {minutes}». Anywhere else the catalog writes the count in parentheses
 * instead («حذف الأقسام الفارغة (3)»), or authors a button per plural category
 * (`footer.removeEmpty`). The zero form «لا أقسام» fits only where it can open the
 * sentence or stand after a colon, so a key that puts the noun after a verb or a
 * preposition authors its own zero sentence (`catalog.test.ts` reads each one at 0).
 *
 * The v1 panel wrote «{n} أقسام» for every count, which is wrong for 1, 2 and 11 to 102
 * (e.g. «1 أقسام», «11 أقسام»); the table below is the fix, per CLDR category.
 */
import type { Locale } from '../model/view-types';

import { formatNumber, pluralCategory, type PluralCategory } from './format';

/** A noun the panel counts. `block` is what `describeImpact` counts (SPEC §7.4). */
export type CountedNoun = 'section' | 'minute' | 'block';

const AR: Readonly<Record<CountedNoun, Readonly<Record<PluralCategory, string>>>> = {
  section: {
    zero: 'لا أقسام',
    one: 'قسم واحد',
    two: 'قسمان',
    few: '{n} أقسام',
    many: '{n} قسمًا',
    other: '{n} قسم',
  },
  minute: {
    // SPEC §4.0 marks zero minutes "n/a": the estimate says «المتبقي أقل من دقيقة» under
    // a minute and otherwise rounds up, so zero never reaches this noun. It is authored
    // as the `other` form so a stray zero still reads as a number, not as «لا دقائق».
    zero: '{n} دقيقة',
    one: 'دقيقة واحدة',
    two: 'دقيقتان',
    few: '{n} دقائق',
    many: '{n} دقيقةً',
    other: '{n} دقيقة',
  },
  // «عنصر», the word the catalog already uses for a block (`mention.label` «الأقسام
  // والعناصر»): a person reads "element", not the schema's "block".
  block: {
    zero: 'لا عناصر',
    one: 'عنصر واحد',
    two: 'عنصران',
    few: '{n} عناصر',
    many: '{n} عنصرًا',
    other: '{n} عنصر',
  },
};

const EN: Readonly<Record<CountedNoun, Readonly<Record<'one' | 'other', string>>>> = {
  section: { one: '{n} section', other: '{n} sections' },
  minute: { one: '{n} minute', other: '{n} minutes' },
  block: { one: '{n} block', other: '{n} blocks' },
};

/**
 * The catalog slots that stand for a counted noun, and the noun each counts. A noun slot
 * always counts the `n` param: «{sections} قيد الكتابة» with `{ n: 3 }`.
 */
export const NOUN_SLOTS = {
  sections: 'section',
  minutes: 'minute',
  blocks: 'block',
} as const satisfies Readonly<Record<string, CountedNoun>>;

/** A slot name that `t()` fills with a counted noun instead of a param. */
export type NounSlot = keyof typeof NOUN_SLOTS;

/** Whether a catalog slot is a counted noun. */
export function isNounSlot(slot: string): slot is NounSlot {
  return Object.hasOwn(NOUN_SLOTS, slot);
}

/**
 * `n` of `noun`, in the nominative, with Latin digits: «قسم واحد», «قسمان», «3 أقسام»,
 * «11 قسمًا», «100 قسم», «103 أقسام» / "1 section", "3 sections".
 */
export function countNoun(locale: Locale, noun: CountedNoun, n: number): string {
  const category = pluralCategory(locale, n);
  const form =
    locale === 'ar' ? AR[noun][category] : EN[noun][category === 'one' ? 'one' : 'other'];
  return form.replace('{n}', formatNumber(locale, n));
}
