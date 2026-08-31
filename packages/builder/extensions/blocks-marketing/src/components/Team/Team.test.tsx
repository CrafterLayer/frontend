import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Team } from './Team';
import { teamSchema } from './schema';

const node: Node = { id: 'team', type: 'team', props: {} };

function renderTeam(overrides: Record<string, unknown> = {}) {
  return render(
    <Team
      node={node}
      props={teamSchema.props.parse({
        heading: 'Our team',
        members: [
          {
            name: 'Maya Chen',
            role: 'CEO',
            bio: 'Builds calm, useful products.',
            imageSrc: '/maya.jpg',
            imageAlt: 'Maya speaking at a product event',
            profileHref: '/team/maya',
          },
          { name: 'Omar Haddad', role: 'Engineering', imageSrc: '/omar.jpg' },
          { name: 'Lina Faris', role: 'Design' },
        ],
        ...overrides,
      })}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('Team', () => {
  it('renders a labelled people list with accessible portraits and profile links', () => {
    renderTeam({ eyebrow: 'Leadership', body: 'The people behind the product.' });

    expect(screen.getByRole('region', { name: 'Our team' })).toHaveClass('@container');
    expect(screen.getByText('Leadership')).toBeInTheDocument();
    expect(screen.getByText('The people behind the product.')).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveClass('@lg:grid-cols-4');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByRole('listitem')[0]).toHaveClass(
      'rounded-xl',
      'shadow-soft',
      'hover:shadow-elevated',
    );
    expect(screen.getByRole('img', { name: 'Maya speaking at a product event' })).toHaveAttribute(
      'loading',
      'lazy',
    );
    expect(screen.getByRole('presentation')).toHaveAttribute('alt', '');
    expect(screen.getByRole('link', { name: 'View profile: Maya Chen' })).toHaveAttribute(
      'href',
      '/team/maya',
    );
    expect(screen.getByText('L', { selector: '[aria-hidden="true"]' })).toBeInTheDocument();
  });

  it.each(['cards', 'editorial', 'compact'] as const)('renders the %s layout', (variant) => {
    renderTeam({ variant, columns: '2' });
    const firstItem = screen.getAllByRole('listitem')[0];
    expect(firstItem).toHaveClass(variant === 'editorial' ? 'grid' : 'flex');
    expect(screen.getByRole('list')).toHaveClass('@md:grid-cols-2');
  });

  it('applies optional shared design controls without changing the defaults', () => {
    renderTeam({ background: 'surfaceInverse', fontFamily: 'serif', paddingInlineStart: 3 });
    const section = screen.getByRole('region', { name: 'Our team' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.paddingInlineStart).toBe('calc(var(--t-space-unit, 4px) * 3)');
  });

  it('enforces bounded content and a complete inspector contract', () => {
    const defaults = teamSchema.props.parse({});
    expect(defaults).toMatchObject({
      align: 'start',
      columns: '4',
      heading: 'Meet the team',
      members: [],
      profileLabel: 'View profile',
      spacing: 'lg',
      tone: 'transparent',
      variant: 'cards',
      width: 'wide',
    });
    expect(Object.keys(teamSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(teamSchema.props.shape).sort(),
    );
    expect(teamSchema.props.safeParse({ heading: '' }).success).toBe(false);
    expect(
      teamSchema.props.safeParse({
        members: [{ name: 'Unsafe', role: 'Test', profileHref: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
    expect(
      teamSchema.props.safeParse({
        members: Array.from({ length: 13 }, (_, index) => ({
          name: `Person ${String(index)}`,
          role: 'Role',
        })),
      }).success,
    ).toBe(false);
  });
});
