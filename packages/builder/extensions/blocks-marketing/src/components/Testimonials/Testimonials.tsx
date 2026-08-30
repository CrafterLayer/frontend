import '../section-layout.css';
import './Testimonials.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { TestimonialsProps } from './schema';

/** Customer quotes as semantic figures with attributed captions. */
export function Testimonials({ node, props }: BlockRenderProps<TestimonialsProps>) {
  // The accessible name comes from the VISIBLE heading, never a copy of
  // its text: inline editing swaps that property for an editor element, and
  // an element in aria-label stringifies to "[object Object]" (009 §12).
  const headingId = `${node.id}-heading`;
  const typographyClassName = sectionTypographyClasses(props);
  /*
    Motion arrives as ATTRIBUTES, never as inline style: the stylesheet stays
    the one place any timing lives, so a document carries a named step and never
    a duration. `class` is pulled out because React spells it `className`.
  */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const className = [
    'mkt-section',
    'mkt-testimonials',
    `mkt-section--tone-${props.tone}`,
    `mkt-section--spacing-${props.spacing}`,
    typographyClassName,
    motionClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  return (
    <section className={className} {...motionData} style={style} aria-labelledby={headingId}>
      <div
        className={`mkt-section__content mkt-testimonials__content mkt-section__content--align-${props.align} mkt-section__content--width-${props.width}`}
      >
        <h2 id={headingId} className="mkt-testimonials__heading">
          {props.heading}
        </h2>
        {props.body === undefined ? null : (
          <p className="mkt-section__intro mkt-testimonials__intro">{props.body}</p>
        )}
        <ul className={`mkt-testimonials__grid mkt-testimonials__grid--${props.columns}`}>
          {props.items.map((item) => (
            <li key={`${item.author}-${item.quote.slice(0, 16)}`}>
              <figure className="mkt-testimonials__card">
                <blockquote className="mkt-testimonials__quote">{item.quote}</blockquote>
                <figcaption className="mkt-testimonials__author">
                  {item.author}
                  {item.role === undefined ? null : (
                    <span className="mkt-testimonials__role"> — {item.role}</span>
                  )}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
