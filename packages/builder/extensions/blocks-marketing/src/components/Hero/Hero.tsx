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
import { sectionMotionAttributes } from '../section-motion';
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

  return (
    <section
      className={cx(
        sectionShellClasses(props.tone, props.spacing),
        sectionTypographyClasses(props),
        motionClassName,
        /* The document's own utilities go LAST, so a caller wins a conflict. */
        props.className,
      )}
      style={rootStyle}
      aria-labelledby={headingId}
      {...motionData}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col gap-6',
          ALIGN_CLASSES[props.align],
        )}
      >
        {props.eyebrow === undefined ? null : (
          <p className="text-sm font-medium tracking-wide text-text-muted uppercase">
            {props.eyebrow}
          </p>
        )}

        {/*
          `text-balance` is the one line that most separates a hand-set headline
          from a generated one: it stops a five-word heading breaking with a
          single orphan on the second line.
        */}
        <h1 id={headingId} className="text-2xl leading-tight font-bold text-balance sm:text-3xl">
          {props.heading}
        </h1>

        {props.body === undefined ? null : (
          <p className="max-w-content-narrow text-lg leading-relaxed text-pretty">{props.body}</p>
        )}

        {actions === undefined ? null : (
          <div
            className={cx(
              'flex min-w-0',
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
      </div>
    </section>
  );
}
