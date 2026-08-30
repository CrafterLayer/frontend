import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Pricing } from './Pricing';
import { pricingSchema } from './schema';

const node: Node = { id: 'p', type: 'pricing', props: {} };

describe('Pricing', () => {
  /*
    The re-architecture, asserted.

    Plans used to be an array of `{ name, price, period, features: string[] }`
    rendered by this block. That shape could express a feature list and nothing
    else, so a call-to-action button inside a card — the one thing every real
    pricing section needs — was impossible to author. Plans are nodes in a slot
    now, and this section has no opinion about what is inside one.
  */
  it('renders whatever the slot holds, having no opinion about a plan', () => {
    render(
      <Pricing
        node={node}
        props={pricingSchema.props.parse({ heading: 'Simple pricing' })}
        slots={{
          default: (
            <article>
              <h3>Team</h3>
              <button type="button">Choose Team</button>
            </article>
          ),
        }}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument();
    // The assertion the old shape could not have made.
    expect(screen.getByRole('button', { name: 'Choose Team' })).toBeInTheDocument();
  });

  it('accepts only plan cards in its slot', () => {
    expect(pricingSchema.slots?.['default']?.allow).toEqual(['pricingPlan']);
  });

  /*
    A schema that still carried `plans` would let a document hold plan DATA
    that nothing renders — invisible content, which is worse than an error.
  */
  it('no longer carries plans as data', () => {
    expect(pricingSchema.props.shape).not.toHaveProperty('plans');
  });

  it('gives every card the same track rather than sizing it to its content', () => {
    const { container } = render(
      <Pricing
        node={node}
        props={pricingSchema.props.parse({ heading: 'Pricing', columns: '3' })}
        slots={{ default: <article>A</article> }}
        data={{}}
        isCanvas={false}
      />,
    );

    // A grid, and stretched: cards in a flex row size to their content, so a
    // plan with two features ends up narrower than one with six.
    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('items-stretch');
    expect(grid?.className).toContain('lg:grid-cols-3');
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

  it('applies shared typography, spacing, and colour controls on the root', () => {
    render(
      <Pricing
        node={node}
        props={pricingSchema.props.parse({
          heading: 'Styled pricing',
          background: 'surfaceInverse',
          lineHeight: 'relaxed',
          paddingBlockEnd: 5,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Styled pricing' });
    expect(section).toHaveClass('mkt-type--line-height-relaxed');
    expect(section.style.paddingBlockEnd).toBe('calc(var(--t-space-unit, 4px) * 5)');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
  });

  it('still bounds the copy it does own', () => {
    expect(pricingSchema.props.safeParse({ heading: '' }).success).toBe(false);
    expect(pricingSchema.props.safeParse({ heading: 'x'.repeat(81) }).success).toBe(false);
    expect(pricingSchema.props.safeParse({ heading: 'Pricing' }).success).toBe(true);
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
    for (const sharedProp of [
      'background',
      'textColor',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'letterSpacing',
      'textAlign',
      'textCase',
      'paddingBlockStart',
      'paddingBlockEnd',
      'paddingInlineStart',
      'paddingInlineEnd',
      'marginBlockStart',
      'marginBlockEnd',
      'marginInlineStart',
      'marginInlineEnd',
    ] as const) {
      expect(Object.hasOwn(pricingSchema.props.shape, sharedProp), sharedProp).toBe(true);
      expect(Object.hasOwn(props, sharedProp), `${sharedProp} must not be defaulted`).toBe(false);
      expect(
        pricingSchema.propertyGroups?.[sharedProp],
        `${sharedProp} property group`,
      ).toBeDefined();
    }

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
