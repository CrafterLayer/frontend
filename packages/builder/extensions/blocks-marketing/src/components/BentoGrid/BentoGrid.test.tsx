import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { BentoGrid } from './BentoGrid';
import { bentoGridSchema } from './schema';

const node: Node = { id: 'bento', type: 'bento-grid', props: {} };

describe('BentoGrid', () => {
  it('renders a labelled semantic list with explicit hierarchy', () => {
    render(
      <BentoGrid
        node={node}
        props={bentoGridSchema.props.parse({
          heading: 'Connected work',
          items: [
            {
              title: 'Signal',
              body: 'See what matters.',
              metric: '3.4×',
              size: 'featured',
              emphasis: 'inverse',
            },
            { title: 'Control', body: 'Keep the guardrails.', size: 'small' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('region', { name: 'Connected work' })).toHaveClass('@container');
    expect(screen.getByRole('list')).toHaveClass('@md:grid-cols-6', '@xl:grid-cols-12');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Signal').closest('[data-bento-card]')).toHaveClass(
      '@xl:col-span-8',
      'bg-surface-inverse',
      'rounded-xl',
      'min-h-72',
    );
    expect(screen.getByText('3.4×')).toHaveClass('text-3xl');
    expect(screen.getByText('3.4×')).toHaveAttribute('data-bento-metric');
  });

  it('makes equal layout ignore individual mosaic sizes', () => {
    render(
      <BentoGrid
        node={node}
        props={bentoGridSchema.props.parse({
          heading: 'Equal cards',
          layout: 'equal',
          items: [{ title: 'Featured', body: 'Still equal.', size: 'featured' }],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('listitem')).toHaveClass('@md:col-span-3', '@xl:col-span-4');
    expect(screen.getByRole('listitem')).not.toHaveClass('@xl:col-span-8');
  });

  it('applies shared theme, typography, and logical spacing controls', () => {
    render(
      <BentoGrid
        node={node}
        props={bentoGridSchema.props.parse({
          heading: 'Styled grid',
          background: 'surfaceInverse',
          textColor: 'textInverse',
          fontWeight: 'bold',
          marginInlineStart: 3,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Styled grid' });
    expect(section).toHaveClass('mkt-type--weight-bold');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('var(--t-text-inverse)');
    expect(section.style.marginInlineStart).toBe('calc(var(--t-space-unit, 4px) * 3)');
  });

  it('rejects malformed or excessive cards', () => {
    expect(bentoGridSchema.props.safeParse({ items: [{ title: '', body: 'Body' }] }).success).toBe(
      false,
    );
    expect(
      bentoGridSchema.props.safeParse({
        items: Array.from({ length: 13 }, (_, index) => ({
          title: `Card ${String(index)}`,
          body: 'Body',
        })),
      }).success,
    ).toBe(false);
  });
});
