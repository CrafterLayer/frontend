import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { PricingPlan } from './PricingPlan';
import { pricingPlanSchema } from './schema';

const node: Node = { id: 'plan', type: 'pricingPlan', props: {} };

function renderPlan(props: Record<string, unknown>, children: React.ReactNode = null) {
  return render(
    <PricingPlan
      node={node}
      props={pricingPlanSchema.props.parse(props)}
      slots={{ default: children }}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('PricingPlan', () => {
  it('shows its name, price, and billing period', () => {
    renderPlan({ name: 'Team', price: '$29', period: 'month' });

    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByText('$29')).toBeInTheDocument();
    expect(screen.getByText('per month')).toBeInTheDocument();
  });

  /*
    THE test this block was created for.

    Plans used to be an array of `{ name, price, period, features: string[] }`
    on the pricing section. That shape could express a feature list and nothing
    else, so a call-to-action inside a card — the one thing every real pricing
    section needs — was impossible to author. The card now holds whatever a
    person puts in it.
  */
  it('holds a button inside the card, which the data shape could not', () => {
    renderPlan({ name: 'Team' }, <button type="button">Choose Team</button>);

    expect(screen.getByRole('button', { name: 'Choose Team' })).toBeInTheDocument();
  });

  it('holds anything else too, having no opinion about a card body', () => {
    renderPlan(
      { name: 'Team' },
      <>
        <img src="/badge.svg" alt="Most popular" />
        <ul>
          <li>Unlimited projects</li>
        </ul>
      </>,
    );

    expect(screen.getByRole('img', { name: 'Most popular' })).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('Unlimited projects');
  });

  it('reads a one-time price as one-time, not per month', () => {
    renderPlan({ name: 'Lifetime', price: '$299', period: 'once' });

    expect(screen.getByText('one-time')).toBeInTheDocument();
  });

  /*
    The period sits in the same paragraph as the price so a screen reader
    announces "twenty-nine dollars per month" as one thought rather than two
    unrelated fragments.
  */
  it('keeps the price and its period in one readable phrase', () => {
    const { container } = renderPlan({ name: 'Team', price: '$29', period: 'month' });
    const paragraph = container.querySelector('p');

    expect(paragraph?.textContent).toBe('$29per month');
  });

  /*
    A card painted in the accent competes with the button inside it, and the
    reader then has two things shouting and no idea which to press. Emphasis is
    a border and a shadow, never a repaint.
  */
  it('marks the featured card by outlining it, not by repainting it', () => {
    const { container } = renderPlan({ name: 'Team', emphasis: 'featured' });
    const card = container.firstElementChild;

    expect(card?.className).toContain('border-accent');
    expect(card?.className).toContain('shadow-strong');
    expect(card?.className).not.toContain('bg-accent');
  });

  it('leaves an ordinary card ordinary', () => {
    const { container } = renderPlan({ name: 'Solo' });

    expect(container.firstElementChild?.className).not.toContain('border-accent');
  });

  /*
    A row of cards with unequal content must keep its footers aligned, which is
    what separates a real pricing table from three boxes of different heights.
  */
  it('lets its body grow so a row of cards lines up', () => {
    const { container } = renderPlan({ name: 'Solo' }, <p>Body</p>);

    expect(container.querySelector('.flex-1')).toBeInTheDocument();
  });

  it('carries motion as attributes rather than an inline timing', () => {
    const { container } = renderPlan({ name: 'Solo', motion: { reveal: 'fade-up' } });
    const card = container.firstElementChild;

    expect(card?.className).toContain('bldr-motion');
    expect(card?.getAttribute('data-reveal')).toBe('fade-up');
    expect(card?.outerHTML ?? '').not.toMatch(/\d+ms/);
  });

  describe('schema', () => {
    it('refuses a nameless card, which would be a heading announcing nothing', () => {
      expect(pricingPlanSchema.props.safeParse({ name: '' }).success).toBe(false);
    });

    /*
      Prices are written as people read them — "$29", "٢٩ د.أ", "Free",
      "Contact us". A numeric field would force a currency decision into the
      schema that belongs to the copy.
    */
    it('takes the price as written text, not as a number', () => {
      for (const price of ['$29', '٢٩ د.أ', 'Free', 'Contact us']) {
        expect(pricingPlanSchema.props.safeParse({ name: 'X', price }).success, price).toBe(true);
      }
    });

    it('accepts content blocks in its slot but refuses another plan', () => {
      const allow = pricingPlanSchema.slots?.['default']?.allow ?? [];

      expect(allow).toContain('cta');
      expect(allow).toContain('richText');
      // A plan inside a plan is not a layout anyone means.
      expect(allow).not.toContain('pricingPlan');
    });

    it('stores no literal colour or length', () => {
      const parsed = pricingPlanSchema.props.parse({ name: 'Solo' });

      expect(JSON.stringify(parsed)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(JSON.stringify(parsed)).not.toMatch(/\d+px/);
    });
  });
});
