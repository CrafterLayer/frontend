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
    'border-separate border-spacing-0 overflow-hidden rounded-xl bg-surface-inverse text-text-inverse shadow-elevated',
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
          className="w-full max-w-full overflow-x-auto pb-gap-xs"
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
              'w-full min-w-content-standard table-fixed',
              TABLE_CLASSES[props.variant],
            )}
            aria-labelledby={headingId}
          >
            <thead>
              <tr {...part('plans')}>
                <th
                  {...part('featureLabel', {
                    className:
                      'w-1/4 border-b border-text/10 p-6 text-start align-bottom text-sm font-semibold tracking-wide uppercase',
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
                          'border-b border-text/10 p-6 text-center align-bottom',
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
                      className: 'border-b border-text/10 p-6 text-start align-middle font-medium',
                    })}
                    scope="row"
                  >
                    {row.feature}
                  </th>
                  {props.plans.map((plan, planIndex) => {
                    const value = row.values[planIndex];
                    const className = cx(
                      'border-b border-text/10 p-6 text-center align-middle text-sm font-medium',
                      featuredCellClasses(plan.featured === true, props.variant),
                    );
                    if (value !== undefined) {
                      return (
                        <td
                          key={planIndex}
                          {...part('row.value', { index: [rowIndex, planIndex], className })}
                        >
                          {value}
                        </td>
                      );
                    }
                    const host = rowIndex === firstEmptyRow && planIndex === firstEmptyPlan;
                    return (
                      <td key={planIndex} {...part('emptyValue', { className })}>
                        {sharedText(props.emptyValue, host)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
