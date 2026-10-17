import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { parsePropPath, setAtPropPath, type Node } from '@craftkit/builder-schema';

import { Breadcrumbs } from './Breadcrumbs';
import { breadcrumbsSchema, type BreadcrumbsProps } from './schema';

/*
  Block parts (DESIGN §4.3): the trail, each crumb and its link; the current page is a link part without a destination.
  Each part is addressable on the canvas with its instance index and bind,
  carries nothing extra when published,
  takes classes and direction from `partStyles` (a this-item entry beating
  the all-items one), and renders an inline editor swapped in at its bind
  exactly where the text was.
*/
const node: Node = { id: 'breadcrumbs-parts', type: 'breadcrumbs', props: {} };

const FULL = {
  items: [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: 'Lamp', current: true },
  ],
};

/* The binds each part shows, in document order, for FULL. */
const EXPECTED_BINDS: Readonly<Record<string, readonly string[]>> = {
  items: ['items'],
  item: ['items.0', 'items.1', 'items.2'],
  'item.link': ['items.0.label', 'items.1.label', 'items.2.label'],
};

/* Every text bind FULL fills. */
const SWAP_PATHS: readonly string[] = ['items.0.label', 'items.1.label', 'items.2.label'];

function renderBlock(
  overrides: Record<string, unknown>,
  isCanvas: boolean,
  swapPaths: readonly string[] = [],
) {
  let props: BreadcrumbsProps = breadcrumbsSchema.props.parse({ ...FULL, ...overrides });
  for (const path of swapPaths) {
    props = setAtPropPath(props, parsePropPath(path), <span data-swap={path} />);
  }
  return render(<Breadcrumbs node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.getAttribute('data-ck-part') === name,
  );
}

describe('Breadcrumbs parts', () => {
  it('stamps each part instance with its index and bind on the canvas', () => {
    const { container } = renderBlock({}, true);
    for (const [name, binds] of Object.entries(EXPECTED_BINDS)) {
      const found = partsNamed(container, name);
      expect(
        found.map((element) => element.getAttribute('data-ck-bind')),
        name,
      ).toEqual(binds);
    }
    const items = partsNamed(container, 'item');
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
          'item.link': { className: 'ps-4' },
          'item.link@1': { className: 'ps-8', dir: 'rtl' },
          items: { className: 'pe-2', dir: 'ltr' },
        },
      },
      true,
    );
    const styled = partsNamed(container, 'item.link');
    expect(styled[0]).toHaveClass('ps-4');
    expect(styled[0]).toHaveAttribute('dir', 'auto');
    expect(styled[1]).toHaveClass('ps-8');
    expect(styled[1]).not.toHaveClass('ps-4');
    expect(styled[1]).toHaveAttribute('dir', 'rtl');
    const top = partsNamed(container, 'items')[0];
    expect(top).toHaveClass('pe-2');
    expect(top).toHaveAttribute('dir', 'ltr');
    expect(partsNamed(container, 'item')[0]).not.toHaveClass('ps-4');
  });

  it('gives text parts their own direction and leaves lists and items to the page', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'item.link')[0]).toHaveAttribute('dir', 'auto');
    expect(partsNamed(container, 'items')[0]).not.toHaveAttribute('dir');
    expect(partsNamed(container, 'item')[0]).not.toHaveAttribute('dir');
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

  it('keeps the hover title as a plain-string copy and drops it while the label is edited', () => {
    const plain = renderBlock({}, true);
    expect(partsNamed(plain.container, 'item.link')[0]).toHaveAttribute('title', 'Home');
    plain.unmount();
    const editing = renderBlock({}, true, ['items.0.label']);
    expect(partsNamed(editing.container, 'item.link')[0]).not.toHaveAttribute('title');
    expect(partsNamed(editing.container, 'item.link')[2]).toHaveAttribute('aria-current', 'page');
  });
});
