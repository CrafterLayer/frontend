import './Hero.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { HeroProps } from './schema';

/** Opening page section: heading, optional body, up to two actions (FR-011). */
export function Hero({ props, slots }: BlockRenderProps<HeroProps>) {
  return (
    <section
      className={`mkt-hero mkt-hero--${props.tone} mkt-hero--${props.align}`}
      aria-label={props.heading}
    >
      <h1 className="mkt-hero__heading">{props.heading}</h1>
      {props.body === undefined ? null : <p className="mkt-hero__body">{props.body}</p>}
      {slots['actions'] === undefined ? null : (
        <div className="mkt-hero__actions">{slots['actions']}</div>
      )}
    </section>
  );
}
