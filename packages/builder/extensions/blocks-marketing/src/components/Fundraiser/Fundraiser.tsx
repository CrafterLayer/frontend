import '../section-layout.css';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import { ALIGN_CLASSES, GAP_CLASSES, cx, sectionContentClasses } from '../section-classes';
import { formatNumber, formatShare, shareWidth } from '../section-numbers';
import { mutedTextClasses, sectionRootAttributes } from '../section-root';
import { sharedText } from '../section-text';

import { fundraiserSchema, type FundraiserProps } from './schema';

const NBSP = ' ';

/** A fundraising goal: what is raised against what is needed, who gave, and how to give. */
export function Fundraiser({ node, props, isCanvas }: BlockRenderProps<FundraiserProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, fundraiserSchema.parts);
  const root = sectionRootAttributes(props);
  const muted = mutedTextClasses(props.tone);
  const language = props.numberLanguage;
  const percent = Math.round((props.raised / props.goal) * 100);
  const split = props.layout === 'split' && props.imageSrc !== undefined;
  const before = props.currencyPosition === 'before';
  /*
    A symbol written before the number sits against it ("$68,250"); a code or
    a word gets a no-break space ("SAR 68,250", "68,250 ر.س"). Mid-edit (an
    element) it keeps the space.
  */
  const gap =
    before && typeof props.currency === 'string' && !/\p{L}/u.test(props.currency) ? '' : NBSP;
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
        data-fundraiser-content=""
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
            'grid w-full items-center gap-gap-lg text-start',
            split ? '@3xl:grid-cols-2' : 'max-w-xl',
          )}
          data-fundraiser-layout={split ? 'split' : 'card'}
        >
          {split ? (
            <img
              {...part('image', {
                className: 'aspect-4/3 w-full rounded-2xl object-cover shadow-soft',
              })}
              src={props.imageSrc}
              alt={props.imageAlt}
              loading="lazy"
              decoding="async"
            />
          ) : null}

          {/* The card: light ground and its own ink, on any section tone. */}
          <div
            className="flex flex-col gap-gap rounded-2xl border border-current/10 bg-surface p-6 text-text shadow-soft @md:p-8"
            data-fundraiser-card=""
          >
            <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {/* Each amount is one isolated unit: currency and digits never wrap or reorder apart. */}
              <bdi className="text-4xl leading-none font-bold tracking-tight whitespace-nowrap tabular-nums @md:text-5xl">
                {before ? (
                  <span {...part('currency')}>{sharedText(props.currency, true)}</span>
                ) : null}
                {before ? gap : null}
                {formatNumber(props.raised, language, { maximumFractionDigits: 2 })}
                {before ? null : gap}
                {before ? null : (
                  <span {...part('currency')}>{sharedText(props.currency, true)}</span>
                )}
              </bdi>
              <span {...part('raisedLabel', { className: 'text-text-muted' })}>
                {props.raisedLabel}
              </span>
              <bdi className="font-semibold whitespace-nowrap tabular-nums">
                {before ? (
                  <span {...part('currency')}>{sharedText(props.currency, false)}</span>
                ) : null}
                {before ? gap : null}
                {formatNumber(props.goal, language, { maximumFractionDigits: 2 })}
                {before ? null : gap}
                {before ? null : (
                  <span {...part('currency')}>{sharedText(props.currency, false)}</span>
                )}
              </bdi>
              <span {...part('goalLabel', { className: 'text-text-muted' })}>
                {props.goalLabel}
              </span>
            </p>
            <div className="flex items-center gap-3">
              <div
                role="progressbar"
                aria-label={props.progressLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.max(0, percent))}
                aria-valuetext={formatShare(props.raised, props.goal, language)}
                className="h-3 flex-1 overflow-hidden rounded-full bg-text/10"
              >
                {/* Logical width: the bar grows from the inline start, the right in Arabic. */}
                <div
                  className="h-full rounded-full bg-accent transition-all motion-reduce:transition-none"
                  style={{ inlineSize: shareWidth(props.raised, props.goal) }}
                  data-fundraiser-bar=""
                />
              </div>
              <span aria-hidden="true" className="text-sm font-semibold tabular-nums">
                {formatShare(props.raised, props.goal, language)}
              </span>
            </div>

            {props.stats.length === 0 ? null : (
              <dl
                {...part('stats', {
                  className:
                    'm-0 grid grid-cols-2 gap-4 border-t border-text/10 pt-4 @md:grid-cols-3',
                })}
              >
                {props.stats.map((stat, index) => (
                  /* Keyed by position: a bound value may be an inline editor element. */
                  <div key={index} className="flex flex-col-reverse gap-0.5">
                    <dt
                      {...part('stat.label', {
                        index: [index],
                        className: 'text-sm text-text-muted',
                      })}
                    >
                      {stat.label}
                    </dt>
                    <dd
                      {...part('stat.value', {
                        index: [index],
                        className: 'm-0 text-2xl font-bold tracking-tight tabular-nums',
                      })}
                    >
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {props.amounts.length === 0 ? null : (
              <ul {...part('amounts', { className: 'm-0 flex list-none flex-wrap gap-2 p-0' })}>
                {props.amounts.map((option, index) => (
                  <li key={index}>
                    <a
                      {...part('amount', {
                        index: [index],
                        className:
                          'inline-flex min-h-11 min-w-16 items-center justify-center rounded-full border border-text/20 px-4 font-semibold text-inherit tabular-nums transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      })}
                      href={option.href}
                    >
                      {option.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <a
              {...part('action', {
                className:
                  'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-control-inline-md py-control-block-md text-lg font-semibold text-accent-text shadow-soft transition hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none',
              })}
              href={props.actionHref}
            >
              {props.actionLabel}
            </a>
            {props.note === undefined ? null : (
              <p {...part('note', { className: 'm-0 text-center text-sm text-text-muted' })}>
                {props.note}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
