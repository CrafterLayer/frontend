/*
  The Table block's interactive tools as pure functions: how a cell reads as a
  number or a date, how a column sorts, how a search folds Arabic and English
  text, and how a count template is filled. The React render (canvas, Preview,
  Storybook) uses these. The published page's `table-tools` behaviour pack
  (renderer behaviors/packs/table-tools.ts) cannot import, so the static
  render writes each sortable cell's key into the markup with
  `tableSortKeys`, and the pack carries only a copy of the search fold and the
  template fill. Table.static.test.tsx runs the pack on the block's own markup
  and holds both orders equal.
*/

export const tableSortKinds = ['auto', 'text', 'number', 'date'] as const;
export type TableSortAs = (typeof tableSortKinds)[number];
export type TableSortKind = Exclude<TableSortAs, 'auto'>;
export type TableSortDirection = 'ascending' | 'descending';

/** Arabic-Indic (٠–٩) and Extended Arabic-Indic (۰–۹) digits as ASCII digits. */
export function westernDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06f0-\u06f9]/gu, (digit) =>
    String((digit.codePointAt(0) ?? 0) & 15),
  );
}

/**
 * The first number a cell holds: "$1,200" → 1200, "٣٩٩٩ ر.س" → 3999,
 * "30 min" → 30, "٢٫٥" → 2.5. Commas and the Arabic thousands mark group;
 * the Arabic decimal mark is a point.
 */
export function tableNumber(text: string): number | undefined {
  const plain = westernDigits(text)
    .replace(/[,\u066c\s]/gu, '')
    .replace(/\u066b/gu, '.')
    .replace(/\u2212/gu, '-');
  const match = /-?\d+(?:\.\d+)?/u.exec(plain);
  return match === null ? undefined : Number(match[0]);
}

/**
 * A date a cell holds, as a sortable instant: ISO `2026-03-01` (with an
 * optional `10:30`), day-first `1/3/2026` (the order most of the world and
 * every Arabic locale writes), or a month name with a four-digit year
 * ("1 March 2026", "Mar 1, 2026").
 */
export function tableDate(text: string): number | undefined {
  const plain = westernDigits(text).trim();
  const n = (part: string | undefined): number => (part === undefined ? 0 : Number(part));
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/u.exec(plain);
  if (iso !== null) return Date.UTC(n(iso[1]), n(iso[2]) - 1, n(iso[3]), n(iso[4]), n(iso[5]));
  const dayFirst = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/u.exec(plain);
  if (dayFirst !== null) return Date.UTC(n(dayFirst[3]), n(dayFirst[2]) - 1, n(dayFirst[1]));
  /* A month name and a four-digit year: engines read "Room 2026" as a date too. */
  if (
    !/\d{4}/u.test(plain) ||
    !/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/iu.test(plain)
  )
    return undefined;
  const parsed = Date.parse(plain);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** How a column sorts when its `sortAs` is `auto`: dates, then numbers, else text. */
export function tableColumnKind(values: readonly string[]): TableSortKind {
  const filled = values.map((value) => value.trim()).filter((value) => value !== '');
  if (filled.length === 0) return 'text';
  if (filled.every((value) => tableDate(value) !== undefined)) return 'date';
  if (filled.every((value) => tableNumber(value) !== undefined)) return 'number';
  return 'text';
}

export interface TableSortKeys {
  /** How the column sorts: `auto` resolved from its cells. */
  readonly kind: TableSortKind;
  /** Per row, the number or instant a `number` or `date` column sorts by; none for an empty or unreadable cell. */
  readonly keys: readonly (number | undefined)[];
}

/**
 * What one column sorts by. The live render sorts with these keys and the
 * static render writes them on the cells (`data-ck-key`) for the published
 * page's `table-tools` pack, so both order the rows the same way.
 */
export function tableSortKeys(values: readonly string[], sortAs: TableSortAs): TableSortKeys {
  const kind = sortAs === 'auto' ? tableColumnKind(values) : sortAs;
  const read = kind === 'date' ? tableDate : tableNumber;
  return {
    kind,
    keys: values.map((value) => (kind === 'text' || value.trim() === '' ? undefined : read(value))),
  };
}

/**
 * The display order of the rows sorted by one column: empty cells (and cells
 * a number or date column cannot read) last in either direction, ties in
 * document order. Text compares with `Intl.Collator` in the page's language
 * (Arabic and Latin each in their own alphabet order, digits as numbers).
 */
export function sortTableRows(
  texts: readonly (readonly string[])[],
  column: number,
  direction: TableSortDirection,
  sortAs: TableSortAs,
  locale?: string,
): number[] {
  const values = texts.map((cells) => (cells[column] ?? '').trim());
  const { kind, keys } = tableSortKeys(values, sortAs);
  let collator: Intl.Collator;
  try {
    collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  } catch {
    collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  }
  const keyOf = (index: number): number | string | undefined =>
    kind !== 'text' ? keys[index] : values[index] === '' ? undefined : values[index];
  const sign = direction === 'descending' ? -1 : 1;
  return values
    .map((_, index) => index)
    .sort((a, b) => {
      const left = keyOf(a);
      const right = keyOf(b);
      if (left === undefined || right === undefined) {
        return left === right ? a - b : left === undefined ? 1 : -1;
      }
      const order =
        typeof left === 'number' ? left - Number(right) : collator.compare(left, String(right));
      return order * sign || a - b;
    });
}

/**
 * Text as a search compares it: lower case, Latin accents and Arabic
 * diacritics (harakat, tatweel, hamza and madda marks) dropped, alef forms as
 * one alef, taa marbuta as haa, alef maqsura as yaa, every digit ASCII. So
 * "أحمد" finds "احمد", "٣" finds "3", "cafe" finds "Café".
 */
export function foldTableText(text: string): string {
  return westernDigits(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u0640\u064b-\u065f\u0670]/gu, '')
    .replace(/\u0671/gu, '\u0627')
    .replace(/\u0629/gu, '\u0647')
    .replace(/\u0649/gu, '\u064a')
    .toLowerCase();
}

/** The rows (by index) whose folded text holds every word of the query. */
export function filterTableRows(folded: readonly string[], query: string): number[] {
  const words = foldTableText(query)
    .split(/\s+/u)
    .filter((word) => word !== '');
  return folded
    .map((_, index) => index)
    .filter((index) => words.every((word) => folded[index]?.includes(word) === true));
}

/**
 * A count or page template with its numbers in place: `{shown} of {total}
 * rows` → "4 of 12 rows". A template written in Arabic prints Arabic-Indic
 * digits ("٤ من ١٢ صفًا"); an unknown `{name}` stays as written.
 */
export function fillTableTemplate(
  template: string,
  values: Readonly<Record<string, number>>,
): string {
  const arabic = /[\u0600-\u06ff]/u.test(template);
  return template.replace(/\{(\w+)\}/gu, (all, name: string) => {
    const value = values[name];
    if (value === undefined) return all;
    return arabic ? value.toLocaleString('ar-u-nu-arab') : String(value);
  });
}
