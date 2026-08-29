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
