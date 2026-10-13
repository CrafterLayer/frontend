import '../section-layout.css';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import { ALIGN_CLASSES, GAP_CLASSES, cx, sectionContentClasses } from '../section-classes';
import { ICON_PATHS, ICON_SVG_PROPS } from '../section-icons';
import { mutedTextClasses, sectionRootAttributes } from '../section-root';
import { shows } from '../section-text';

import { caseStudySchema, type CaseStudyProps } from './schema';

const METRIC_COLUMNS: Readonly<Record<number, string>> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-1 @md:grid-cols-3',
  4: 'grid-cols-2 @3xl:grid-cols-4',
};

/** A customer story: who, the numbers that changed, how it happened, and what the client said. */
export function CaseStudy({ node, props, isCanvas }: BlockRenderProps<CaseStudyProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, caseStudySchema.parts);
  const root = sectionRootAttributes(props);
  const muted = mutedTextClasses(props.tone);
  const hasQuote = shows(props.quote);
  const hasAside = props.imageSrc !== undefined || hasQuote;
  const hasAction = props.actionLabel !== undefined && props.actionHref !== undefined;

  return (
    <section
      className={root.className}
      {...root.motion}
      style={root.style}
      aria-labelledby={headingId}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.lg,
        )}
        data-case-study-content=""
      >
        <header
          className={cx(
            'flex max-w-content-standard flex-col',
            GAP_CLASSES.sm,
            ALIGN_CLASSES[props.align],
          )}
        >
          {props.eyebrow === undefined && props.client === undefined ? null : (
            <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold tracking-wide uppercase">
              {props.eyebrow === undefined ? null : (
                <span {...part('eyebrow', { className: 'text-accent' })}>{props.eyebrow}</span>
              )}
              {props.client === undefined ? null : (
                <span
                  {...part('client', {
                    className: 'rounded-full border border-current/20 px-2.5 py-0.5',
                  })}
                >
                  {props.client}
                </span>
              )}
            </p>
          )}
          <h2
            {...part('heading', {
              id: headingId,
              className:
                'm-0 text-3xl leading-tight font-bold tracking-tight text-balance @md:text-5xl',
            })}
          >
            {props.heading}
          </h2>
          {props.body === undefined ? null : (
            <p
              {...part('body', {
                className: cx('m-0 max-w-content-narrow text-lg leading-relaxed', muted),
              })}
            >
              {props.body}
            </p>
          )}
        </header>

        {props.metrics.length === 0 ? null : (
          /* Each result is a term and its value; the value is drawn first, large. */
          <dl
            {...part('metrics', {
              className: cx(
                'm-0 grid w-full gap-gap rounded-2xl bg-current/5 p-6 text-start @md:p-8',
                METRIC_COLUMNS[props.metrics.length],
              ),
            })}
          >
            {props.metrics.map((metric, index) => {
              const at = [index];
              return (
                <div
                  key={index}
                  {...part('metric', {
                    index: at,
                    className: 'flex flex-col-reverse gap-1 border-s-2 border-accent ps-4',
                  })}
                >
                  <dt {...part('metric.label', { index: at, className: cx('text-sm', muted) })}>
                    {metric.label}
                  </dt>
                  <dd
                    {...part('metric.value', {
                      index: at,
                      className:
                        'm-0 text-3xl leading-none font-bold tracking-tight tabular-nums @md:text-4xl',
                    })}
                  >
                    {metric.value}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        <div
          className={cx(
            'grid w-full items-start gap-gap-lg text-start',
            hasAside ? '@4xl:grid-cols-2' : undefined,
          )}
        >
          <div className="flex min-w-0 flex-col gap-gap">
            {props.points.length === 0 ? null : (
              <dl {...part('points', { className: 'm-0 flex flex-col gap-gap' })}>
                {props.points.map((point, index) => (
                  <div key={index} className="flex flex-col gap-1">
                    <dt
                      {...part('point.label', {
                        index: [index],
                        className: 'text-sm font-semibold tracking-wide text-accent uppercase',
                      })}
                    >
                      {point.label}
                    </dt>
                    <dd
                      {...part('point.text', {
                        index: [index],
                        className: 'm-0 text-lg leading-relaxed text-pretty',
                      })}
                    >
                      {point.text}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {hasAction ? (
              <a
                {...part('action', {
                  className:
                    'inline-flex min-h-11 items-center gap-2 self-start rounded-xl bg-accent px-control-inline-md py-control-block-sm font-semibold text-accent-text shadow-soft transition hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none',
                })}
                href={props.actionHref}
              >
                {props.actionLabel}
                <svg {...ICON_SVG_PROPS} className="size-4 rtl:-scale-x-100">
                  {ICON_PATHS.arrowEnd.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
              </a>
            ) : null}
          </div>

          {hasAside ? (
            <div
              className={cx(
                'flex min-w-0 flex-col gap-gap',
                props.mediaPosition === 'start' ? '@4xl:order-first' : undefined,
              )}
              data-case-study-aside=""
            >
              {props.imageSrc === undefined ? null : (
                <img
                  {...part('image', {
                    className: 'aspect-4/3 w-full rounded-2xl object-cover shadow-soft',
                  })}
                  src={props.imageSrc}
                  alt={props.imageAlt}
                  loading="lazy"
                  decoding="async"
                />
              )}
              {hasQuote ? (
                <figure className="m-0 flex flex-col gap-3 rounded-2xl border border-current/10 border-s-4 border-s-accent p-6">
                  <blockquote className="m-0">
                    <p
                      {...part('quote', {
                        className: 'm-0 text-xl leading-snug font-semibold text-balance',
                      })}
                    >
                      {props.quote}
                    </p>
                  </blockquote>
                  {shows(props.quoteAuthor) || shows(props.quoteRole) ? (
                    <figcaption className="flex flex-col text-sm">
                      {shows(props.quoteAuthor) ? (
                        <span {...part('quoteAuthor', { className: 'font-semibold' })}>
                          {props.quoteAuthor}
                        </span>
                      ) : null}
                      {shows(props.quoteRole) ? (
                        <span {...part('quoteRole', { className: muted })}>{props.quoteRole}</span>
                      ) : null}
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
