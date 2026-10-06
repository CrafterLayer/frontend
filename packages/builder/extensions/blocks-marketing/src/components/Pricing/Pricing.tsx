import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import { GAP_CLASSES, cx, sectionContentClasses, sectionShellClasses } from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import { pricingSchema, type PricingProps } from './schema';

/**
 * A pricing section: a heading, an optional lead, and a row of composed plans.
 *
 * ## What changed, and why
 *
 * This block used to carry its plans as DATA — an array of
 * `{ name, price, period, features: string[] }` — and render them itself. That
 * shape could express a feature list and nothing else, so the one thing every
 * real pricing section needs, a call-to-action button inside each card, was
 * impossible to author. The block was a template wearing a builder block's
 * clothes.
 *
 * The plans are now `pricingPlan` nodes in a slot. This block owns the
 * heading, the rhythm, and the column count; it has no opinion about what is
 * inside a card, which is what makes a button, a badge, or an image possible
 * without a schema change.
 *
 * ## Why the columns are a grid rather than a flex row
 *
 * Cards in a flex row size to their content, so a plan with two features ends
 * up narrower than one with six. A grid gives every card the same track, which
 * is what a person means by "three plans".
 */
const COLUMN_CLASSES: Record<PricingProps['columns'], string> = {
  /*
    `auto` is a real responsive rule, not a guess: fill as many tracks as fit
    at the minimum readable card width, which is itself a token. One
    declaration replaces the breakpoint ladder every pricing section otherwise
    grows.
  */
  auto: 'grid-cols-[repeat(auto-fit,minmax(min(100%,var(--container-grid-min-track)),1fr))]',
  '2': 'grid-cols-1 sm:grid-cols-2',
  '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  '4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export function Pricing({ node, props, slots, isCanvas }: BlockRenderProps<PricingProps>) {
  /*
    The accessible name comes from the VISIBLE heading, never a copy of its
    text: inline editing swaps that property for an editor element, and an
    element in `aria-label` stringifies to "[object Object]".
  */
  const headingId = `${node.id}-heading`;
  const part = blockPartProps({ node, props, isCanvas }, pricingSchema.parts);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);

  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const rootStyle =
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
        /* The caller's own utilities go LAST so they win a conflict. */
        props.className,
      )}
      style={rootStyle}
      aria-labelledby={headingId}
      {...motionData}
    >
      <div
        /* Structural hook for the rendering proofs — see Hero.tsx. */
        data-mkt-part="content"
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col gap-10',
        )}
      >
        <header className="flex min-w-0 max-w-content-narrow flex-col gap-3">
          <p className="m-0 text-xs font-semibold tracking-wide text-accent uppercase">Plans</p>
          <h2
            {...part('heading', {
              id: headingId,
              className:
                'm-0 text-3xl font-bold leading-tight tracking-tight text-balance @md:text-4xl',
            })}
          >
            {props.heading}
          </h2>
          {props.body === undefined ? null : (
            <p
              data-mkt-part="intro"
              {...part('body', {
                className: 'm-0 max-w-content-narrow text-lg leading-relaxed text-text-muted',
              })}
            >
              {props.body}
            </p>
          )}
        </header>

        {/*
          `items-stretch` is what keeps a row of cards the same height, which is
          what lets each card's footer line up with its neighbours. Without it
          a plan with fewer features sits short and the row reads as broken.
        */}
        <div
          data-mkt-part="grid"
          {...part('plans', {
            className: cx('grid items-stretch', COLUMN_CLASSES[props.columns], GAP_CLASSES.lg),
          })}
        >
          {slots['default']}
        </div>
      </div>
    </section>
  );
}
