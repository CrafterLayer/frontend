import type { ChangeEvent, ReactNode } from 'react';

import { cx } from '../section-classes';

import { SEARCH_INPUT_CLASSES, type TablePart } from './table-classes';

export interface TableSearchProps {
  /** The input's id; the visible label points at it. */
  readonly inputId: string;
  readonly tableId: string;
  readonly part: TablePart;
  readonly label: ReactNode;
  readonly placeholder: string;
  /** "4 of 12 rows", or the inline editor while the template is edited in place. */
  readonly count: ReactNode;
  /** The raw count template, for the published page's behaviour pack. */
  readonly countTemplate: string;
  readonly muted: string;
  /** A client render: React filters. Otherwise the box ships hidden for the pack. */
  readonly isLive: boolean;
  readonly query: string;
  readonly onQuery: (query: string) => void;
}

/**
 * The filter box over a table: a visible label, a search field and a polite
 * count of the rows that match. In a static render (the published page) it is
 * `hidden` and uncontrolled; the `table-tools` pack reveals it, so a page
 * without script shows no control that cannot work.
 */
export function TableSearch({
  inputId,
  tableId,
  part,
  label,
  placeholder,
  count,
  countTemplate,
  muted,
  isLive,
  query,
  onQuery,
}: TableSearchProps) {
  return (
    <div
      className="flex w-full flex-wrap items-end justify-between gap-gap-sm"
      hidden={!isLive}
      data-ck-table-search=""
    >
      <div className="flex w-full min-w-0 flex-col gap-1.5 @md:w-80">
        <label {...part('searchLabel', { className: 'text-sm font-semibold' })} htmlFor={inputId}>
          {label}
        </label>
        <div className="relative">
          <svg
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 fill-none stroke-current stroke-2 text-text-muted"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id={inputId}
            className={SEARCH_INPUT_CLASSES}
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder={placeholder}
            aria-controls={tableId}
            data-ck-table-query=""
            {...(isLive
              ? {
                  value: query,
                  onChange: (event: ChangeEvent<HTMLInputElement>) => {
                    onQuery(event.currentTarget.value);
                  },
                }
              : {})}
          />
        </div>
      </div>
      {/* A status: the count is announced politely as the matches change. */}
      <p
        {...part('countLabel', { className: cx('m-0 text-sm tabular-nums', muted) })}
        role="status"
        data-ck-table-count={isLive ? undefined : countTemplate}
      >
        {count}
      </p>
    </div>
  );
}
