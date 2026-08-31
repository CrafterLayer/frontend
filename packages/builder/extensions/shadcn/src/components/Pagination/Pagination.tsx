import type { MouseEvent as ReactMouseEvent } from 'react';
import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { PaginationProps } from './schema';

type PageRangeItem = number | string;

const ALIGN_CLASSES: Readonly<Record<PaginationProps['align'], string>> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

const SIZE_CLASSES: Readonly<Record<PaginationProps['size'], string>> = {
  sm: 'min-h-9 min-w-9 px-3 text-sm',
  md: 'min-h-11 min-w-11 px-4 text-base',
  lg: 'min-h-12 min-w-12 px-5 text-lg',
};

const TONE_CLASSES: Readonly<Record<PaginationProps['tone'], string>> = {
  transparent: 'border-transparent bg-transparent text-inherit',
  surface: 'border-text/10 bg-surface text-text shadow-soft',
  inverse: 'border-text-inverse/10 bg-surface-inverse text-text-inverse shadow-strong',
};

function pageRange(
  requestedCurrent: number,
  pageCount: number,
  siblingCount: number,
  showFirstLast: boolean,
): PageRangeItem[] {
  const current = Math.min(Math.max(requestedCurrent, 1), pageCount);
  const visible = new Set<number>();
  for (
    let page = Math.max(1, current - siblingCount);
    page <= Math.min(pageCount, current + siblingCount);
    page += 1
  ) {
    visible.add(page);
  }
  if (showFirstLast) {
    visible.add(1);
    visible.add(pageCount);
  }

  const sorted = [...visible].sort((left, right) => left - right);
  const result: PageRangeItem[] = [];
  let previous: number | undefined;
  for (const page of sorted) {
    if (previous !== undefined && page - previous === 2) result.push(previous + 1);
    if (previous !== undefined && page - previous > 2) {
      result.push(`ellipsis-${String(previous)}-${String(page)}`);
    }
    result.push(page);
    previous = page;
  }
  return result;
}

function pageHref(template: string, page: number): string {
  return template.split('{page}').join(String(page));
}

