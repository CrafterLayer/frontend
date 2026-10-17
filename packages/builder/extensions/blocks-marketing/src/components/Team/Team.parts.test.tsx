import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { parsePropPath, setAtPropPath, type Node } from '@craftkit/builder-schema';

import { Team } from './Team';
import { teamSchema, type TeamProps } from './schema';

/*
  Block parts (DESIGN §4.3): the intro, the people grid, each person, their name, role, bio and portrait, and the shared profile link text.
  Each part is addressable on the canvas with its instance index and bind,
  carries nothing extra when published,
  takes classes and direction from `partStyles` (a this-item entry beating
  the all-items one), and renders an inline editor swapped in at its bind
  exactly where the text was.
*/
const node: Node = { id: 'team-parts', type: 'team', props: {} };

const FULL = {
  eyebrow: 'Leadership',
  heading: 'Meet the team.',
  body: 'The people behind the product.',
  members: [
    {
      name: 'Maya Chen',
      role: 'Founder',
      bio: 'Builds the roadmap.',
      imageSrc: '/maya.jpg',
      imageAlt: 'Maya',
      profileHref: '/team/maya',
    },
    { name: 'Omar Haddad', role: 'Engineering', profileHref: '/team/omar' },
  ],
};

/* The binds each part shows, in document order, for FULL. */
const EXPECTED_BINDS: Readonly<Record<string, readonly string[]>> = {
  eyebrow: ['eyebrow'],
  heading: ['heading'],
  body: ['body'],
  members: ['members'],
  member: ['members.0', 'members.1'],
  'member.name': ['members.0.name', 'members.1.name'],
  'member.role': ['members.0.role', 'members.1.role'],
  'member.bio': ['members.0.bio'],
  'member.image': ['members.0.imageSrc'],
  profileLabel: ['profileLabel', 'profileLabel'],
};

/* Every text bind FULL fills. */
const SWAP_PATHS: readonly string[] = [
  'eyebrow',
  'heading',
  'body',
  'members.0.name',
  'members.1.name',
  'members.0.role',
  'members.1.role',
  'members.0.bio',
  'profileLabel',
];

function renderBlock(
  overrides: Record<string, unknown>,
  isCanvas: boolean,
  swapPaths: readonly string[] = [],
) {
  let props: TeamProps = teamSchema.props.parse({ ...FULL, ...overrides });
  for (const path of swapPaths) {
    props = setAtPropPath(props, parsePropPath(path), <span data-swap={path} />);
  }
  return render(<Team node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.getAttribute('data-ck-part') === name,
  );
}

describe('Team parts', () => {
  it('stamps each part instance with its index and bind on the canvas', () => {
    const { container } = renderBlock({}, true);
    for (const [name, binds] of Object.entries(EXPECTED_BINDS)) {
      const found = partsNamed(container, name);
      expect(
        found.map((element) => element.getAttribute('data-ck-bind')),
        name,
      ).toEqual(binds);
    }
    const items = partsNamed(container, 'member');
    expect(items.map((element) => element.getAttribute('data-ck-part-index'))).toEqual(
      items.map((_, index) => String(index)),
    );
  });

  it('publishes no part markers', () => {
    const { container } = renderBlock({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('lands an all-items style on every instance and a this-item style on one, this winning', () => {
    const { container } = renderBlock(
      {
        partStyles: {
          'member.name': { className: 'ps-4' },
          'member.name@1': { className: 'ps-8', dir: 'rtl' },
          heading: { className: 'pe-2', dir: 'ltr' },
        },
      },
      true,
    );
    const styled = partsNamed(container, 'member.name');
    expect(styled[0]).toHaveClass('ps-4');
    expect(styled[0]).toHaveAttribute('dir', 'auto');
    expect(styled[1]).toHaveClass('ps-8');
    expect(styled[1]).not.toHaveClass('ps-4');
    expect(styled[1]).toHaveAttribute('dir', 'rtl');
    const top = partsNamed(container, 'heading')[0];
    expect(top).toHaveClass('pe-2');
    expect(top).toHaveAttribute('dir', 'ltr');
    expect(partsNamed(container, 'member.role')[0]).not.toHaveClass('ps-4');
  });

  it('gives text parts their own direction and leaves lists and items to the page', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'member.name')[0]).toHaveAttribute('dir', 'auto');
    expect(partsNamed(container, 'members')[0]).not.toHaveAttribute('dir');
    expect(partsNamed(container, 'member')[0]).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind in place', () => {
    const { container } = renderBlock({}, true, SWAP_PATHS);
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const path of SWAP_PATHS) {
      const swapped = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === path,
      );
      expect(swapped, path).toHaveLength(1);
      expect(swapped[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', path);
    }
  });

  it('names each profile link by its visible label and the person, never a built string', () => {
    const { getByRole } = renderBlock({}, false);
    expect(getByRole('link', { name: 'View profile Maya Chen' })).toHaveAttribute(
      'href',
      '/team/maya',
    );
    expect(getByRole('link', { name: 'View profile Omar Haddad' })).not.toHaveAttribute(
      'aria-label',
    );
  });

  it('mounts an inline editor for the shared label once and keeps the stored text elsewhere', () => {
    const stored: Node = { ...node, props: { profileLabel: 'See profile' } };
    const props = setAtPropPath(
      teamSchema.props.parse({ ...FULL, profileLabel: 'See profile' }),
      ['profileLabel'],
      <span data-swap="profileLabel" />,
    );
    const { container } = render(
      <Team node={stored} props={props} slots={{}} data={{}} isCanvas />,
    );
    const labels = partsNamed(container, 'profileLabel');
    expect(labels[0]?.querySelector('[data-swap="profileLabel"]')).not.toBeNull();
    expect(labels[1]).toHaveTextContent('See profile');
  });
});
