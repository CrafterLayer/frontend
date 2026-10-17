import { useState } from 'react';

import {
  filterTableRows,
  foldTableText,
  sortTableRows,
  type TableSortAs,
  type TableSortDirection,
} from './table-tools';

export interface TableSortState {
  readonly column: number;
  readonly direction: TableSortDirection;
  /** The page language the sort was asked in, for the text collator. */
  readonly locale: string | undefined;
}

export interface TableViewInput {
  /** Each row's committed cell text, one entry per drawn column. */
  readonly texts: readonly (readonly string[])[];
  /** Each column's `sortAs`. */
  readonly sortAs: readonly TableSortAs[];
  /** Rows per page; 0 draws every matching row. */
  readonly pageSize: number;
}

export interface TableView {
  /** The rows to draw (indexes into the document's rows), in display order. */
  readonly rows: readonly number[];
  /** How many rows match the search. */
  readonly shown: number;
  readonly total: number;
  /** The current page, 0-based, kept inside the pages there are. */
  readonly page: number;
  readonly pages: number;
  readonly query: string;
  readonly sort: TableSortState | undefined;
  readonly search: (query: string) => void;
  readonly sortBy: (column: number, locale: string | undefined) => void;
  readonly goTo: (page: number) => void;
}

/**
 * The live Table's view state: a search, a sort and a page, with the rows to
 * draw derived during render. A new search or sort returns to the first page;
 * sorting the sorted column again flips its direction.
 */
export function useTableView({ texts, sortAs, pageSize }: TableViewInput): TableView {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<TableSortState | undefined>(undefined);
  const [page, setPage] = useState(0);

  const order =
    sort === undefined
      ? texts.map((_, index) => index)
      : sortTableRows(
          texts,
          sort.column,
          sort.direction,
          sortAs[sort.column] ?? 'auto',
          sort.locale,
        );
  const matching = new Set(
    filterTableRows(
      texts.map((cells) => foldTableText(cells.join(' '))),
      query,
    ),
  );
  const filtered = order.filter((index) => matching.has(index));
  const pages = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const rows =
    pageSize > 0 ? filtered.slice(current * pageSize, (current + 1) * pageSize) : filtered;

  return {
    rows,
    shown: filtered.length,
    total: texts.length,
    page: current,
    pages,
    query,
    sort,
    search: (next) => {
      setQuery(next);
      setPage(0);
    },
    sortBy: (column, locale) => {
      setSort((previous) => ({
        column,
        direction:
          previous?.column === column && previous.direction === 'ascending'
            ? 'descending'
            : 'ascending',
        locale,
      }));
      setPage(0);
    },
    goTo: (next) => {
      setPage(Math.max(0, Math.min(next, pages - 1)));
    },
  };
}
