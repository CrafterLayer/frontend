import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Pricing } from './Pricing';
import { pricingSchema } from './schema';

const node: Node = { id: 'p', type: 'pricing', props: {} };

describe('Pricing', () => {
  it('renders each plan with name, price, period, and features', () => {
    render(
      <Pricing
        node={node}
        props={{
          heading: 'Simple pricing',
          plans: [
            { name: 'Solo', price: '$9', period: 'month', features: ['1 seat', 'Email support'] },
            {
              name: 'Team',
              price: '$29',
              period: 'month',
              features: ['10 seats'],
              highlighted: true,
            },
          ],
        }}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.getByRole('region', { name: 'Simple pricing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Team' })).toBeInTheDocument();
    expect(screen.getByText('$9')).toBeInTheDocument();
    expect(screen.getByText('1 seat')).toBeInTheDocument();
  });

  it('marks the highlighted plan visually via the modifier class', () => {
    render(
      <Pricing
        node={node}
        props={{
          heading: 'Pricing',
          plans: [{ name: 'Team', price: '$29', period: 'year', features: [], highlighted: true }],
        }}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Team' }).closest('li')).toHaveClass(
      'mkt-pricing__plan--highlighted',
    );
  });

  it('schema bounds plans and features', () => {
    const tooMany = Array.from({ length: 5 }, (_, index) => ({
      name: `P${String(index)}`,
      price: '$1',
      period: 'month' as const,
      features: [],
    }));
    expect(pricingSchema.props.safeParse({ plans: tooMany }).success).toBe(false);
  });
});
