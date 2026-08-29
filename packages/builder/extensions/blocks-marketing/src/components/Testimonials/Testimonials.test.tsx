import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { testimonialsSchema } from './schema';
import { Testimonials } from './Testimonials';

const node: Node = { id: 't', type: 'testimonials', props: {} };

describe('Testimonials', () => {
  it('renders quotes as figures with attributed captions', () => {
    render(
      <Testimonials
        node={node}
        props={testimonialsSchema.props.parse({
          heading: 'Loved by teams',
          items: [{ quote: 'Boring tests, happy team.', author: 'Rana', role: 'Staff Engineer' }],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.getByRole('region', { name: 'Loved by teams' })).toBeInTheDocument();
    expect(screen.getByRole('figure')).toHaveTextContent('Boring tests, happy team.');
    expect(screen.getByText(/Rana/)).toBeInTheDocument();
    expect(screen.getByText(/Staff Engineer/)).toBeInTheDocument();
  });

  it('renders no figures for the empty default', () => {
    render(
      <Testimonials
        node={node}
        props={testimonialsSchema.props.parse({})}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });

  it('applies a background colour role without setting text colour', () => {
    render(
      <Testimonials
        node={node}
        props={testimonialsSchema.props.parse({
          heading: 'Background role testimonials',
          body: 'Colour coverage.',
          background: 'surfaceInverse',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Background role testimonials' });
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('');
  });

  it('applies a text colour role without setting background', () => {
    render(
      <Testimonials
        node={node}
        props={testimonialsSchema.props.parse({
          heading: 'Text role testimonials',
          textColor: 'accentText',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Text role testimonials' });
    expect(section.style.background).toBe('');
    expect(section.style.color).toBe('var(--t-accent-text)');
  });

  it('applies both colour roles', () => {
    render(
      <Testimonials
        node={node}
        props={testimonialsSchema.props.parse({
          heading: 'Both roles testimonials',
          background: 'surfaceInverse',
          textColor: 'accentText',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Both roles testimonials' });
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('var(--t-accent-text)');
  });

  it('applies shared typography and spacing with colour roles on the root', () => {
    render(
      <Testimonials
        node={node}
        props={testimonialsSchema.props.parse({
          heading: 'Shared style testimonials',
          background: 'surfaceInverse',
          fontFamily: 'serif',
          paddingInlineStart: 3,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Shared style testimonials' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.paddingInlineStart).toBe('calc(var(--t-space-unit, 4px) * 3)');
  });

  it('does not add an inline colour style when no role is chosen', () => {
    render(
      <Testimonials
        node={node}
        props={testimonialsSchema.props.parse({ heading: 'Uncoloured testimonials' })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Uncoloured testimonials' });
    expect(section).not.toHaveAttribute('style');
    expect(section.style.background).toBe('');
    expect(section.style.color).toBe('');
  });

  it('schema bounds quote count and lengths', () => {
    expect(
      testimonialsSchema.props.safeParse({ items: [{ quote: '', author: 'x' }] }).success,
    ).toBe(false);
  });

  it('schema: enforces the complete Testimonials builder-control contract', () => {
    const props = testimonialsSchema.props.parse({});
    expect(props).toMatchObject({
      align: 'start',
      columns: 'auto',
      spacing: 'md',
      tone: 'transparent',
      width: 'full',
    });
    expect(props.body).toBeUndefined();

    const optionalSharedStyleProps = [
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
    ] as const;
    for (const property of optionalSharedStyleProps) {
      expect(testimonialsSchema.props.shape).toHaveProperty(property);
      expect(testimonialsSchema.propertyGroups).toHaveProperty(property);
      expect(props).not.toHaveProperty(property);
    }

    const accepted = [
      ...['start', 'center', 'end'].map((align) => ({ align })),
      ...['transparent', 'light', 'dark'].map((tone) => ({ tone })),
      ...['none', 'sm', 'md', 'lg'].map((spacing) => ({ spacing })),
      ...['narrow', 'standard', 'wide', 'full'].map((width) => ({ width })),
      ...['auto', '1', '2', '3'].map((columns) => ({ columns })),
      { body: 'Stories from teams shipping with CraftKit.' },
    ];
    for (const candidate of accepted) {
      expect(testimonialsSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(
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
      { columns: '4' },
    ];
    for (const candidate of rejected) {
      expect(testimonialsSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(
        false,
      );
    }
  });
});
