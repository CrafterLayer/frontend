import '../section-layout.css';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  JUSTIFY_CLASSES,
  TEXT_ALIGN_CLASSES,
  cx,
  sectionContentClasses,
} from '../section-classes';
import { ICON_PATHS } from '../section-icons';
import { mutedTextClasses, sectionRootAttributes } from '../section-root';
import { shows } from '../section-text';

import { pullQuoteSchema, type PullQuoteProps } from './schema';

const SIZE_CLASSES: Readonly<Record<PullQuoteProps['size'], string>> = {
  md: 'text-xl leading-snug @md:text-2xl',
  lg: 'text-2xl leading-snug @md:text-4xl @md:leading-tight',
  xl: 'text-3xl leading-tight @md:text-5xl',
};

/*
  The figure's frame. `rule` draws the editorial bar at the INLINE start (the
  right edge in Arabic); `card` is a light card that keeps its own ink on a
  dark section — the slab rules leave a `bg-surface text-text` element alone.
*/
const VARIANT_CLASSES: Readonly<Record<PullQuoteProps['variant'], string>> = {
  plain: '',
  rule: 'border-s-4 border-accent ps-6 @md:ps-10',
  card: 'rounded-2xl border border-current/10 bg-surface p-8 text-text shadow-soft @md:p-12',
};

/** One large editorial quotation, attributed: a `<figure>` holding a `<blockquote>` and its caption. */
export function PullQuote({ node, props, isCanvas }: BlockRenderProps<PullQuoteProps>) {
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, pullQuoteSchema.parts);
  const root = sectionRootAttributes(props);
  /* Inside the light card the muted role is the card's own, whatever the section's tone. */
  const muted = props.variant === 'card' ? 'text-text-muted' : mutedTextClasses(props.tone);
  const hasRole = shows(props.role);
  const hasSource = shows(props.source);
  const hasAttribution =
    shows(props.author) || hasRole || hasSource || props.imageSrc !== undefined;

  return (
    <section className={root.className} {...root.motion} style={root.style}>
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
        )}
        data-pull-quote-content=""
      >
        <figure
          className={cx(
            'm-0 flex w-full max-w-content-standard flex-col gap-gap',
            ALIGN_CLASSES[props.align],
            TEXT_ALIGN_CLASSES[props.align],
            VARIANT_CLASSES[props.variant],
          )}
          data-pull-quote-variant={props.variant}
        >
          {props.showMark ? (
            /* A closing-quote glyph, mirrored in RTL so it opens the Arabic line the same way. */
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
              className="size-10 shrink-0 text-accent rtl:-scale-x-100 @md:size-12"
              data-pull-quote-mark=""
            >
              {ICON_PATHS.quote.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
          ) : null}
          <blockquote className="m-0" cite={props.sourceHref}>
            <p
              {...part('quote', {
                className: cx(
                  'm-0 font-semibold tracking-tight text-balance',
                  SIZE_CLASSES[props.size],
                ),
              })}
            >
              {props.quote}
            </p>
          </blockquote>
          {hasAttribution ? (
            <figcaption
              className={cx('flex items-center gap-3 text-start', JUSTIFY_CLASSES[props.align])}
            >
              {props.imageSrc === undefined ? null : (
                <img
                  {...part('image', {
                    className: 'size-12 shrink-0 rounded-full object-cover shadow-soft @md:size-14',
                  })}
                  src={props.imageSrc}
                  alt={props.imageAlt}
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                {shows(props.author) ? (
                  <span {...part('author', { className: 'text-base font-semibold' })}>
                    {props.author}
                  </span>
                ) : null}
                {hasRole || hasSource ? (
                  <span className={cx('text-sm leading-relaxed', muted)}>
                    {hasRole ? <span {...part('role')}>{props.role}</span> : null}
                    {hasRole && hasSource ? <span aria-hidden="true"> · </span> : null}
                    {hasSource ? (
                      <cite className="not-italic">
                        {props.sourceHref === undefined ? (
                          <span {...part('source', { className: 'font-medium' })}>
                            {props.source}
                          </span>
                        ) : (
                          <a
                            {...part('source', {
                              className:
                                'font-medium text-inherit underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                            })}
                            href={props.sourceHref}
                          >
                            {props.source}
                          </a>
                        )}
                      </cite>
                    ) : null}
                  </span>
                ) : null}
              </span>
            </figcaption>
          ) : null}
        </figure>
      </div>
    </section>
  );
}
