import '../section-layout.css';

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

/*
  The box the scroll region draws. `current` rather than a text token for the
  hairlines, so a minimal table on a dark section draws light rules instead of
  dark-on-dark ones.
*/
const FRAME_CLASSES: Readonly<Record<TableProps['variant'], string>> = {
  boxed: 'rounded-xl border border-current/10 bg-surface text-text shadow-soft',
  minimal: '',
};

const HEADER_CLASSES: Readonly<Record<TableProps['variant'], string>> = {
  boxed: 'bg-current/5',
  minimal: 'border-b-2 border-current/25',
};

const CELL_PADDING: Readonly<Record<TableProps['density'], string>> = {
  comfortable: 'px-4 py-3',
  compact: 'px-3 py-1.5',
};

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

/** A semantic data table with column and row headers, inside a labelled scroll region. */
export function Table({ node, props, isCanvas }: BlockRenderProps<TableProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, tableSchema.parts);
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

        {/*
          A focusable, labelled region: a keyboard user can scroll a table
          wider than its column, and a screen reader announces what scrolls.
        */}
        <div
          role="region"
          className={cx(
            'w-full max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            FRAME_CLASSES[props.variant],
          )}
          tabIndex={0}
          aria-label={props.scrollLabel}
          data-table-scroll=""
        >
          <table
            className="w-full border-collapse text-start text-sm leading-normal"
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
            {!props.headerRow || props.columns.length === 0 ? null : (
              <thead className={HEADER_CLASSES[props.variant]}>
                <tr {...part('columns')}>
                  {props.columns.map((column, columnIndex) => (
                    /* Keyed by position: a bound value may be an inline editor element. */
                    <th
                      key={columnIndex}
                      {...part('column', {
                        index: [columnIndex],
                        className: cx(
                          'align-bottom font-semibold',
                          padding,
                          TEXT_ALIGN_CLASSES[column.align],
                        ),
                      })}
                      scope="col"
                    >
                      <span {...part('column.label', { index: [columnIndex] })}>
                        {column.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody {...part('rows')}>
              {props.rows.map((row, rowIndex) => (
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
                    const isRowHeader = props.firstColumnIsHeader && columnIndex === 0;
                    const className = cx(
                      'align-top tabular-nums',
                      padding,
                      alignOf(columnIndex),
                      isRowHeader ? 'font-semibold' : undefined,
                    );
                    /* A missing cell is drawn empty so the columns stay aligned; it has no value to edit. */
                    if (value === undefined) return <td key={columnIndex} className={className} />;
                    const attributes = cellAttributes(
                      part('row.cell', { index: [rowIndex, columnIndex], className }),
                    );
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
