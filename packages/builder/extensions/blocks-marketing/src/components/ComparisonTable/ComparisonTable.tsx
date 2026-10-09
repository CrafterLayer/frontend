import '../section-layout.css';

import type { ReactNode } from 'react';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  GAP_CLASSES,
  cx,
  sectionContentClasses,
  sectionShellClasses,
} from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import { comparisonTableSchema, type ComparisonTableProps } from './schema';

const TABLE_CLASSES: Record<ComparisonTableProps['variant'], string> = {
  boxed:
    'border-separate border-spacing-0 overflow-hidden rounded-xl border border-text/10 bg-surface text-text shadow-elevated',
  minimal: 'border-collapse text-inherit',
  contrast:
    'border-separate border-spacing-0 overflow-hidden rounded-xl bg-surface-inverse text-text-inverse shadow-elevated mkt-slab',
};

function featuredCellClasses(featured: boolean, variant: ComparisonTableProps['variant']): string {
  if (!featured) return '';
  return variant === 'contrast' ? 'bg-accent text-accent-text' : 'bg-accent/10 text-text';
}

/*
  `emptyValue` is ONE part shown in every empty cell. While it is edited in
  place its value is the editor element, which must render exactly once: the
  first empty cell hosts it and the others show the text once it is committed.
*/
function sharedText(value: ReactNode, host: boolean): ReactNode {
  return host || typeof value === 'string' ? value : null;
}

// blocks-polish additions (2026-10-08): glyph alternatives and the phone cards.
const INCLUDED = /^\s*[\u2713\u2714\u2611\u2705][\uFE0E\uFE0F]?\s*$/u;
const EXCLUDED = /^\s*(?:[\u2717\u2715\u2716\u2718\u00D7\u274C][\uFE0E\uFE0F]?|[\u2014\u2013-])\s*$/u;

/**
 * A cell's value as people read it. A lone check or cross (or the dash an
 * empty plan cell shows) keeps its glyph for the eye and gains words for a
 * screen reader; anything else, including an inline editor element, passes
 * through untouched. The words are the glyph's accessible NAME (an attribute),
 * not a hidden text node: they are a11y-only copy, and a second text node in
 * the cell would read as a second, unbound value on the canvas.
 */
function readableValue(
  value: ReactNode,
  labels: { readonly included: string; readonly excluded: string },
): ReactNode {
  if (typeof value !== 'string') return value;
  const words = INCLUDED.test(value) ? labels.included : EXCLUDED.test(value) ? labels.excluded : undefined;
  if (words === undefined) return value;
  return (
    <span role="img" aria-label={words} data-comparison-glyph="">
      {value}
    </span>
  );
}

/* The phone cards read committed text only: an editor element renders once, in the table. */
function committed(value: ReactNode): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

const CARD_CLASSES: Record<ComparisonTableProps['variant'], string> = {
  boxed: 'border border-text/10 bg-surface text-text shadow-soft',
  minimal: 'border border-text/10',
  contrast: 'border border-transparent bg-surface-inverse text-text-inverse shadow-soft mkt-slab',
};
// end blocks-polish additions

