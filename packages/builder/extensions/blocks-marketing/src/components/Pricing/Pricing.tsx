import './Pricing.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { PricingProps } from './schema';

/** Pricing plans from document data; the highlighted plan is visibly recommended. */
export function Pricing({ props }: BlockRenderProps<PricingProps>) {
  return (
    <section className="mkt-pricing" aria-label={props.heading}>
      <h2 className="mkt-pricing__heading">{props.heading}</h2>
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
