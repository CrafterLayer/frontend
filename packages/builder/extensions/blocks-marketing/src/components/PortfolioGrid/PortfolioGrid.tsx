import '../section-layout.css';

import type { MouseEvent, ReactNode } from 'react';

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

import { portfolioGridSchema, type PortfolioGridProps } from './schema';

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

/*
  `actionLabel` is ONE part shown on every card. While it is edited in place
  its value is the editor element, which must render exactly once: the first
  card hosts it and the others show the label again once it is committed.
*/
function sharedText(value: ReactNode, host: boolean): ReactNode {
  return host || typeof value === 'string' ? value : null;
}

/* The decorative monogram reads only a committed title, never an editor element. */
function initialOf(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 1).toLocaleUpperCase() : '';
}

/** Premium project case cards with concise outcomes and publish-safe links. */
export function PortfolioGrid({ node, props, isCanvas }: BlockRenderProps<PortfolioGridProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, portfolioGridSchema.parts);
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
            {...part('items', {
              className: cx(
                'm-0 grid w-full list-none p-0',
                props.variant === 'editorial' ? 'grid-cols-1' : GRID_CLASSES[props.columns],
                GAP_CLASSES.lg,
              ),
            })}
            data-portfolio-grid={props.variant}
          >
            {props.items.map((item, index) => {
              const at = [index];
              const titleId = `${node.id}-item-${String(index)}-title`;
              const linkId = `${node.id}-item-${String(index)}-link`;
              return (
                /* Keyed by position: a bound value may be an inline editor element. */
                <li key={index} className="min-w-0">
                  <article
                    {...part('item', {
                      index: at,
                      className: cx(
                        'group h-full min-w-0 overflow-hidden rounded-xl border border-text/10 bg-surface text-text shadow-soft transition hover:-translate-y-1 hover:shadow-elevated motion-reduce:transform-none motion-reduce:transition-none',
                        props.variant === 'editorial'
                          ? 'grid grid-cols-1 @lg:grid-cols-5'
                          : 'flex flex-col',
                      ),
                    })}
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
                          {initialOf(item.title)}
                        </span>
                      ) : (
                        <img
                          {...part('item.image', {
                            index: at,
                            className:
                              'h-full w-full object-cover transition group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none',
                          })}
                          src={item.imageSrc}
                          alt={item.imageAlt ?? ''}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>

                    <div className={COPY_CLASSES[props.variant]}>
                      <p
                        {...part('item.category', {
                          index: at,
                          className:
                            'm-0 inline-flex self-start rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase',
                        })}
                      >
                        {item.category}
                      </p>
                      <h3
                        {...part('item.title', {
                          index: at,
                          id: titleId,
                          className:
                            'm-0 text-2xl leading-tight font-semibold tracking-tight text-balance',
                        })}
                      >
                        {item.title}
                      </h3>
                      <p
                        {...part('item.summary', {
                          index: at,
                          className: 'm-0 leading-relaxed text-text-muted',
                        })}
                      >
                        {item.summary}
                      </p>

                      {!props.showMetrics || item.metrics.length === 0 ? null : (
                        <dl
                          {...part('item.metrics', {
                            index: at,
                            className:
                              'm-0 grid grid-cols-2 gap-gap-sm border-y border-text/10 py-gap-sm @md:grid-cols-3',
                          })}
                        >
                          {item.metrics.map((metric, metricIndex) => {
                            const metricAt = [index, metricIndex];
                            return (
                              <div
                                key={metricIndex}
                                {...part('item.metric', {
                                  index: metricAt,
                                  className: 'flex min-w-0 flex-col',
                                })}
                              >
                                <dt
                                  {...part('item.metric.label', {
                                    index: metricAt,
                                    className:
                                      'order-2 mt-1 text-xs leading-normal text-text-muted',
                                  })}
                                >
                                  {metric.label}
                                </dt>
                                <dd
                                  {...part('item.metric.value', {
                                    index: metricAt,
                                    className:
                                      'order-1 m-0 text-xl leading-tight font-bold tracking-tight text-text',
                                  })}
                                >
                                  {metric.value}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      )}

                      {/*
                      The accessible name is the link's own label followed by
                      the project title, read through aria-labelledby: a bound
                      value never reaches an attribute (DESIGN §2.3).
                    */}
                      <a
                        {...part('item.link', {
                          index: at,
                          id: linkId,
                          className:
                            'mt-auto inline-flex min-h-11 items-center self-start font-semibold text-accent underline-offset-4 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
                        })}
                        href={item.href}
                        aria-labelledby={`${linkId} ${titleId}`}
                        onClick={isCanvas ? preventCanvasNavigation : undefined}
                      >
                        <span {...part('actionLabel')}>
                          {sharedText(props.actionLabel, index === 0)}
                        </span>
                        <span aria-hidden="true" className="ms-gap-xs">
                          ↗
                        </span>
                      </a>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
