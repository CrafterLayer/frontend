import './Pricing.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { PricingProps } from './schema';

/** Pricing plans from document data; the highlighted plan is visibly recommended. */
export function Pricing({ node, props }: BlockRenderProps<PricingProps>) {
  // The accessible name comes from the VISIBLE heading, never a copy of
  // its text: inline editing swaps that property for an editor element, and
  // an element in aria-label stringifies to "[object Object]" (009 §12).
  const headingId = `${node.id}-heading`;
  return (
    <section className="mkt-pricing" aria-labelledby={headingId}>
      <h2 id={headingId} className="mkt-pricing__heading">
        {props.heading}
      </h2>
      <ul className="mkt-pricing__grid">
        {props.plans.map((plan) => (
          <li
            key={plan.name}
            className={`mkt-pricing__plan${plan.highlighted === true ? ' mkt-pricing__plan--highlighted' : ''}`}
          >
            <h3 className="mkt-pricing__name">{plan.name}</h3>
            <p className="mkt-pricing__price">
              <strong>{plan.price}</strong>
              <span className="mkt-pricing__period">/{plan.period}</span>
            </p>
            <ul className="mkt-pricing__features">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
