import '../section-layout.css';

import { useSyncExternalStore, type ReactNode } from 'react';

import {
  blockPartProps,
  type BlockRenderProps,
  type PartAttributes,
} from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  GAP_CLASSES,
  TEXT_ALIGN_CLASSES,
  cx,
  sectionContentClasses,
  sectionShellClasses,
} from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import { tableSchema, type TableProps } from './schema';
import {
  CELL_PADDING,
  FRAME_CLASSES,
  SORT_BUTTON_CLASSES,
  STICKY_REGION_CLASSES,
  mutedInk,
  stickyHeaderClasses,
} from './table-classes';
import { TableHead } from './table-head';
import { TablePager } from './table-pager';
import { TableSearch } from './table-search';
import { TableSortIcon } from './table-sort-icon';
import { fillTableTemplate, tableSortKeys } from './table-tools';
import { useTableView } from './use-table-view';

/*
  Live (a client render: the canvas, Preview, Storybook) the tools sort,
  filter and page through React. Static (the published page, which never
  hydrates) the table renders every row in document order, the tools ship
  `hidden`, and the `table-tools` behaviour pack (renderer
  behaviors/packs/table-tools.ts) brings them to life — the Countdown's split.
*/
function subscribeNever(): () => void {
  return () => undefined;
}
function liveSnapshot(): boolean {
  return true;
}
function staticSnapshot(): boolean {
  return false;
}

/**
 * A text part's `dir="auto"` belongs on the TEXT, not on the cell: a cell
 * aligns `start` by its own direction, so an English product name in an Arabic
 * table would hug the left edge of a right-aligned column. The cell keeps the
 * table's direction (and any direction a person set on the part), and the
 * value inside it is isolated by `<bdi>` instead.
 */
function cellAttributes(attributes: PartAttributes): PartAttributes {
  if (attributes.dir !== 'auto') return attributes;
  const aligned = { ...attributes };
  delete aligned.dir;
  return aligned;
}

/* Sorting and searching read committed text: an inline editor's element counts as empty. */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/* A count or page template, filled; while it is edited in place, the editor itself. */
function filled(template: ReactNode, values: Readonly<Record<string, number>>): ReactNode {
  return typeof template === 'string' ? fillTableTemplate(template, values) : template;
}