/** A semantic, horizontally resilient plan or product comparison table. */
export function ComparisonTable({ node, props, isCanvas }: BlockRenderProps<ComparisonTableProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, comparisonTableSchema.parts);
  /*
    The first empty cell hosts the shared empty text's inline editor. A row's
    values fill its plans in order, so its first empty cell is at its length.
  */
  const firstEmptyRow = props.rows.findIndex((row) => row.values.length < props.plans.length);
  const firstEmptyPlan = props.rows[firstEmptyRow]?.values.length ?? -1;
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const glyphLabels = { included: props.includedLabel, excluded: props.excludedLabel };

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
      aria-labelledby={headingId}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.lg,
        )}
        data-comparison-content=""
      >
        <header
          className={cx(
            'flex max-w-content-narrow flex-col gap-gap-sm',
            ALIGN_CLASSES[props.align],
          )}
        >
          {props.eyebrow === undefined ? null : (
            <p
              {...part('eyebrow', {
                className:
                  'm-0 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase',
              })}
            >
              {props.eyebrow}
            </p>
          )}
          <h2
            {...part('heading', {
              id: headingId,
              className:
                'm-0 text-3xl leading-tight font-bold tracking-tight text-balance @md:text-4xl',
            })}
          >
            {props.heading}
          </h2>
          {props.body === undefined ? null : (
            <p
              {...part('body', {
                className: cx(
                  'm-0 text-lg leading-relaxed',
                  props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
                ),
              })}
            >
              {props.body}
            </p>
          )}
        </header>

        <div
          className="mkt-compare__table w-full max-w-full overflow-x-auto pb-gap-xs"
          tabIndex={0}
          aria-label={props.scrollLabel}
          data-comparison-scroll=""
        >
          {/*
            The table is named by the visible heading through aria-labelledby;
            a hidden caption would be a second copy of the heading's text.
          */}
          <table
            className={cx(
              /*
                No minimum width any more: below a 40rem container the cards
                take over (section-layout.css), and from there up the plans fit
                the column instead of hiding in a scroller nobody sees.
              */
              'w-full table-fixed',
              TABLE_CLASSES[props.variant],
            )}
            aria-labelledby={headingId}
          >
            <thead>
              <tr {...part('plans')}>
                <th
                  {...part('featureLabel', {
                    className:
                      'w-1/4 border-b border-text/10 p-4 text-start align-bottom text-sm font-semibold tracking-wide uppercase @3xl:p-6',
                  })}
                  scope="col"
                >
                  {props.featureLabel}
                </th>
                {props.plans.map((plan, planIndex) => {
                  const at = [planIndex];
                  const nameId = `${node.id}-plan-${String(planIndex)}-name`;
                  const actionId = `${node.id}-plan-${String(planIndex)}-action`;
                  return (
                    /* Keyed by position: a bound value may be an inline editor element. */
                    <th
                      key={planIndex}
                      {...part('plan', {
                        index: at,
                        className: cx(
                          'border-b border-text/10 p-4 text-center align-bottom @3xl:p-6',
                          featuredCellClasses(plan.featured === true, props.variant),
                        ),
                      })}
                      scope="col"
                      data-comparison-plan={plan.featured === true ? 'featured' : 'standard'}
                    >
                      <div className="flex min-w-0 flex-col items-center gap-gap-sm">
                        {plan.badge === undefined ? null : (
                          <span
                            {...part('plan.badge', {
                              index: at,
                              className:
                                'inline-flex rounded-full bg-accent px-control-inline-sm py-control-block-sm text-xs font-semibold text-accent-text',
                            })}
                          >
                            {plan.badge}
                          </span>
                        )}
                        <span
                          {...part('plan.name', {
                            index: at,
                            id: nameId,
                            className: 'text-xl leading-tight font-semibold tracking-tight',
                          })}
                        >
                          {plan.name}
                        </span>
                        {plan.description === undefined ? null : (
                          <span
                            {...part('plan.description', {
                              index: at,
                              className: 'text-sm leading-relaxed text-text-muted',
                            })}
                          >
                            {plan.description}
                          </span>
                        )}
                        {plan.price === undefined ? null : (
                          <span className="mt-gap-xs flex flex-wrap items-baseline justify-center gap-gap-xs">
                            <span
                              {...part('plan.price', {
                                index: at,
                                className: 'text-3xl leading-tight font-bold tracking-tight',
                              })}
                            >
                              {plan.price}
                            </span>
                            {plan.period === undefined ? null : (
                              <span
                                {...part('plan.period', {
                                  index: at,
                                  className: 'text-sm font-regular text-text-muted',
                                })}
                              >
                                {plan.period}
                              </span>
                            )}
                          </span>
                        )}
                        {!props.showActions ||
                        plan.actionHref === undefined ||
                        plan.actionLabel === undefined ? null : (
                          /* Named by its label, then the plan name, through aria-labelledby. */
                          <a
                            {...part('plan.action', {
                              index: at,
                              id: actionId,
                              className: cx(
                                'mt-gap-sm inline-flex min-h-11 w-full items-center justify-center rounded-xl border px-control-inline-md py-control-block-sm font-semibold shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none',
                                plan.featured === true
                                  ? 'border-accent bg-accent text-accent-text'
                                  : 'border-text-muted/30 bg-transparent text-inherit hover:border-accent hover:text-accent',
                              ),
                            })}
                            href={plan.actionHref}
                            aria-labelledby={`${actionId} ${nameId}`}
                          >
                            {plan.actionLabel}
                          </a>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody {...part('rows')}>
              {props.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  {...part('row', {
                    index: [rowIndex],
                    className: row.highlight === true ? 'bg-accent/5' : undefined,
                  })}
                >
                  <th
                    {...part('row.feature', {
                      index: [rowIndex],
                      className: 'border-b border-text/10 p-4 text-start align-middle font-medium @3xl:p-6',
                    })}
                    scope="row"
                  >
                    {row.feature}
                  </th>
                  {props.plans.map((plan, planIndex) => {
                    const value = row.values[planIndex];
                    const className = cx(
                      'border-b border-text/10 p-4 text-center align-middle text-sm font-medium @3xl:p-6',
                      featuredCellClasses(plan.featured === true, props.variant),
                    );
                    if (value !== undefined) {
                      return (
                        <td
                          key={planIndex}
                          {...part('row.value', { index: [rowIndex, planIndex], className })}
                        >
                          {readableValue(value, glyphLabels)}
                        </td>
                      );
                    }
                    const host = rowIndex === firstEmptyRow && planIndex === firstEmptyPlan;
                    return (
                      <td key={planIndex} {...part('emptyValue', { className })}>
                        {readableValue(sharedText(props.emptyValue, host), glyphLabels)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* blocks-polish additions (2026-10-08): the same comparison as plan cards below 40rem. */}
        {props.plans.length === 0 ? null : (
          <ul className="mkt-compare__cards m-0 w-full list-none p-0" data-comparison-cards="">
            {props.plans.map((plan, planIndex) => {
              const featured = plan.featured === true;
              const nameId = `${node.id}-card-${String(planIndex)}-name`;
              const actionId = `${node.id}-card-${String(planIndex)}-action`;
              const name = committed(plan.name);
              const price = committed(plan.price);
              const period = committed(plan.period);
              const badge = committed(plan.badge);
              const description = committed(plan.description);
              const actionLabel = committed(plan.actionLabel);
              const at = [planIndex];
              return (
                <li
                  key={planIndex}
                  className={cx(
                    'flex min-w-0 flex-col gap-gap-sm rounded-xl p-5',
                    CARD_CLASSES[props.variant],
                    featured ? 'border-accent ring-1 ring-accent/30' : undefined,
                  )}
                  data-comparison-card={featured ? 'featured' : 'standard'}
                >
                  <div className="flex flex-wrap items-center justify-between gap-gap-sm">
                    <h3
                      {...part('plan.name', {
                        index: at,
                        id: nameId,
                        className: 'm-0 text-xl leading-tight font-semibold tracking-tight',
                      })}
                    >
                      {name}
                    </h3>
                    {badge === undefined ? null : (
                      <span
                        {...part('plan.badge', {
                          index: at,
                          className:
                            'inline-flex rounded-full bg-accent px-control-inline-sm py-control-block-sm text-xs font-semibold text-accent-text',
                        })}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  {description === undefined ? null : (
                    <p
                      {...part('plan.description', {
                        index: at,
                        className: 'm-0 text-sm leading-relaxed text-text-muted',
                      })}
                    >
                      {description}
                    </p>
                  )}
                  {price === undefined ? null : (
                    <p className="m-0 flex flex-wrap items-baseline gap-gap-xs">
                      <span
                        {...part('plan.price', {
                          index: at,
                          className: 'text-3xl leading-tight font-bold tracking-tight',
                        })}
                      >
                        {price}
                      </span>
                      {period === undefined ? null : (
                        <span {...part('plan.period', { index: at, className: 'text-sm text-text-muted' })}>
                          {period}
                        </span>
                      )}
                    </p>
                  )}
                  {props.rows.length === 0 ? null : (
                    <dl className="m-0 flex flex-col">
                      {props.rows.map((row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className={cx(
                            'flex items-baseline justify-between gap-gap border-t border-text/10 py-2',
                            row.highlight === true ? 'bg-accent/5' : undefined,
                          )}
                        >
                          <dt
                            {...part('row.feature', {
                              index: [rowIndex],
                              className: 'min-w-0 text-sm font-medium',
                            })}
                          >
                            {committed(row.feature)}
                          </dt>
                          {row.values[planIndex] === undefined ? (
                            <dd {...part('emptyValue', { className: 'm-0 text-end text-sm font-semibold' })}>
                              {readableValue(committed(props.emptyValue), glyphLabels)}
                            </dd>
                          ) : (
                            <dd
                              {...part('row.value', {
                                index: [rowIndex, planIndex],
                                className: 'm-0 text-end text-sm font-semibold',
                              })}
                            >
                              {readableValue(committed(row.values[planIndex]), glyphLabels)}
                            </dd>
                          )}
                        </div>
                      ))}
                    </dl>
                  )}
                  {!props.showActions ||
                  plan.actionHref === undefined ||
                  actionLabel === undefined ? null : (
                    <a
                      {...part('plan.action', {
                        index: at,
                        id: actionId,
                        className: cx(
                          'mt-gap-xs inline-flex min-h-11 w-full items-center justify-center rounded-xl border px-control-inline-md py-control-block-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
                          featured
                            ? 'border-accent bg-accent text-accent-text'
                            : 'border-text-muted/30 bg-transparent text-inherit',
                        ),
                      })}
                      href={plan.actionHref}
                      aria-labelledby={`${actionId} ${nameId}`}
                    >
                      {actionLabel}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {props.note === undefined ? null : (
          <p
            {...part('note', {
              className: 'm-0 max-w-content-narrow text-sm leading-relaxed text-text-muted',
            })}
          >
            {props.note}
          </p>
        )}
      </div>
    </section>
  );
}
