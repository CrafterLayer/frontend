import './Hero.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { HeroProps } from './schema';

/** Opening page section: heading, optional body, up to two actions (FR-011). */
export function Hero({ node, props, slots }: BlockRenderProps<HeroProps>) {
  // The accessible name comes from the VISIBLE heading, never a copy of
  // its text: inline editing swaps that property for an editor element, and
  // an element in aria-label stringifies to "[object Object]" (009 §12).
  const headingId = `${node.id}-heading`;
  return (
    <section
      className={`mkt-hero mkt-hero--${props.tone} mkt-hero--${props.align}`}
      aria-labelledby={headingId}
    >
      <h1 id={headingId} className="mkt-hero__heading">
        {props.heading}
      </h1>
      {props.body === undefined ? null : <p className="mkt-hero__body">{props.body}</p>}
      {slots['actions'] === undefined ? null : (
        <div className="mkt-hero__actions">{slots['actions']}</div>
      )}
    </section>
  );
}