/** A semantic data table with column and row headers, inside a labelled scroll region. */
export function Table({ node, props, isCanvas }: BlockRenderProps<TableProps>) {
  const headingId = `${node.id}-heading`;
  const tableId = `${node.id}-table`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, tableSchema.parts);
  const isLive = useSyncExternalStore(subscribeNever, liveSnapshot, staticSnapshot);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const hasTitle = props.title !== undefined;
  /*
    The columns decide how many cells a row shows; a row's extra cells are kept
    in the document but not drawn, so every drawn cell has a header. A table
    with no declared columns falls back to its widest row.
  */
  const columnCount =
    props.columns.length > 0
      ? props.columns.length
      : props.rows.reduce((widest, row) => Math.max(widest, row.cells.length), 0);
  const columnIndexes = Array.from({ length: columnCount }, (_, index) => index);
  const padding = CELL_PADDING[props.density];
  const alignOf = (column: number) => TEXT_ALIGN_CLASSES[props.columns[column]?.align ?? 'start'];
  const muted = mutedInk(props);

  const hasHeader = props.headerRow && props.columns.length > 0;
  const sortable = props.sortable && hasHeader;
  const paged = props.pageSize > 0 && props.rows.length > props.pageSize;
  const texts = props.rows.map((row) => columnIndexes.map((column) => textOf(row.cells[column])));
  const view = useTableView({
    texts,
    sortAs: props.columns.map((column) => column.sortAs),
    pageSize: isLive && paged ? props.pageSize : 0,
  });
  /* Static and sortable: how each column sorts, and each cell's key, written for the pack. */
  const sortPlan =
    sortable && !isLive
      ? columnIndexes.map((column) =>
          tableSortKeys(
            texts.map((cells) => cells[column] ?? ''),
            props.columns[column]?.sortAs ?? 'auto',
          ),
        )
      : undefined;
  /* Static, every row in document order: the full table is the page without script. */
  const drawn = isLive ? view.rows : props.rows.map((_, index) => index);
  const tools = sortable || props.searchable || paged;
  const behavior =
    isLive || !tools
      ? {}
      : {
          'data-ck-behavior': 'table-tools',
          ...(paged ? { 'data-ck-page-size': String(props.pageSize) } : {}),
        };
  const countValues = { shown: view.shown, total: view.total };
  /* Static, the pack starts on the first page: the status is written for it. */
  const pages = isLive ? view.pages : Math.ceil(props.rows.length / Math.max(props.pageSize, 1));
  const pageValues = { page: view.page + 1, pages };

  return (
    <section
      className={cx(
        sectionShellClasses(props.tone, props.spacing),
        '@container',
        sectionTypographyClasses(props),
        motionClassName,
        props.className,
      )}
      {...motionData}
      {...behavior}
      style={style}
      aria-labelledby={hasTitle ? headingId : undefined}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.md,
        )}
        data-table-content=""
      >
        {hasTitle ? (
          <h2
            {...part('title', {
              id: headingId,
              className:
                'm-0 text-2xl leading-tight font-bold tracking-tight text-balance @md:text-3xl',
            })}
          >
            {props.title}
          </h2>
        ) : null}

        {props.searchable ? (
          <TableSearch
            inputId={`${node.id}-search`}
            tableId={tableId}
            part={part}
            label={props.searchLabel}
            placeholder={textOf(props.searchPlaceholder)}
            count={filled(props.countLabel, countValues)}
            countTemplate={textOf(props.countLabel)}
            muted={muted}
            isLive={isLive}
            query={view.query}
            onQuery={view.search}
          />
        ) : null}

        {/* The published page's sort button, cloned by the pack around each sortable label. */}
        {sortable && !isLive ? (
          <template data-ck-table-button="">
            <button className={SORT_BUTTON_CLASSES} type="button">
              <TableSortIcon />
            </button>
          </template>
        ) : null}

        {/*
          A focusable, labelled region: a keyboard user can scroll a table
          wider than its column, and a screen reader announces what scrolls.
        */}
        <div
          role="region"
          className={cx(
            'w-full max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            FRAME_CLASSES[props.variant],
            props.stickyHeader ? STICKY_REGION_CLASSES : undefined,
          )}
          tabIndex={0}
          aria-label={props.scrollLabel}
          data-table-scroll=""
        >
          <table
            id={tools ? tableId : undefined}
            /* The box's ink sits on the table, a descendant of the surface, so a dark section's slab rules leave it dark (section-tone.ts). */
            className={cx(
              'w-full border-collapse text-start text-sm leading-normal',
              props.variant === 'boxed' ? 'text-text' : undefined,
            )}
            aria-labelledby={hasTitle ? headingId : undefined}
            data-table-variant={props.variant}
          >
            {props.caption === undefined ? null : (
              <caption
                {...part('caption', {
                  className: cx(
                    'caption-bottom px-4 py-3 text-start text-sm leading-relaxed',
                    props.variant === 'minimal' && props.tone === 'dark'
                      ? 'text-inherit opacity-80'
                      : 'text-text-muted',
                  ),
                })}
              >
                {props.caption}
              </caption>
            )}
            {hasHeader ? (
              <TableHead
                columns={props.columns}
                variant={props.variant}
                part={part}
                padding={padding}
                sticky={props.stickyHeader ? stickyHeaderClasses(props) : undefined}
                sortable={sortable}
                staticKinds={sortPlan?.map((plan) => plan.kind)}
                isLive={isLive}
                sort={view.sort}
                onSort={view.sortBy}
              />
            ) : null}
            <tbody {...part('rows')}>
              {drawn.map((rowIndex) => {
                const row = props.rows[rowIndex] ?? { cells: [] };
                return (
                  <tr
                    key={rowIndex}
                    {...part('row', {
                      index: [rowIndex],
                      className: cx(
                        'border-b border-current/10',
                        props.variant === 'boxed' ? 'last:border-b-0' : undefined,
                        props.striped ? 'even:bg-current/5' : undefined,
                      ),
                    })}
                  >
                    {columnIndexes.map((columnIndex) => {
                      const value = row.cells[columnIndex];
                      const key = sortPlan?.[columnIndex]?.keys[rowIndex];
                      const isRowHeader = props.firstColumnIsHeader && columnIndex === 0;
                      const className = cx(
                        'align-top tabular-nums',
                        padding,
                        alignOf(columnIndex),
                        isRowHeader ? 'font-semibold' : undefined,
                      );
                      /* A missing cell is drawn empty so the columns stay aligned; it has no value to edit. */
                      if (value === undefined)
                        return <td key={columnIndex} className={className} />;
                      const attributes = {
                        ...cellAttributes(
                          part('row.cell', { index: [rowIndex, columnIndex], className }),
                        ),
                        'data-ck-key': key === undefined ? undefined : String(key),
                      };
                      const content = <bdi>{value}</bdi>;
                      return isRowHeader ? (
                        <th key={columnIndex} {...attributes} scope="row">
                          {content}
                        </th>
                      ) : (
                        <td key={columnIndex} {...attributes}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {props.searchable ? (
          <p
            {...part('noResultsLabel', { className: cx('m-0 text-sm', muted) })}
            hidden={!isLive || view.shown > 0}
            data-ck-table-empty=""
          >
            {props.noResultsLabel}
          </p>
        ) : null}

        {paged ? (
          <TablePager
            label={textOf(props.paginationLabel)}
            tableId={tableId}
            part={part}
            previous={props.previousLabel}
            next={props.nextLabel}
            status={filled(props.pageLabel, pageValues)}
            statusTemplate={textOf(props.pageLabel)}
            muted={muted}
            page={view.page}
            pages={pages}
            isLive={isLive}
            onPage={view.goTo}
          />
        ) : null}
      </div>
    </section>
  );
}
