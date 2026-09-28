/**
 * Conversation search (SPEC §4.18 "Search field above 8 conversations"). Pure, beside the
 * popover that uses it.
 *
 * A conversation has no name: its row is titled by the first request, typed however the
 * person typed it that day. So the search folds both sides the way people type
 * interchangeably, Arabic first:
 * - hamza carriers and wasla to a bare alef («أ إ آ ٱ» → «ا»), «ؤ» → «و», «ئ» → «ي»;
 * - «ى» → «ي» and «ة» → «ه», the two endings people write either way;
 * - Persian-keyboard «ی» and «ک» to Arabic «ي» and «ك»;
 * - harakat, shadda, tanween and tatweel dropped, as Latin accents are;
 * - Arabic-Indic digits to Latin ones, and Latin case ignored.
 *
 * Every word of the query must appear, in any order: "clinic amman" finds "A dental clinic
 * page in Amman".
 */

const DIGIT_ZERO = { arabic: 0x0660, extended: 0x06f0 } as const;

/** A title or a query, folded for matching. Exported for its table test. */
export function foldForSearch(text: string): string {
  return (
    text
      // NFKD splits a hamza carrier into its alef, wāw or yāʾ plus a combining hamza, and
      // an accented Latin letter into its letter plus the accent: marks go next.
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/ـ/gu, '')
      .replace(/ٱ/gu, 'ا')
      .replace(/[ىی]/gu, 'ي')
      .replace(/ة/gu, 'ه')
      .replace(/ک/gu, 'ك')
      .replace(/[٠-٩]/gu, (digit) =>
        String(digit.charCodeAt(0) - DIGIT_ZERO.arabic),
      )
      .replace(/[۰-۹]/gu, (digit) =>
        String(digit.charCodeAt(0) - DIGIT_ZERO.extended),
      )
      .toLowerCase()
      .replace(/\s+/gu, ' ')
      .trim()
  );
}

/** Whether `title` holds every word of `query`, both folded. An empty query matches all. */
export function matchesQuery(title: string, query: string): boolean {
  const words = foldForSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const folded = foldForSearch(title);
  return words.every((word) => folded.includes(word));
}
