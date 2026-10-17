import { TEXT_ALIGN_CLASSES, cx } from '../section-classes';

import { HEADER_CLASSES, SORT_BUTTON_CLASSES, type TablePart } from './table-classes';
import { TableSortIcon } from './table-sort-icon';
import type { TableProps } from './schema';
import type { TableSortKind } from './table-tools';
import type { TableSortState } from './use-table-view';

export interface TableHeadProps {
  readonly columns: TableProps['columns'];
  readonly variant: TableProps['variant'];
  readonly part: TablePart;
  /** The density's cell padding. */
  readonly padding: string;
  /** The sticky header cells' classes, when the header is sticky. */
  readonly sticky: string | undefined;
  readonly sortable: boolean;
  /** Static and sortable: how each column sorts, for the published page's pack. */
  readonly staticKinds: readonly TableSortKind[] | undefined;
  /** A client render: React sorts. Otherwise the page's behaviour pack does. */
  readonly isLive: boolean;
  readonly sort: TableSortState | undefined;
  readonly onSort: (column: number, locale: string | undefined) => void;
}

/** The page language around an element, for the text collator. */
function languageAround(element: Element): string | undefined {
  const lang = element.closest('[lang]')?.getAttribute('lang') ?? '';
  return lang === '' ? undefined : lang;
}

/**
 * The column headers. A sortable column's label sits in a button and its
 * header carries `aria-sort` once sorted. In a static render (the published
 * page) the header only carries `data-ck-table-sort` (how the column sorts:
 * `number`, `date` or `text`): the `table-tools` pack wraps the label in a
 * button from the block's template, so without the script it is plain text.
 */
export function TableHead({
  columns,
  variant,
  part,
  padding,
  sticky,
  sortable,
  staticKinds,
  isLive,
  sort,
  onSort,
}: TableHeadProps) {
  return (
    <thead className={HEADER_CLASSES[variant]}>
      <tr {...part('columns')}>
        {columns.map((column, columnIndex) => {
          /* Keyed by position: a bound value may be an inline editor element. */
          const label = (
            <span {...part('column.label', { index: [columnIndex] })}>{column.label}</span>
          );
          return (
            <th
              key={columnIndex}
              {...part('column', {
                index: [columnIndex],
                className: cx(
                  'align-bottom font-semibold',
                  padding,
                  TEXT_ALIGN_CLASSES[column.align],
                  sticky,
                  sortable ? 'group' : undefined,
                ),
              })}
              scope="col"
              aria-sort={isLive && sort?.column === columnIndex ? sort.direction : undefined}
              data-sort-up={
                isLive && sort?.column === columnIndex && sort.direction === 'ascending'
                  ? ''
                  : undefined
              }
              data-sort-down={
                isLive && sort?.column === columnIndex && sort.direction === 'descending'
                  ? ''
                  : undefined
              }
              data-ck-table-sort={staticKinds?.[columnIndex]}
            >
              {sortable && isLive ? (
                <button
                  className={SORT_BUTTON_CLASSES}
                  type="button"
                  onClick={(event) => {
                    onSort(columnIndex, languageAround(event.currentTarget));
                  }}
                >
                  {label}
                  <TableSortIcon />
                </button>
              ) : (
                label
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
