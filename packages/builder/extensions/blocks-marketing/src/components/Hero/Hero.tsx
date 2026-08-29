import '../section-layout.css';
import './Hero.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';

import type { HeroProps } from './schema';

/** Opening page section: heading, optional body, up to two actions (FR-011). */
export function Hero({ node, props, slots }: BlockRenderProps<HeroProps>) {
  // The accessible name comes from the VISIBLE heading, never a copy of
  // its text: inline editing swaps that property for an editor element, and
  // an element in aria-label stringifies to "[object Object]" (009 §12).
  const headingId = `${node.id}-heading`;
  const actionsClassName = [
    'mkt-hero__actions',
    props.layoutDirection === undefined
      ? undefined
      : `mkt-hero__actions--direction-${props.layoutDirection}`,
    props.layoutJustify === undefined
      ? undefined
      : `mkt-hero__actions--justify-${props.layoutJustify}`,
    props.layoutAlign === undefined ? undefined : `mkt-hero__actions--align-${props.layoutAlign}`,
    props.layoutGap === undefined ? undefined : `mkt-hero__actions--gap-${props.layoutGap}`,
    props.layoutWrap === undefined ? undefined : `mkt-hero__actions--wrap-${props.layoutWrap}`,
  ]
    .filter((className) => className !== undefined)
    .join(' ');
  return (
    <section
      className={`mkt-section mkt-hero mkt-hero--${props.tone} mkt-hero--${props.align} mkt-section--tone-${props.tone} mkt-section--spacing-${props.spacing}`}
      style={sectionColorStyle(props)}
      aria-labelledby={headingId}
    >
      <div
        className={`mkt-section__content mkt-hero__content mkt-section__content--align-${props.align} mkt-section__content--width-${props.width}`}
      >
        {props.eyebrow === undefined ? null : <p className="mkt-hero__eyebrow">{props.eyebrow}</p>}
        <h1 id={headingId} className="mkt-hero__heading">
          {props.heading}
        </h1>
        {props.body === undefined ? null : <p className="mkt-hero__body">{props.body}</p>}
        {slots['actions'] === undefined ? null : (
          <div className={actionsClassName}>{slots['actions']}</div>
        )}
      </div>
    </section>
  );
}
