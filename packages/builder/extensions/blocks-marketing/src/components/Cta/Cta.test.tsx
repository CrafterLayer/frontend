import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Cta } from './Cta';
import { ctaSchema } from './schema';

const node: Node = { id: 'c', type: 'cta', props: {} };

describe('Cta', () => {
  it('renders a real button labelled by its text, with the optional note', () => {
    render(
      <Cta
        node={node}
        props={{ label: 'Learn more', emphasis: 'ghost', note: 'Free trial' }}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument();
    expect(screen.getByText('Free trial')).toBeInTheDocument();
  });

  it('defaults parse to a primary Get started button', () => {
    const props = ctaSchema.props.parse({});
    expect(props).toEqual({ label: 'Get started', emphasis: 'primary' });
  });

  it('schema rejects empty and oversized labels', () => {
    expect(ctaSchema.props.safeParse({ label: '' }).success).toBe(false);
    expect(ctaSchema.props.safeParse({ label: 'x'.repeat(41) }).success).toBe(false);
  });
});
