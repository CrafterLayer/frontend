import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { parsePropPath, setAtPropPath, type Node } from '@craftkit/builder-schema';

import { Faq } from './Faq';
import { faqSchema, type FaqProps } from './schema';

/*
  Block parts (DESIGN §4.3): the intro, the question list, each question and its text and answer.
  Each part is addressable on the canvas with its instance index and bind,
  carries nothing extra when published,
  takes classes and direction from `partStyles` (a this-item entry beating
  the all-items one), and renders an inline editor swapped in at its bind
  exactly where the text was.
*/
const node: Node = { id: 'faq-parts', type: 'faq', props: {} };

const FULL = {
  eyebrow: 'Support',
  heading: 'Frequently asked questions.',
  body: 'Everything about the builder.',
  items: [
    { question: 'Can I edit in place?', answer: 'Yes, every line.' },
    { question: 'Is Arabic supported?', answer: 'Right to left, first class.' },
  ],
};

/* The binds each part shows, in document order, for FULL. */
const EXPECTED_BINDS: Readonly<Record<string, readonly string[]>> = {
  eyebrow: ['eyebrow'],
  heading: ['heading'],
  body: ['body'],
  items: ['items'],
  item: ['items.0', 'items.1'],
  'item.question': ['items.0.question', 'items.1.question'],
  'item.answer': ['items.0.answer', 'items.1.answer'],
};

/* Every text bind FULL fills. */
const SWAP_PATHS: readonly string[] = [
  'eyebrow',
  'heading',
  'body',
  'items.0.question',
  'items.1.question',
  'items.0.answer',
  'items.1.answer',
];

function renderBlock(
  overrides: Record<string, unknown>,
  isCanvas: boolean,
  swapPaths: readonly string[] = [],
) {
  let props: FaqProps = faqSchema.props.parse({ ...FULL, ...overrides });
  for (const path of swapPaths) {
    props = setAtPropPath(props, parsePropPath(path), <span data-swap={path} />);
  }
  return render(<Faq node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.getAttribute('data-ck-part') === name,
  );
}

describe('Faq parts', () => {
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
          'item.question': { className: 'ps-4' },
          'item.question@1': { className: 'ps-8', dir: 'rtl' },
          heading: { className: 'pe-2', dir: 'ltr' },
        },
      },
      true,
    );
    const styled = partsNamed(container, 'item.question');
    expect(styled[0]).toHaveClass('ps-4');
    expect(styled[0]).toHaveAttribute('dir', 'auto');
    expect(styled[1]).toHaveClass('ps-8');
    expect(styled[1]).not.toHaveClass('ps-4');
    expect(styled[1]).toHaveAttribute('dir', 'rtl');
    const top = partsNamed(container, 'heading')[0];
    expect(top).toHaveClass('pe-2');
    expect(top).toHaveAttribute('dir', 'ltr');
    expect(partsNamed(container, 'item.answer')[0]).not.toHaveClass('ps-4');
  });

  it('gives text parts their own direction and leaves lists and items to the page', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'item.question')[0]).toHaveAttribute('dir', 'auto');
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
});
