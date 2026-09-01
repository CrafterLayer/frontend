import '../section-layout.css';

import type { MouseEvent } from 'react';

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

import type { PortfolioGridProps } from './schema';

const GRID_CLASSES: Record<PortfolioGridProps['columns'], string> = {
  '2': 'grid-cols-1 @lg:grid-cols-2',
  '3': 'grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3',
};

const MEDIA_CLASSES: Record<PortfolioGridProps['variant'], string> = {
  grid: 'aspect-video w-full',
  editorial: 'aspect-video w-full @lg:col-span-3 @lg:min-h-72',
};

const COPY_CLASSES: Record<PortfolioGridProps['variant'], string> = {
  grid: 'flex min-w-0 flex-1 flex-col gap-gap-sm p-6',
  editorial: 'flex min-w-0 flex-col justify-center gap-gap-sm p-6 @lg:col-span-2 @lg:p-8',
};

function preventCanvasNavigation(event: MouseEvent<HTMLAnchorElement>): void {
  event.preventDefault();
}

/** Premium project case cards with concise outcomes and publish-safe links. */
export function PortfolioGrid({ node, props, isCanvas }: BlockRenderProps<PortfolioGridProps>) {
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
        data-portfolio-content=""
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

        {props.items.length === 0 ? (
          isCanvas ? (
            <div
              className="grid min-h-56 w-full place-items-center rounded-xl border border-dashed border-text-muted/30 bg-surface p-8 text-center text-text shadow-soft"
              role="status"
            >
              <span className="flex max-w-content-narrow flex-col items-center gap-gap-sm">
                <strong className="text-lg leading-tight font-semibold">
                  Add case studies to showcase your strongest outcomes.
                </strong>
                <span className="text-sm leading-relaxed text-text-muted">
                  Include a concise result, a safe destination, and optional project imagery or
                  metrics.
                </span>
              </span>
            </div>
          ) : null
        ) : (
          <ul
            className={cx(
              'm-0 grid w-full list-none p-0',
              props.variant === 'editorial' ? 'grid-cols-1' : GRID_CLASSES[props.columns],
              GAP_CLASSES.lg,
            )}
            data-portfolio-grid={props.variant}
          >
            {props.items.map((item) => (
              <li key={`${item.title}-${item.href}`} className="min-w-0">
                <article
                  className={cx(
                    'group h-full min-w-0 overflow-hidden rounded-xl border border-text/10 bg-surface text-text shadow-soft transition hover:-translate-y-1 hover:shadow-elevated motion-reduce:transform-none motion-reduce:transition-none',
                    props.variant === 'editorial'
                      ? 'grid grid-cols-1 @lg:grid-cols-5'
                      : 'flex flex-col',
                  )}
                  data-portfolio-card={props.variant}
                >
                  <div
                    className={cx(
                      'grid place-items-center overflow-hidden bg-accent/10 text-accent',
                      MEDIA_CLASSES[props.variant],
                    )}
                  >
                    {item.imageSrc === undefined ? (
                      <span aria-hidden="true" className="text-4xl font-bold opacity-30">
                        {item.title.trim().slice(0, 1).toLocaleUpperCase()}
                      </span>
                    ) : (
                      <img
                        className="h-full w-full object-cover transition group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                        src={item.imageSrc}
                        alt={item.imageAlt ?? ''}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>

                  <div className={COPY_CLASSES[props.variant]}>
                    <p className="m-0 inline-flex self-start rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">
                      {item.category}
                    </p>
                    <h3 className="m-0 text-2xl leading-tight font-semibold tracking-tight text-balance">
                      {item.title}
                    </h3>
                    <p className="m-0 leading-relaxed text-text-muted">{item.summary}</p>

                    {!props.showMetrics || item.metrics.length === 0 ? null : (
                      <dl className="m-0 grid grid-cols-2 gap-gap-sm border-y border-text/10 py-gap-sm @md:grid-cols-3">
                        {item.metrics.map((metric) => (
                          <div
                            key={`${metric.label}-${metric.value}`}
                            className="flex min-w-0 flex-col"
                          >
                            <dt className="order-2 mt-1 text-xs leading-normal text-text-muted">
                              {metric.label}
                            </dt>
                            <dd className="order-1 m-0 text-xl leading-tight font-bold tracking-tight text-text">
                              {metric.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}

                    <a
                      className="mt-auto inline-flex min-h-11 items-center self-start font-semibold text-accent underline-offset-4 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                      href={item.href}
                      aria-label={`${props.actionLabel}: ${item.title}`}
                      onClick={isCanvas ? preventCanvasNavigation : undefined}
                    >
                      {props.actionLabel}
                      <span aria-hidden="true" className="ms-gap-xs">
                        ↗
                      </span>
                    </a>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
