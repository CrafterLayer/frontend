import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { parsePropPath, setAtPropPath, type Node } from '@craftkit/builder-schema';

import { Pagination } from './Pagination';
import { paginationSchema, type PaginationProps } from './schema';

/*
  Block parts (DESIGN §4.3): the Previous and Next labels, the page word and, in explicit mode, each page and its link.
  Each part is addressable on the canvas with its instance index and bind,
  carries nothing extra when published,
  takes classes and direction from `partStyles` (a this-item entry beating
  the all-items one), and renders an inline editor swapped in at its bind
  exactly where the text was.
*/
const node: Node = { id: 'pagination-parts', type: 'pagination', props: {} };

const FULL = {
  mode: 'explicit',
  previousHref: '/new',
  nextHref: '/archive',
  items: [
    { label: 'New', href: '/new' },
    { label: 'Popular', current: true },
    { label: 'Archive', href: '/archive' },
  ],
};

/* The binds each part shows, in document order, for FULL. */
const EXPECTED_BINDS: Readonly<Record<string, readonly string[]>> = {
  previousLabel: ['previousLabel'],
  nextLabel: ['nextLabel'],
  pageLabel: ['pageLabel'],
  items: ['items'],
  item: ['items.0', 'items.1', 'items.2'],
  'item.link': ['items.0.label', 'items.1.label', 'items.2.label'],
};

/* Every text bind FULL fills. */
const SWAP_PATHS: readonly string[] = [
  'previousLabel',
  'nextLabel',
  'pageLabel',
  'items.0.label',
  'items.1.label',
  'items.2.label',
];

function renderBlock(
  overrides: Record<string, unknown>,
  isCanvas: boolean,
  swapPaths: readonly string[] = [],
) {
  let props: PaginationProps = paginationSchema.props.parse({ ...FULL, ...overrides });
  for (const path of swapPaths) {
    props = setAtPropPath(props, parsePropPath(path), <span data-swap={path} />);
  }
  return render(<Pagination node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.getAttribute('data-ck-part') === name,
  );
}

describe('Pagination parts', () => {
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
          previousLabel: { className: 'pe-2', dir: 'ltr' },
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
    const top = partsNamed(container, 'previousLabel')[0];
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

  it('names generated page links by the page word and number, even while the word is edited', () => {
    const plain = renderBlock({ mode: 'generated', currentPage: 2, pageCount: 3, items: [] }, true);
    expect(plain.getByRole('link', { name: 'Page 3' })).toHaveAttribute('href', '?page=3');
    expect(plain.getByLabelText('Page 2')).toHaveAttribute('aria-current', 'page');
    plain.unmount();
    const editing = renderBlock(
      { mode: 'generated', currentPage: 2, pageCount: 3, items: [] },
      true,
      ['pageLabel'],
    );
    expect(editing.container.innerHTML).not.toContain('[object Object]');
    expect(editing.container.querySelectorAll('[data-swap="pageLabel"]')).toHaveLength(1);
  });

  it('shows the page word as its own part in the compact layout', () => {
    const { container } = renderBlock(
      { mode: 'generated', variant: 'compact', currentPage: 2, pageCount: 9, items: [] },
      true,
    );
    const word = partsNamed(container, 'pageLabel');
    expect(word).toHaveLength(1);
    expect(word[0]).not.toHaveAttribute('hidden');
    expect(word[0]?.closest('[aria-live]')).toHaveTextContent(/^Page 2 \/ 9$/);
  });
});
