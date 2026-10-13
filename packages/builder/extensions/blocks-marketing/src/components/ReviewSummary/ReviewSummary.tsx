import '../section-layout.css';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import { ALIGN_CLASSES, GAP_CLASSES, cx, sectionContentClasses } from '../section-classes';
import { ICON_PATHS } from '../section-icons';
import { formatNumber, formatShare, shareWidth } from '../section-numbers';
import { mutedTextClasses, sectionRootAttributes } from '../section-root';

import { formatAverage, ratingName, starFills } from './review-stars';
import { reviewSummarySchema, type ReviewSummaryProps } from './schema';

const STAR = ICON_PATHS.star[0];

/** An average rating, the share of reviews at each star level, and a few of the reviews themselves. */
export function ReviewSummary({ node, props, isCanvas }: BlockRenderProps<ReviewSummaryProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, reviewSummarySchema.parts);
  const root = sectionRootAttributes(props);
  const muted = mutedTextClasses(props.tone);
  const language = props.numberLanguage;
  const average = formatAverage(props.average, language);
  const total = props.breakdown.reduce((sum, row) => sum + row.count, 0);
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
        data-review-summary-content=""
      >
        <header
          className={cx(
            'flex max-w-content-narrow flex-col',
            GAP_CLASSES.sm,
            ALIGN_CLASSES[props.align],
          )}
        >
          {props.eyebrow === undefined ? null : (
            <p
              {...part('eyebrow', {
                className: 'm-0 text-xs font-semibold tracking-wide text-accent uppercase',
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
            <p {...part('body', { className: cx('m-0 text-lg leading-relaxed', muted) })}>
              {props.body}
            </p>
          )}
        </header>

        <div
          className={cx(
            'grid w-full items-start gap-gap-lg text-start',
            props.reviews.length === 0 ? 'max-w-md' : '@3xl:grid-cols-3',
          )}
        >
          {/* The summary card: light ground and its own ink, on any section tone. */}
          <div
            className="flex flex-col gap-gap rounded-2xl border border-current/10 bg-surface p-6 text-text shadow-soft"
            data-review-summary-card=""
          >
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              {/* The number is read once, inside the stars' name. */}
              <span
                aria-hidden="true"
                className="text-6xl leading-none font-bold tracking-tight tabular-nums"
                data-review-summary-average=""
              >
                {average}
              </span>
              <span
                role="img"
                aria-label={ratingName(props.ratingLabel, average)}
                className="flex gap-0.5 pb-1"
              >
                {starFills(props.average).map((fill, star) => {
                  const clipId = `${node.id}-average-star-${String(star)}`;
                  return (
                    /* Mirrored in RTL, so a partial star fills from the inline start. */
                    <svg
                      key={star}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                      className="size-6 shrink-0 rtl:-scale-x-100"
                      data-star-fill={fill.toFixed(1)}
                    >
                      <path className="fill-current text-text-muted opacity-30" d={STAR} />
                      {fill === 0 ? null : (
                        <>
                          <defs>
                            <clipPath id={clipId}>
                              <rect width={fill * 24} height="24" />
                            </clipPath>
                          </defs>
                          <path
                            className="fill-current text-accent"
                            clipPath={`url(#${clipId})`}
                            d={STAR}
                          />
                        </>
                      )}
                    </svg>
                  );
                })}
              </span>
            </div>
            <p {...part('totalLabel', { className: 'm-0 text-sm text-text-muted' })}>
              {props.totalLabel}
            </p>
            {props.breakdown.length === 0 ? null : (
              <ul {...part('breakdown', { className: 'm-0 flex list-none flex-col gap-2 p-0' })}>
                {props.breakdown.map((row, index) => (
                  /* Keyed by position: a bound value may be an inline editor element. */
                  <li key={index} className="flex items-center gap-3 text-sm">
                    <span
                      {...part('breakdown.label', {
                        index: [index],
                        className: 'min-w-14 shrink-0 font-medium whitespace-nowrap',
                      })}
                    >
                      {row.label}
                    </span>
                    {/* The bar repeats the share printed beside it, so it is decoration. */}
                    <span
                      aria-hidden="true"
                      className="h-2 flex-1 overflow-hidden rounded-full bg-current/10"
                    >
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ inlineSize: shareWidth(row.count, total) }}
                        data-review-summary-bar=""
                      />
                    </span>
                    <span className="w-12 shrink-0 text-end text-text-muted tabular-nums">
                      {formatShare(row.count, total, language)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {hasAction ? (
              <a
                {...part('action', {
                  className:
                    'inline-flex min-h-11 items-center justify-center rounded-xl border border-current/15 px-control-inline-md py-control-block-sm font-semibold text-inherit transition hover:bg-current/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
                })}
                href={props.actionHref}
              >
                {props.actionLabel}
              </a>
            ) : null}
          </div>

          {props.reviews.length === 0 ? null : (
            <ul
              {...part('reviews', {
                className:
                  'm-0 grid list-none grid-cols-1 gap-gap p-0 @xl:grid-cols-2 @3xl:col-span-2',
              })}
            >
              {props.reviews.map((review, index) => {
                const at = [index];
                return (
                  <li
                    key={index}
                    {...part('review', {
                      index: at,
                      className:
                        'flex flex-col gap-3 rounded-2xl border border-current/10 p-5 text-start',
                    })}
                  >
                    <figure className="m-0 flex h-full flex-col gap-3">
                      <span
                        role="img"
                        aria-label={ratingName(
                          props.ratingLabel,
                          formatNumber(review.rating, language),
                        )}
                        className="flex gap-0.5"
                      >
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            focusable="false"
                            className={cx(
                              'size-4 shrink-0 fill-current',
                              star <= review.rating ? 'text-accent' : 'opacity-25',
                            )}
                          >
                            <path d={STAR} />
                          </svg>
                        ))}
                      </span>
                      <blockquote className="m-0 flex-1">
                        <p
                          {...part('review.quote', {
                            index: at,
                            className: 'm-0 leading-relaxed text-pretty',
                          })}
                        >
                          {review.quote}
                        </p>
                      </blockquote>
                      <figcaption className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span {...part('review.author', { index: at, className: 'font-semibold' })}>
                          {review.author}
                        </span>
                        {review.meta === undefined ? null : (
                          <span {...part('review.meta', { index: at, className: muted })}>
                            {review.meta}
                          </span>
                        )}
                      </figcaption>
                    </figure>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
