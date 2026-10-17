import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { parsePropPath, setAtPropPath, type Node } from '@craftkit/builder-schema';

import { AvatarGroup } from './AvatarGroup';
import { avatarGroupSchema, type AvatarGroupProps } from './schema';

/*
  Block parts (DESIGN §4.3): the avatar list, each person, their portrait, their shown initials and their name.
  Each part is addressable on the canvas with its instance index and bind,
  carries nothing extra when published,
  takes classes and direction from `partStyles` (a this-item entry beating
  the all-items one), and renders an inline editor swapped in at its bind
  exactly where the text was.
*/
const node: Node = { id: 'avatar-parts', type: 'avatarGroup', props: {} };

const FULL = {
  people: [
    { name: 'Maya Chen', imageSrc: '/images/maya.jpg', initials: 'mc' },
    { name: 'Omar Haddad', initials: 'OH' },
  ],
};

/* The binds each part shows, in document order, for FULL. */
const EXPECTED_BINDS: Readonly<Record<string, readonly string[]>> = {
  people: ['people'],
  person: ['people.0', 'people.1'],
  'person.image': ['people.0.imageSrc'],
  'person.initials': ['people.0.initials', 'people.1.initials'],
  'person.name': ['people.0.name', 'people.1.name'],
};

/* Every text bind FULL fills. */
const SWAP_PATHS: readonly string[] = [
  'people.0.name',
  'people.1.name',
  'people.0.initials',
  'people.1.initials',
];

function renderBlock(
  overrides: Record<string, unknown>,
  isCanvas: boolean,
  swapPaths: readonly string[] = [],
) {
  let props: AvatarGroupProps = avatarGroupSchema.props.parse({ ...FULL, ...overrides });
  for (const path of swapPaths) {
    props = setAtPropPath(props, parsePropPath(path), <span data-swap={path} />);
  }
  return render(<AvatarGroup node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.getAttribute('data-ck-part') === name,
  );
}

describe('AvatarGroup parts', () => {
  it('stamps each part instance with its index and bind on the canvas', () => {
    const { container } = renderBlock({}, true);
    for (const [name, binds] of Object.entries(EXPECTED_BINDS)) {
      const found = partsNamed(container, name);
      expect(
        found.map((element) => element.getAttribute('data-ck-bind')),
        name,
      ).toEqual(binds);
    }
    const items = partsNamed(container, 'person');
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
          'person.initials': { className: 'ps-4' },
          'person.initials@1': { className: 'ps-8', dir: 'rtl' },
          people: { className: 'pe-2', dir: 'ltr' },
        },
      },
      true,
    );
    const styled = partsNamed(container, 'person.initials');
    expect(styled[0]).toHaveClass('ps-4');
    expect(styled[0]).toHaveAttribute('dir', 'auto');
    expect(styled[1]).toHaveClass('ps-8');
    expect(styled[1]).not.toHaveClass('ps-4');
    expect(styled[1]).toHaveAttribute('dir', 'rtl');
    const top = partsNamed(container, 'people')[0];
    expect(top).toHaveClass('pe-2');
    expect(top).toHaveAttribute('dir', 'ltr');
    expect(partsNamed(container, 'person')[0]).not.toHaveClass('ps-4');
  });

  it('gives text parts their own direction and leaves lists and items to the page', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'person.initials')[0]).toHaveAttribute('dir', 'auto');
    expect(partsNamed(container, 'people')[0]).not.toHaveAttribute('dir');
    expect(partsNamed(container, 'person')[0]).not.toHaveAttribute('dir');
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

  it('names each avatar by its person through aria-labelledby, with a plain-string title', () => {
    const plain = renderBlock({}, false);
    expect(plain.getByRole('listitem', { name: 'Maya Chen' })).toHaveAttribute(
      'title',
      'Maya Chen',
    );
    expect(plain.getByText('MC')).toHaveAttribute('aria-hidden', 'true');
    plain.unmount();
    const editing = renderBlock({}, true, ['people.0.name']);
    expect(partsNamed(editing.container, 'person')[0]).not.toHaveAttribute('title');
  });
});
