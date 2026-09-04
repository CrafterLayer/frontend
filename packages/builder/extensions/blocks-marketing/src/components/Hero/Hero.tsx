import type { BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  DIRECTION_CLASSES,
  GAP_CLASSES,
  JUSTIFY_CLASSES,
  WRAP_CLASSES,
  cx,
  sectionContentClasses,
  sectionShellClasses,
} from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { HeroProps } from './schema';

/**
 * The opening section: a large heading, optional body, and up to two actions.
 *
 * Styled entirely with token-bound utilities — this block ships no stylesheet.
 * `bg-surface-inverse` compiles to `background-color: var(--t-surface-inverse)`
 * and `gap-6` to `calc(var(--t-space-unit) * 6)`, so every value here is still
 * something one theme edit can move.
 *
 * Three things are open that used to be closed: the inline gutter (a hero that
 * runs to the glass was not expressible while the padding was a stylesheet
 * constant), the class list, and the alignment of the action row.
 */
export function Hero({ node, props, slots }: BlockRenderProps<HeroProps>) {
  /*
    The accessible name comes from the VISIBLE heading, never a copy of its
    text: inline editing swaps that property for an editor element, and an
    element in `aria-label` stringifies to "[object Object]".
  */
  const headingId = `${node.id}-heading`;
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);

  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const rootStyle =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  const actions = slots['actions'];
  const hasMediaChildren = (node.slots?.['media']?.length ?? 0) > 0;
  // Empty optional slots are useful while authoring a split hero, but should
  // never become visible chrome in the default centered/editorial variants.
  const media = hasMediaChildren || props.variant === 'split' ? slots['media'] : undefined;
  const split = props.variant === 'split' && media !== undefined;
  const editorial = props.variant === 'editorial';
  const inheritsSurroundingInk = props.tone === 'dark' || props.tone === 'transparent';

  return (
    <section
      className={cx(
        sectionShellClasses(props.tone, props.spacing),
        'relative isolate overflow-hidden @container',
        sectionTypographyClasses(props),
        motionClassName,
        /* The document's own utilities go LAST, so a caller wins a conflict. */
        props.className,
      )}
      style={rootStyle}
      aria-labelledby={headingId}
      {...motionData}
    >
      <span
        className="pointer-events-none absolute -start-24 -top-24 -z-10 h-64 w-64 rounded-full bg-accent/10"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -end-16 bottom-0 -z-10 h-48 w-48 rounded-full border border-accent/20"
        aria-hidden="true"
      />
      <div
        /*
          A structural hook, not a style hook. The rendering proofs used to
          select `.mkt-hero__content` — a class that existed to STYLE the
          column — and the Tailwind migration deleted it, which broke every
          proof at once. An attribute that names the part rather than its
          appearance cannot be invalidated by restyling it again.
        */
        data-mkt-part="content"
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'relative flex flex-col',
          ALIGN_CLASSES[props.align],
        )}
      >
        <div
          data-mkt-part="layout"
          data-hero-variant={props.variant}
          className={cx(
            'grid w-full items-center gap-10 @lg:gap-16',
            split ? '@lg:grid-cols-2' : 'grid-cols-1',
          )}
        >
          <div
            data-mkt-part="copy"
            className={cx(
              'flex min-w-0 flex-col gap-6',
              ALIGN_CLASSES[props.align],
              !split && !editorial ? 'mx-auto max-w-content-standard' : undefined,
              editorial ? 'max-w-content-narrow font-serif' : undefined,
            )}
          >
            {props.eyebrow === undefined ? null : (
              <p
                data-mkt-part="eyebrow"
                className={cx(
                  'inline-flex w-fit items-center rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase',
                  props.tone === 'dark' ? 'text-inherit' : 'text-accent',
                )}
              >
                <span
                  className="me-2 inline-block h-2 w-2 rounded-full bg-accent"
                  aria-hidden="true"
                />
                {props.eyebrow}
              </p>
            )}

            {/*
          `text-balance` is the one line that most separates a hand-set headline
          from a generated one: it stops a five-word heading breaking with a
          single orphan on the second line.
        */}
            <h1
              id={headingId}
              className={cx(
                'm-0 leading-tight font-bold tracking-tight text-balance',
                editorial
                  ? 'text-4xl @md:text-5xl @xl:text-6xl'
                  : 'text-4xl @md:text-5xl @xl:text-6xl',
              )}
            >
              {props.heading}
            </h1>

            {props.body === undefined ? null : (
              <p
                className={cx(
                  'm-0 max-w-content-narrow text-lg leading-relaxed text-pretty @md:text-xl',
                  inheritsSurroundingInk ? 'text-inherit opacity-80' : 'text-text-muted',
                )}
              >
                {props.body}
              </p>
            )}

            {actions === undefined ? null : (
              <div
                data-mkt-part="actions"
                className={cx(
                  /*
                `w-full` is what makes `layoutJustify` mean anything.

                The content column is a flex COLUMN, and its `align` puts
                `items-center` (or `items-end`) on it — which sizes every child
                to its own content on the cross axis. The action row was
                therefore exactly as wide as its buttons, `justify-content` had
                no free space to distribute, and start / center / end all
                rendered identically. Spanning the column restores the axis the
                control is describing; the buttons themselves still sit wherever
                `justify` puts them, so a centred hero looks unchanged.
              */
                  'flex w-full min-w-0',
                  DIRECTION_CLASSES[props.layoutDirection ?? 'row'],
                  JUSTIFY_CLASSES[props.layoutJustify ?? props.align],
                  ALIGN_CLASSES[props.layoutAlign ?? 'center'],
                  GAP_CLASSES[props.layoutGap ?? 'sm'],
                  WRAP_CLASSES[props.layoutWrap ?? 'wrap'],
                )}
              >
                {actions}
              </div>
            )}

            {props.trustLine === undefined ? null : (
              <p
                className={cx(
                  'm-0 text-sm font-medium',
                  inheritsSurroundingInk ? 'text-inherit opacity-70' : 'text-text-muted',
                )}
                data-mkt-part="trust-line"
              >
                {props.trustLine}
              </p>
            )}
          </div>

          {media === undefined ? null : (
            <div
              data-mkt-part="media"
              className={cx(
                'relative min-w-0 overflow-hidden rounded-xl border border-text/10 bg-surface shadow-elevated',
                split ? '@lg:justify-self-end' : 'mx-auto mt-4 w-full max-w-content-wide',
              )}
            >
              {media}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
