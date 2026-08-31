import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Features } from './Features';
import { featuresSchema } from './schema';

const node: Node = { id: 'f', type: 'features', props: {} };

describe('Features', () => {
  it('renders a labelled section with a list item per feature', () => {
    render(
      <Features
        node={node}
        props={featuresSchema.props.parse({
          heading: 'Why us',
          columns: '2',
          items: [
            { title: 'Fast', body: 'Very fast.' },
            { title: 'Safe', body: 'Very safe.' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.getByRole('region', { name: 'Why us' })).toHaveClass(
      'bg-transparent',
      'py-section-md',
      '@container',
    );
    expect(screen.getByRole('list')).toHaveClass('grid', '@sm:grid-cols-2', 'gap-gap');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 3, name: 'Fast' }).closest('li')).toHaveClass(
      'rounded-xl',
      'bg-surface',
      'p-6',
    );
  });

  it('renders no list items for the empty default', () => {
    render(
      <Features
        node={node}
        props={featuresSchema.props.parse({})}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('applies a background colour role without setting text colour', () => {
    render(
      <Features
        node={node}
        props={featuresSchema.props.parse({
          heading: 'Background role features',
          body: 'Colour coverage.',
          background: 'surfaceInverse',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Background role features' });
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('');
  });

  it('applies a text colour role without setting background', () => {
    render(
      <Features
        node={node}
        props={featuresSchema.props.parse({
          heading: 'Text role features',
          textColor: 'accentText',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Text role features' });
    expect(section.style.background).toBe('');
    expect(section.style.color).toBe('var(--t-accent-text)');
  });

  it('applies both colour roles', () => {
    render(
      <Features
        node={node}
        props={featuresSchema.props.parse({
          heading: 'Both roles features',
          background: 'surfaceInverse',
          textColor: 'accentText',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Both roles features' });
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('var(--t-accent-text)');
  });

  it('does not add an inline colour style when no role is chosen', () => {
    render(
      <Features
        node={node}
        props={featuresSchema.props.parse({ heading: 'Uncoloured features' })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Uncoloured features' });
    expect(section).not.toHaveAttribute('style');
    expect(section.style.background).toBe('');
    expect(section.style.color).toBe('');
  });

  it('applies shared typography, spacing, and colour controls on the root', () => {
    render(
      <Features
        node={node}
        props={featuresSchema.props.parse({
          heading: 'Styled features',
          textColor: 'accentText',
          fontWeight: 'bold',
          marginBlockEnd: 4,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Styled features' });
    expect(section).toHaveClass('mkt-type--weight-bold');
    expect(section.style.marginBlockEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
    expect(section.style.color).toBe('var(--t-accent-text)');
  });

  it('schema rejects malformed items', () => {
    expect(featuresSchema.props.safeParse({ items: [{ title: '', body: 'x' }] }).success).toBe(
      false,
    );
  });

  it('schema: enforces the complete Features builder-control contract', () => {
    const props = featuresSchema.props.parse({});
    expect(props).toMatchObject({
      align: 'start',
      columns: '3',
      spacing: 'md',
      tone: 'transparent',
      variant: 'cards',
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
      expect(Object.hasOwn(featuresSchema.props.shape, sharedProp), sharedProp).toBe(true);
      expect(Object.hasOwn(props, sharedProp), `${sharedProp} must not be defaulted`).toBe(false);
      expect(
        featuresSchema.propertyGroups?.[sharedProp],
        `${sharedProp} property group`,
      ).toBeDefined();
    }

    const accepted = [
      ...['start', 'center', 'end'].map((align) => ({ align })),
      ...['transparent', 'light', 'dark'].map((tone) => ({ tone })),
      ...['none', 'sm', 'md', 'lg'].map((spacing) => ({ spacing })),
      ...['narrow', 'standard', 'wide', 'full'].map((width) => ({ width })),
      ...['1', '2', '3', '4'].map((columns) => ({ columns })),
      ...['cards', 'bordered', 'minimal'].map((variant) => ({ variant })),
      { eyebrow: 'One platform' },
      { body: 'Everything your team needs.' },
      { items: [{ icon: '↗', kicker: 'Speed', title: 'Fast', body: 'Very fast.' }] },
    ];
    for (const candidate of accepted) {
      expect(featuresSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(
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
      { columns: '5' },
      { variant: 'tiles' },
      { eyebrow: '' },
      { items: [{ icon: 'way-too-long', title: 'Fast', body: 'Very fast.' }] },
    ];
    for (const candidate of rejected) {
      expect(featuresSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(
        false,
      );
    }
  });
});
