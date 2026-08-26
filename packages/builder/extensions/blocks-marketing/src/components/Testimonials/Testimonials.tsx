import './Testimonials.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { TestimonialsProps } from './schema';

/** Customer quotes as semantic figures with attributed captions. */
export function Testimonials({ props }: BlockRenderProps<TestimonialsProps>) {
  return (
    <section className="mkt-testimonials" aria-label={props.heading}>
      <h2 className="mkt-testimonials__heading">{props.heading}</h2>
      <ul className="mkt-testimonials__grid">
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
    </section>
  );
}
