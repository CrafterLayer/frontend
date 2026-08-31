import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { LogoCloud } from './LogoCloud';
import { logoCloudSchema } from './schema';

const node: Node = { id: 'logos', type: 'logoCloud', props: {} };

describe('LogoCloud', () => {
  it('renders a labelled section with one semantic list item per brand', () => {
    render(
      <LogoCloud
        node={node}
        props={logoCloudSchema.props.parse({
          eyebrow: 'Customer proof',
          heading: 'Trusted by focused teams',
          columns: '3',
          items: [
            { name: 'Northstar', descriptor: 'Analytics' },
            { name: 'Canopy', descriptor: 'Collaboration' },
            { name: 'Arcform' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('region', { name: 'Trusted by focused teams' })).toHaveClass(
      '@container',
      'bg-surface',
    );
    expect(screen.getByRole('list')).toHaveClass('grid', '@sm:grid-cols-3');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Northstar').closest('li')).toHaveClass('rounded-xl', 'shadow-soft');
    expect(screen.getByText('Analytics')).toBeVisible();
  });

  it('renders an intentional empty state without invented brand placeholders', () => {
    const { container } = render(
      <LogoCloud
        node={node}
        props={logoCloudSchema.props.parse({ heading: 'Partner network', items: [] })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Partner network' })).toBeVisible();
    expect(container.querySelectorAll('[data-logo-cloud-item]')).toHaveLength(0);
  });

  it('applies variant and optional section design controls', () => {
    render(
      <LogoCloud
        node={node}
        props={logoCloudSchema.props.parse({
          heading: 'Styled partners',
          items: [{ name: 'Kinetic' }],
          variant: 'framed',
          textColor: 'accentText',
          paddingInlineStart: 3,
          fontFamily: 'serif',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Styled partners' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.color).toBe('var(--t-accent-text)');
    expect(section.style.paddingInlineStart).toBe('calc(var(--t-space-unit, 4px) * 3)');
    expect(screen.getByRole('list')).toHaveClass('rounded-xl', 'shadow-soft');
    expect(screen.getByText('Kinetic').closest('li')).toHaveClass('bg-surface/80');
  });

  it('provides polished defaults and rejects malformed brand data', () => {
    const props = logoCloudSchema.props.parse({});
    expect(props.items).toHaveLength(6);
    expect(props).toMatchObject({
      variant: 'cards',
      columns: '6',
      align: 'center',
      tone: 'light',
      spacing: 'md',
      width: 'wide',
    });
    expect(logoCloudSchema.props.safeParse({ items: [{ name: '' }] }).success).toBe(false);
    expect(logoCloudSchema.props.safeParse({ columns: '7' }).success).toBe(false);
  });
});
