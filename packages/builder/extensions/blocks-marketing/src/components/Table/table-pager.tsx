import type { ReactNode } from 'react';

import { cx } from '../section-classes';

import { PAGER_BUTTON_CLASSES, type TablePart } from './table-classes';

export interface TablePagerProps {
  /** The navigation landmark's name ("Table pages"). */
  readonly label: string;
  readonly tableId: string;
  readonly part: TablePart;
  readonly previous: ReactNode;
  readonly next: ReactNode;
  /** "Page 1 of 3", or the inline editor while the template is edited in place. */
  readonly status: ReactNode;
  /** The raw page template, for the published page's behaviour pack. */
  readonly statusTemplate: string;
  readonly muted: string;
  readonly page: number;
  readonly pages: number;
  /** A client render: React pages. Otherwise the pager ships hidden for the pack. */
  readonly isLive: boolean;
  readonly onPage: (page: number) => void;
}

/* The arrows point along the reading direction: mirrored on an Arabic page. */
const PREVIOUS_ARROW = (
  <svg
    className="size-4 shrink-0 fill-none stroke-current stroke-2 rtl:-scale-x-100"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m10 3-5 5 5 5" />
  </svg>
);
const NEXT_ARROW = (
  <svg
    className="size-4 shrink-0 fill-none stroke-current stroke-2 rtl:-scale-x-100"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m6 3 5 5-5 5" />
  </svg>
);

/**
 * Previous / "Page 1 of 3" / Next under a paged table. The buttons stay
 * focusable at either end (`aria-disabled`, not `disabled`), so a keyboard
 * user pressing Next on the last page keeps their place; the page status is
 * announced politely. In a static render it is `hidden` until the
 * `table-tools` pack takes over.
 */
export function TablePager({
  label,
  tableId,
  part,
  previous,
  next,
  status,
  statusTemplate,
  muted,
  page,
  pages,
  isLive,
  onPage,
}: TablePagerProps) {
  const atStart = page <= 0;
  const atEnd = page >= pages - 1;
  return (
    <nav
      className="flex w-full flex-wrap items-center justify-between gap-gap-sm"
      aria-label={label}
      hidden={!isLive}
      data-ck-table-pager=""
    >
      <button
        className={PAGER_BUTTON_CLASSES}
        type="button"
        aria-controls={tableId}
        aria-disabled={atStart}
        data-ck-table-prev=""
        onClick={() => {
          if (!atStart) onPage(page - 1);
        }}
      >
        {PREVIOUS_ARROW}
        <span {...part('previousLabel')}>{previous}</span>
      </button>
      <p
        {...part('pageLabel', { className: cx('m-0 text-sm tabular-nums', muted) })}
        aria-live="polite"
        data-ck-table-page={isLive ? undefined : statusTemplate}
      >
        {status}
      </p>
      <button
        className={PAGER_BUTTON_CLASSES}
        type="button"
        aria-controls={tableId}
        aria-disabled={atEnd}
        data-ck-table-next=""
        onClick={() => {
          if (!atEnd) onPage(page + 1);
        }}
      >
        <span {...part('nextLabel')}>{next}</span>
        {NEXT_ARROW}
      </button>
    </nav>
  );
}
