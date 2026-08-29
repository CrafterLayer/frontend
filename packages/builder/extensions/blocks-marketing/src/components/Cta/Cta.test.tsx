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
        props={ctaSchema.props.parse({
          label: 'Learn more',
          emphasis: 'ghost',
          note: 'Free trial',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument();
    expect(screen.getByText('Free trial')).toBeInTheDocument();
  });

  it('schema rejects empty and oversized labels', () => {
    expect(ctaSchema.props.safeParse({ label: '' }).success).toBe(false);
    expect(ctaSchema.props.safeParse({ label: 'x'.repeat(41) }).success).toBe(false);
  });

  it('schema: enforces the complete CTA builder-control contract', () => {
    expect(ctaSchema.props.parse({})).toEqual({
      emphasis: 'primary',
      label: 'Get started',
      size: 'md',
      width: 'fit',
    });

    for (const size of ['sm', 'md', 'lg']) {
      expect(ctaSchema.props.safeParse({ size }).success, `size=${size}`).toBe(true);
    }
    for (const width of ['fit', 'full']) {
      expect(ctaSchema.props.safeParse({ width }).success, `width=${width}`).toBe(true);
    }
    expect(ctaSchema.props.safeParse({ size: 'xl' }).success).toBe(false);
    expect(ctaSchema.props.safeParse({ width: 'auto' }).success).toBe(false);
  });
});
