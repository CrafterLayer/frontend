import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { statsSchema } from './schema';
import { Stats } from './Stats';

const node: Node = { id: 'stats', type: 'stats', props: {} };

describe('Stats', () => {
  it('renders a labelled metric section with valid description-list relationships', () => {
    const { container } = render(
      <Stats
        node={node}
        props={statsSchema.props.parse({
          heading: 'Proof in the numbers',
          items: [
            { value: '42%', label: 'Faster launch', detail: 'Median improvement' },
            { value: '3.4×', label: 'More iterations' },
          ],
          columns: '2',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('region', { name: 'Proof in the numbers' })).toHaveClass('@container');
    expect(container.querySelector('dl')).toHaveClass('grid', '@sm:grid-cols-2');
    expect(container.querySelectorAll('dt')).toHaveLength(2);
    expect(container.querySelectorAll('dd')).toHaveLength(3);
    expect(screen.getByText('Faster launch').closest('[data-stat-item]')).toHaveClass(
      'rounded-xl',
      'shadow-soft',
    );
    expect(screen.getByText('42%')).toBeVisible();
  });

  it('renders an empty metric collection without fake values', () => {
    const { container } = render(
      <Stats
        node={node}
        props={statsSchema.props.parse({ heading: 'Early-stage baseline', items: [] })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Early-stage baseline' })).toBeVisible();
    expect(container.querySelectorAll('[data-stat-item]')).toHaveLength(0);
  });

  it('applies contrast presentation and inherited section controls', () => {
    render(
      <Stats
        node={node}
        props={statsSchema.props.parse({
          heading: 'Controlled metrics',
          items: [{ value: '99%', label: 'Reliable' }],
          variant: 'contrast',
          background: 'accent',
          fontWeight: 'medium',
          marginInlineStart: 2,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Controlled metrics' });
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineStart).toBe('calc(var(--t-space-unit, 4px) * 2)');
    expect(section).toHaveClass('mkt-type--weight-medium');
    expect(screen.getByText('Reliable').closest('[data-stat-item]')).toHaveClass(
      'bg-surface-inverse',
      'shadow-elevated',
    );
  });

  it('ships useful defaults and rejects malformed metrics', () => {
    const props = statsSchema.props.parse({});
    expect(props.items).toHaveLength(4);
    expect(props).toMatchObject({
      variant: 'cards',
      columns: 'auto',
      headerLayout: 'split',
      align: 'start',
      spacing: 'lg',
      width: 'wide',
    });
    expect(statsSchema.props.safeParse({ items: [{ value: '', label: 'Users' }] }).success).toBe(
      false,
    );
    expect(statsSchema.props.safeParse({ headerLayout: 'sidebar' }).success).toBe(false);
  });
});
