import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { AvatarGroup } from './AvatarGroup';
import { avatarGroupSchema } from './schema';

const node: Node = { id: 'avatars', type: 'avatarGroup', props: {} };

const people = [
  { name: 'Maya Chen', imageSrc: '/maya.jpg', initials: 'MC' },
  { name: 'Omar Haddad' },
  { name: 'Lina Faris', initials: 'LF' },
  { name: 'Sam Rivera', initials: 'SR' },
];

function renderAvatarGroup(overrides: Record<string, unknown> = {}) {
  return render(
    <AvatarGroup
      node={node}
      props={avatarGroupSchema.props.parse({ people, ...overrides })}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('AvatarGroup', () => {
  it('renders a named people list with accessible names and fallback initials', async () => {
    renderAvatarGroup({ groupLabel: 'Project team' });

    expect(screen.getByRole('list', { name: 'Project team' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Maya Chen' })).toHaveAttribute(
      'title',
      'Maya Chen',
    );
    expect(screen.getByRole('listitem', { name: 'Omar Haddad' })).toBeInTheDocument();
    expect(await screen.findByText('OH')).toHaveAttribute('aria-hidden', 'true');
  });

  it('limits visible people and announces the hidden count', () => {
    renderAvatarGroup({ maxVisible: 2, overflowLabel: 'More collaborators:' });

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('listitem', { name: 'More collaborators: 2' })).toHaveTextContent('+2');
    expect(screen.queryByRole('listitem', { name: 'Lina Faris' })).not.toBeInTheDocument();
  });

  it('uses logical overlap with authored size, shape, tone, and alignment', () => {
    renderAvatarGroup({
      align: 'end',
      maxVisible: 2,
      overlap: 'strong',
      shape: 'rounded',
      size: 'large',
      tone: 'inverse',
    });

    const list = screen.getByRole('list');
    const firstPerson = screen.getByRole('listitem', { name: 'Maya Chen' });
    expect(list).toHaveClass('justify-end');
    expect(firstPerson).toHaveClass('-ms-4', 'first:ms-0');
    expect(firstPerson.firstElementChild).toHaveClass(
      'size-14',
      'rounded-xl',
      'bg-surface-inverse',
      'text-text-inverse',
    );
    expect(screen.getByLabelText('More people: 2')).toHaveClass('-ms-4', 'size-14');
  });

  it('omits the overflow item when every person is visible', () => {
    renderAvatarGroup({ maxVisible: 4, overlap: 'none' });
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Lina Faris' })).toHaveClass('ms-0');
  });

  it('exposes every prop and enforces safe bounded data and utilities', () => {
    const defaults = avatarGroupSchema.props.parse({});
    expect(defaults).toEqual({
      align: 'start',
      groupLabel: 'People',
      maxVisible: 5,
      overflowLabel: 'More people:',
      overlap: 'medium',
      people: [],
      shape: 'circle',
      size: 'medium',
      tone: 'accent',
    });
    expect(Object.keys(avatarGroupSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(avatarGroupSchema.props.shape).sort(),
    );
    expect(
      avatarGroupSchema.props.safeParse({
        people: [{ name: 'Unsafe', imageSrc: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
    expect(
      avatarGroupSchema.props.safeParse({
        people: [{ name: 'Unsafe', imageSrc: '//evil.example/avatar.jpg' }],
      }).success,
    ).toBe(false);
    expect(
      avatarGroupSchema.props.safeParse({
        people: [{ name: 'Protocol relative', imageSrc: '//example.com/avatar.jpg' }],
      }).success,
    ).toBe(false);
    expect(
      avatarGroupSchema.props.safeParse({
        people: Array.from({ length: 21 }, (_, index) => ({
          name: `Person ${String(index)}`,
        })),
      }).success,
    ).toBe(false);
    expect(avatarGroupSchema.props.safeParse({ className: 'bg-blue-500' }).success).toBe(false);
    expect(avatarGroupSchema.props.safeParse({ className: 'md:justify-center' }).success).toBe(
      true,
    );
  });
});
