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
        props={pricingSchema.props.parse({
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
        })}
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
        props={pricingSchema.props.parse({
          heading: 'Pricing',
          plans: [{ name: 'Team', price: '$29', period: 'year', features: [], highlighted: true }],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Team' }).closest('li')).toHaveClass(
      'mkt-pricing__plan--highlighted',
    );
  });

  it('applies a background colour role without setting text colour', () => {
    render(
      <Pricing
        node={node}
        props={pricingSchema.props.parse({
          heading: 'Background role pricing',
          body: 'Colour coverage.',
          background: 'surfaceInverse',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Background role pricing' });
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('');
  });

  it('applies a text colour role without setting background', () => {
    render(
      <Pricing
        node={node}
        props={pricingSchema.props.parse({
          heading: 'Text role pricing',
          textColor: 'accentText',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Text role pricing' });
    expect(section.style.background).toBe('');
    expect(section.style.color).toBe('var(--t-accent-text)');
  });

  it('applies both colour roles', () => {
    render(
      <Pricing
        node={node}
        props={pricingSchema.props.parse({
          heading: 'Both roles pricing',
          background: 'surfaceInverse',
          textColor: 'accentText',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Both roles pricing' });
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('var(--t-accent-text)');
  });

  it('does not add an inline colour style when no role is chosen', () => {
    render(
      <Pricing
        node={node}
        props={pricingSchema.props.parse({ heading: 'Uncoloured pricing' })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Uncoloured pricing' });
    expect(section).not.toHaveAttribute('style');
    expect(section.style.background).toBe('');
    expect(section.style.color).toBe('');
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

  it('schema: enforces the complete Pricing builder-control contract', () => {
    const props = pricingSchema.props.parse({});
    expect(props).toMatchObject({
      align: 'start',
      columns: 'auto',
      spacing: 'md',
      tone: 'transparent',
      width: 'full',
    });
    expect(props.body).toBeUndefined();

    const accepted = [
      ...['start', 'center', 'end'].map((align) => ({ align })),
      ...['transparent', 'light', 'dark'].map((tone) => ({ tone })),
      ...['none', 'sm', 'md', 'lg'].map((spacing) => ({ spacing })),
      ...['narrow', 'standard', 'wide', 'full'].map((width) => ({ width })),
      ...['auto', '2', '3', '4'].map((columns) => ({ columns })),
      { body: 'Choose the plan that fits.' },
    ];
    for (const candidate of accepted) {
      expect(pricingSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(
        true,
      );
    }

    const rejected = [
      { body: '' },
      { body: 'x'.repeat(201) },
      { body: 42 },
      { align: 'justify' },
      { tone: 'muted' },
      { spacing: 'xl' },
      { width: 'auto' },
      { columns: '1' },
    ];
    for (const candidate of rejected) {
      expect(pricingSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(
        false,
      );
    }
  });
});
