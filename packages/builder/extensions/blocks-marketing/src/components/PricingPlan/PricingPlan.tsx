import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import { cx } from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';

import { pricingPlanSchema, type PricingPlanProps } from './schema';

const PERIOD_LABEL: Record<PricingPlanProps['period'], string> = {
  once: 'one-time',
  month: 'per month',
  year: 'per year',
};

/**
 * One plan card.
 *
 * Styled entirely with token-bound utilities — `bg-surface` compiles to
 * `background-color: var(--t-surface)`, `p-6` to
 * `calc(var(--t-space-unit) * 6)`. There is no stylesheet for this block,
 * because there is nothing here a theme edit should not be able to move.
 *
 * The card's BODY is a slot. That is the whole point of splitting this block
 * out of `pricing`: a plan can hold a feature list, a button, a note, a badge,
 * or anything else, because the card does not decide what a plan contains.
 */
export function PricingPlan({ node, props, slots, isCanvas }: BlockRenderProps<PricingPlanProps>) {
  const part = blockPartProps({ node, props, isCanvas }, pricingPlanSchema.parts);
  const featured = props.emphasis === 'featured';
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);

  return (
    <article
      /* Structural hook for the rendering proofs — see Hero.tsx. */
      data-mkt-part="plan"
      className={cx(
        'relative flex min-w-0 flex-col gap-6 overflow-hidden rounded-xl p-6 @md:p-8',
        'bg-surface text-text',
        /*
          The featured card is raised and outlined rather than recoloured. A
          card painted in the accent competes with the button inside it, and the
          reader then has two things shouting and no idea which to press.
        */
        featured
          ? 'border-2 border-accent shadow-elevated'
          : 'border border-text-muted/25 shadow-soft',
        motionClassName,
        /* Last, so a caller's utility wins a conflict with the card's own. */
        props.className,
      )}
      style={sectionColorStyle(props)}
      {...motionData}
    >
      {featured ? (
        <span className="absolute end-4 top-4 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
          Popular
        </span>
      ) : null}
      <header className="flex min-w-0 flex-col gap-2 pe-16">
        <h3 {...part('name', { className: 'm-0 text-lg font-semibold leading-tight' })}>
          {props.name}
        </h3>
        <p className="flex items-baseline gap-1">
          <span
            {...part('price', { className: 'text-3xl font-bold leading-tight tracking-tight' })}
          >
            {props.price}
          </span>
          {/*
            The period is muted and small because it modifies the price rather
            than competing with it — and it is inside the same paragraph so a
            screen reader reads "twenty-nine dollars per month" as one thought.
          */}
          <span className="text-sm text-text-muted">{PERIOD_LABEL[props.period]}</span>
        </p>
      </header>

      {/*
        The composed body. `flex-1` lets a row of cards with unequal content
        keep their footers aligned — the detail that separates a real pricing
        table from three boxes of different heights.
      */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">{slots['default']}</div>
    </article>
  );
}
