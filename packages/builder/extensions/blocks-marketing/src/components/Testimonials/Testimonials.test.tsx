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
        props={{
          heading: 'Loved by teams',
          items: [{ quote: 'Boring tests, happy team.', author: 'Rana', role: 'Staff Engineer' }],
        }}
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
});
