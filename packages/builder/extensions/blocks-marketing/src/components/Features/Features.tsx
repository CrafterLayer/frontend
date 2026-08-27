import './Features.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { FeaturesProps } from './schema';

/** Feature cards from document data — a labelled section over a semantic list. */
export function Features({ node, props }: BlockRenderProps<FeaturesProps>) {
  // The accessible name comes from the VISIBLE heading, never a copy of
  // its text: inline editing swaps that property for an editor element, and
  // an element in aria-label stringifies to "[object Object]" (009 §12).
  const headingId = `${node.id}-heading`;
  return (
    <section className="mkt-features" aria-labelledby={headingId}>
      <h2 id={headingId} className="mkt-features__heading">
        {props.heading}
      </h2>
      <ul className={`mkt-features__grid mkt-features__grid--${props.columns}`}>
        {props.items.map((item) => (
          <li key={item.title} className="mkt-features__card">
            <h3 className="mkt-features__title">{item.title}</h3>
            <p className="mkt-features__body">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