/** Semantic pagination with generated sibling ranges or a fully explicit navigation list. */
export function Pagination({ node, props, isCanvas }: BlockRenderProps<PaginationProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  const currentPage = Math.min(props.currentPage, props.pageCount);
  const generatedItems = pageRange(
    currentPage,
    props.pageCount,
    props.siblingCount,
    props.showFirstLast,
  );
  const previousHref =
    props.mode === 'explicit'
      ? props.previousHref
      : currentPage > 1
        ? (props.previousHref ?? pageHref(props.pageHrefTemplate, currentPage - 1))
        : undefined;
  const nextHref =
    props.mode === 'explicit'
      ? props.nextHref
      : currentPage < props.pageCount
        ? (props.nextHref ?? pageHref(props.pageHrefTemplate, currentPage + 1))
        : undefined;

  const handleNavigation = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (isCanvas) event.preventDefault();
  };

  return (
    <nav
      className={clsx(
        '@container flex w-full min-w-0 rounded-xl border p-2',
        TONE_CLASSES[props.tone],
        motionClassName,
        props.className,
      )}
      aria-label={props.navigationLabel}
      data-pagination={node.id}
      {...motionData}
    >
      <ul
        className={clsx(
          'm-0 flex w-full min-w-0 list-none flex-wrap items-center gap-1 p-0',
          ALIGN_CLASSES[props.align],
        )}
      >
        <li>
          {previousHref === undefined ? (
            <span
              className={clsx(
                'inline-flex items-center justify-center gap-2 rounded-lg border border-transparent opacity-40',
                SIZE_CLASSES[props.size],
              )}
              aria-disabled="true"
            >
              <span aria-hidden="true" className="rtl:rotate-180">
                ←
              </span>
              <span className={props.variant === 'compact' ? 'inline' : 'sr-only @sm:not-sr-only'}>
                {props.previousLabel}
              </span>
            </span>
          ) : (
            <a
              className={clsx(
                'inline-flex items-center justify-center gap-2 rounded-lg border border-current/20 text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                SIZE_CLASSES[props.size],
              )}
              href={previousHref}
              rel="prev"
              aria-label={props.previousLabel}
              onClick={handleNavigation}
            >
              <span aria-hidden="true" className="rtl:rotate-180">
                ←
              </span>
              <span className={props.variant === 'compact' ? 'inline' : 'sr-only @sm:not-sr-only'}>
                {props.previousLabel}
              </span>
            </a>
          )}
        </li>

        {props.variant === 'compact' ? (
          <li className="px-2 text-sm font-semibold tabular-nums" aria-live="polite">
            {props.pageLabel} {String(currentPage)} / {String(props.pageCount)}
          </li>
        ) : props.mode === 'explicit' ? (
          props.items.map((item, index) => (
            <li key={`${item.label}-${String(index)}`}>
              {item.current ? (
                <span
                  className={clsx(
                    'inline-flex items-center justify-center rounded-lg border border-accent bg-accent font-semibold text-accent-text shadow-soft',
                    SIZE_CLASSES[props.size],
                  )}
                  aria-current="page"
                  aria-label={item.label}
                >
                  {item.label}
                </span>
              ) : item.href === undefined || item.disabled ? (
                <span
                  className={clsx(
                    'inline-flex items-center justify-center rounded-lg border border-transparent opacity-50',
                    SIZE_CLASSES[props.size],
                  )}
                  aria-disabled="true"
                >
                  {item.label}
                </span>
              ) : (
                <a
                  className={clsx(
                    'inline-flex items-center justify-center rounded-lg border border-transparent text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    SIZE_CLASSES[props.size],
                  )}
                  href={item.href}
                  aria-label={item.label}
                  onClick={handleNavigation}
                >
                  {item.label}
                </a>
              )}
            </li>
          ))
        ) : (
          generatedItems.map((item) =>
            typeof item === 'number' ? (
              <li key={item}>
                {item === currentPage ? (
                  <span
                    className={clsx(
                      'inline-flex items-center justify-center rounded-lg border border-accent bg-accent font-semibold text-accent-text shadow-soft',
                      SIZE_CLASSES[props.size],
                    )}
                    aria-current="page"
                    aria-label={`${props.pageLabel} ${String(item)}`}
                  >
                    {item}
                  </span>
                ) : (
                  <a
                    className={clsx(
                      'inline-flex items-center justify-center rounded-lg border border-transparent text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      SIZE_CLASSES[props.size],
                    )}
                    href={pageHref(props.pageHrefTemplate, item)}
                    aria-label={`${props.pageLabel} ${String(item)}`}
                    onClick={handleNavigation}
                  >
                    {item}
                  </a>
                )}
              </li>
            ) : (
              <li key={item}>
                <span
                  className={clsx(
                    'inline-flex items-center justify-center opacity-70',
                    SIZE_CLASSES[props.size],
                  )}
                >
                  <span aria-hidden="true">…</span>
                  <span className="sr-only">{props.ellipsisLabel}</span>
                </span>
              </li>
            ),
          )
        )}

        <li>
          {nextHref === undefined ? (
            <span
              className={clsx(
                'inline-flex items-center justify-center gap-2 rounded-lg border border-transparent opacity-40',
                SIZE_CLASSES[props.size],
              )}
              aria-disabled="true"
            >
              <span className={props.variant === 'compact' ? 'inline' : 'sr-only @sm:not-sr-only'}>
                {props.nextLabel}
              </span>
              <span aria-hidden="true" className="rtl:rotate-180">
                →
              </span>
            </span>
          ) : (
            <a
              className={clsx(
                'inline-flex items-center justify-center gap-2 rounded-lg border border-current/20 text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                SIZE_CLASSES[props.size],
              )}
              href={nextHref}
              rel="next"
              aria-label={props.nextLabel}
              onClick={handleNavigation}
            >
              <span className={props.variant === 'compact' ? 'inline' : 'sr-only @sm:not-sr-only'}>
                {props.nextLabel}
              </span>
              <span aria-hidden="true" className="rtl:rotate-180">
                →
              </span>
            </a>
          )}
        </li>
      </ul>
    </nav>
  );
}
