import '../section-layout.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  GAP_CLASSES,
  cx,
  sectionContentClasses,
  sectionShellClasses,
} from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { ComparisonTableProps } from './schema';

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

/** A semantic, horizontally resilient plan or product comparison table. */
export function ComparisonTable({ node, props }: BlockRenderProps<ComparisonTableProps>) {
  const headingId = `${node.id}-heading`;
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
            <p className="m-0 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">
              {props.eyebrow}
            </p>
          )}
          <h2
            id={headingId}
            className="m-0 text-3xl leading-tight font-bold tracking-tight text-balance @md:text-4xl"
          >
            {props.heading}
          </h2>
          {props.body === undefined ? null : (
            <p
              className={cx(
                'm-0 text-lg leading-relaxed',
                props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
              )}
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
          <table
            className={cx(
              'w-full min-w-content-standard table-fixed',
              TABLE_CLASSES[props.variant],
            )}
          >
            <caption className="sr-only">{props.heading}</caption>
            <thead>
              <tr>
                <th
                  className="w-1/4 border-b border-text/10 p-6 text-start align-bottom text-sm font-semibold tracking-wide uppercase"
                  scope="col"
                >
                  {props.featureLabel}
                </th>
                {props.plans.map((plan) => (
                  <th
                    key={plan.name}
                    className={cx(
                      'border-b border-text/10 p-6 text-center align-bottom',
                      featuredCellClasses(plan.featured === true, props.variant),
                    )}
                    scope="col"
                    data-comparison-plan={plan.featured === true ? 'featured' : 'standard'}
                  >
                    <div className="flex min-w-0 flex-col items-center gap-gap-sm">
                      {plan.badge === undefined ? null : (
                        <span className="inline-flex rounded-full bg-accent px-control-inline-sm py-control-block-sm text-xs font-semibold text-accent-text">
                          {plan.badge}
                        </span>
                      )}
                      <span className="text-xl leading-tight font-semibold tracking-tight">
                        {plan.name}
                      </span>
                      {plan.description === undefined ? null : (
                        <span className="text-sm leading-relaxed text-text-muted">
                          {plan.description}
                        </span>
                      )}
                      {plan.price === undefined ? null : (
                        <span className="mt-gap-xs flex flex-wrap items-baseline justify-center gap-gap-xs">
                          <span className="text-3xl leading-tight font-bold tracking-tight">
                            {plan.price}
                          </span>
                          {plan.period === undefined ? null : (
                            <span className="text-sm font-regular text-text-muted">
                              {plan.period}
                            </span>
                          )}
                        </span>
                      )}
                      {!props.showActions ||
                      plan.actionHref === undefined ||
                      plan.actionLabel === undefined ? null : (
                        <a
                          className={cx(
                            'mt-gap-sm inline-flex min-h-11 w-full items-center justify-center rounded-xl border px-control-inline-md py-control-block-sm font-semibold shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none',
                            plan.featured === true
                              ? 'border-accent bg-accent text-accent-text'
                              : 'border-text-muted/30 bg-transparent text-inherit hover:border-accent hover:text-accent',
                          )}
                          href={plan.actionHref}
                          aria-label={`${plan.actionLabel}: ${plan.name}`}
                        >
                          {plan.actionLabel}
                        </a>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => (
                <tr
                  key={row.feature}
                  className={row.highlight === true ? 'bg-accent/5' : undefined}
                >
                  <th
                    className="border-b border-text/10 p-6 text-start align-middle font-medium"
                    scope="row"
                  >
                    {row.feature}
                  </th>
                  {props.plans.map((plan, planIndex) => (
                    <td
                      key={`${row.feature}-${plan.name}`}
                      className={cx(
                        'border-b border-text/10 p-6 text-center align-middle text-sm font-medium',
                        featuredCellClasses(plan.featured === true, props.variant),
                      )}
                    >
                      {row.values[planIndex] ?? props.emptyValue}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {props.note === undefined ? null : (
          <p className="m-0 max-w-content-narrow text-sm leading-relaxed text-text-muted">
            {props.note}
          </p>
        )}
      </div>
    </section>
  );
}
