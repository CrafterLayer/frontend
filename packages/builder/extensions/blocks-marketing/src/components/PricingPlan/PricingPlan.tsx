import type { BlockRenderProps } from '@craftkit/builder-schema';

import { cx } from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';

import type { PricingPlanProps } from './schema';

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
export function PricingPlan({ props, slots }: BlockRenderProps<PricingPlanProps>) {
  const featured = props.emphasis === 'featured';
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);

  return (
    <article
      className={cx(
        'flex min-w-0 flex-col gap-4 rounded-base p-6',
        'bg-surface text-text',
        /*
          The featured card is raised and outlined rather than recoloured. A
          card painted in the accent competes with the button inside it, and the
          reader then has two things shouting and no idea which to press.
        */
        featured
          ? 'border-2 border-accent shadow-strong'
          : 'border border-text-muted/25 shadow-soft',
        motionClassName,
        /* Last, so a caller's utility wins a conflict with the card's own. */
        props.className,
      )}
      style={sectionColorStyle(props)}
      {...motionData}
    >
      <header className="flex min-w-0 flex-col gap-1">
        <h3 className="text-lg font-semibold leading-tight">{props.name}</h3>
        <p className="flex items-baseline gap-1">
          <span className="text-2xl font-bold leading-tight">{props.price}</span>
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
