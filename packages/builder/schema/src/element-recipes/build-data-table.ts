import type { CustomCodeElement, CustomCodeNode } from '../custom-code/custom-code-tree';
import type { ElementRecipeContent, ElementRecipePalette } from './catalog';

/**
 * The `data-table` recipe: a semantic, responsive table for a free region.
 *
 * Content, in the shape every recipe takes:
 * - `title` is the visible `<caption>` (the table's name) and the scroll
 *   region's accessible name; `text` is a note under it;
 * - `label` holds the column headings, separated by `|` ("Plan | Price | Seats");
 * - each of `items` is a row: `title` is its row header (the first column),
 *   `text` the rest of its cells, separated by `|` ("$9 | 1").
 *
 * A column whose every filled cell reads as a number (a price, a count, a
 * duration; Arabic-Indic digits included) aligns to the end with tabular
 * figures. The table sits in a focusable, labelled region that scrolls
 * sideways on a phone instead of crushing its columns. A blank preset holds
 * placeholders, never invented figures.
 */
export function buildDataTable(
  locale: 'en' | 'ar',
  content: ElementRecipeContent,
  palette: ElementRecipePalette,
): CustomCodeElement {
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const frame =
    palette === 'page' ? 'ck-card' : 'rounded-2xl border border-text/15 bg-surface text-text';
  const muted = palette === 'page' ? 'ck-muted' : 'text-text-muted';
  const el = (
    tag: CustomCodeElement['tag'],
    className: string,
    text?: string,
    children?: CustomCodeNode[],
    attributes?: CustomCodeElement['attributes'],
  ): CustomCodeElement => ({
    kind: 'element',
    tag,
    ...(className === '' ? {} : { className }),
    ...(attributes === undefined ? {} : { attributes }),
    ...(text === undefined ? {} : { text }),
    ...(children === undefined ? {} : { children }),
  });
  const cells = (text: string | undefined): string[] =>
    (text ?? '')
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell !== '');

  const items = content.items ?? [
    { title: t('First item', 'البند الأول'), text: t('Add its detail', 'أضف التفاصيل') },
    { title: t('Second item', 'البند الثاني'), text: t('Add its detail', 'أضف التفاصيل') },
    { title: t('Third item', 'البند الثالث'), text: t('Add its detail', 'أضف التفاصيل') },
  ];
  const rows = items.map((item) => [item.title, ...cells(item.text)]);
  const given = cells(content.label);
  const width = Math.max(given.length, ...rows.map((row) => row.length), 2);
  const headings = Array.from(
    { length: width },
    (_, index) =>
      given[index] ??
      (index === 0
        ? t('Item', 'البند')
        : index === 1
          ? t('Details', 'التفاصيل')
          : t(`Column ${String(index + 1)}`, `العمود ${String(index + 1)}`)),
  );
  /* A number with at most a short unit beside it: "$1,240", "٣٩٩٩ ر.س", "30 min", "12%". */
  const numeric = headings.map((_, column) => {
    const filled = rows.map((row) => row[column] ?? '').filter((cell) => cell !== '');
    return (
      column > 0 &&
      filled.length > 0 &&
      filled.every((cell) => {
        const plain = cell.replace(/[\u0660-\u0669\u06f0-\u06f9]/gu, '0');
        return /\d/u.test(plain) && (plain.match(/\p{L}/gu)?.length ?? 0) <= 4;
      })
    );
  });
  const align = (column: number) =>
    numeric[column] === true ? 'text-end tabular-nums' : 'text-start';
  const name = content.title ?? t('Data table', 'جدول البيانات');

  const caption = el(
    'caption',
    'px-4 py-3 text-start text-base font-semibold leading-snug',
    content.text === undefined ? name : undefined,
    content.text === undefined
      ? undefined
      : [
          el('span', 'block break-words', name),
          el(
            'span',
            `mt-1 block text-sm font-normal leading-relaxed break-words ${muted}`,
            content.text,
          ),
        ],
  );
  const head = el('thead', 'border-b border-text/15', undefined, [
    el(
      'tr',
      '',
      undefined,
      headings.map((heading, column) =>
        el('th', `px-4 py-3 font-semibold whitespace-nowrap ${align(column)}`, heading, undefined, {
          scope: 'col',
        }),
      ),
    ),
  ]);
  const body = el(
    'tbody',
    'divide-y divide-text/10',
    undefined,
    rows.map((row) =>
      el(
        'tr',
        '',
        undefined,
        headings.map((_, column) =>
          column === 0
            ? el('th', 'px-4 py-3 text-start font-medium break-words', row[0] ?? '', undefined, {
                scope: 'row',
              })
            : el('td', `px-4 py-3 ${align(column)}`, row[column] ?? ''),
        ),
      ),
    ),
  );
  return el(
    'div',
    `min-w-0 w-full max-w-full overflow-x-auto ${frame} focus-visible:ring-2 focus-visible:ring-accent`,
    undefined,
    [el('table', 'w-full text-sm', undefined, [caption, head, body])],
    { role: 'region', 'aria-label': name, tabindex: '0' },
  );
}
