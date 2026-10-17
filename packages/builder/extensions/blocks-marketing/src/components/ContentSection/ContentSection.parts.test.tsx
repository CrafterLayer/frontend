import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { parsePropPath, setAtPropPath, type Node } from '@craftkit/builder-schema';

import { ContentSection } from './ContentSection';
import { contentSectionSchema, type ContentSectionProps } from './schema';

/*
  Block parts (DESIGN §4.3): the copy, each highlight and its lines, the action link, the image and its caption.
  Each part is addressable on the canvas with its instance index and bind,
  carries nothing extra when published,
  takes classes and direction from `partStyles` (a this-item entry beating
  the all-items one), and renders an inline editor swapped in at its bind
  exactly where the text was.
*/
const node: Node = { id: 'content-parts', type: 'content-section', props: {} };

const FULL = {
  eyebrow: 'Story',
  heading: 'A clearer way forward.',
  body: 'Tell the story behind the work.',
  highlights: [
    { title: 'Faster', body: 'Pages ship in days.' },
    { title: 'Safer', body: 'Every edit is undoable.' },
  ],
  imageSrc: '/images/story.jpg',
  imageAlt: 'The team at work',
  caption: 'Our studio.',
  link: { label: 'Read the story', href: '/story' },
};

/* The binds each part shows, in document order, for FULL. */
const EXPECTED_BINDS: Readonly<Record<string, readonly string[]>> = {
  eyebrow: ['eyebrow'],
  heading: ['heading'],
  body: ['body'],
  highlights: ['highlights'],
  highlight: ['highlights.0', 'highlights.1'],
  'highlight.title': ['highlights.0.title', 'highlights.1.title'],
  'highlight.body': ['highlights.0.body', 'highlights.1.body'],
  link: ['link.label'],
  image: ['imageSrc'],
  caption: ['caption'],
};

/* Every text bind FULL fills. */
const SWAP_PATHS: readonly string[] = [
  'eyebrow',
  'heading',
  'body',
  'highlights.0.title',
  'highlights.1.title',
  'highlights.0.body',
  'highlights.1.body',
  'link.label',
  'caption',
];

function renderBlock(
  overrides: Record<string, unknown>,
  isCanvas: boolean,
  swapPaths: readonly string[] = [],
) {
  let props: ContentSectionProps = contentSectionSchema.props.parse({ ...FULL, ...overrides });
  for (const path of swapPaths) {
    props = setAtPropPath(props, parsePropPath(path), <span data-swap={path} />);
  }
  return render(
    <ContentSection node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />,
  );
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.getAttribute('data-ck-part') === name,
  );
}

describe('ContentSection parts', () => {
  it('stamps each part instance with its index and bind on the canvas', () => {
    const { container } = renderBlock({}, true);
    for (const [name, binds] of Object.entries(EXPECTED_BINDS)) {
      const found = partsNamed(container, name);
      expect(
        found.map((element) => element.getAttribute('data-ck-bind')),
        name,
      ).toEqual(binds);
    }
    const items = partsNamed(container, 'highlight');
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
          'highlight.title': { className: 'ps-4' },
          'highlight.title@1': { className: 'ps-8', dir: 'rtl' },
          heading: { className: 'pe-2', dir: 'ltr' },
        },
      },
      true,
    );
    const styled = partsNamed(container, 'highlight.title');
    expect(styled[0]).toHaveClass('ps-4');
    expect(styled[0]).toHaveAttribute('dir', 'auto');
    expect(styled[1]).toHaveClass('ps-8');
    expect(styled[1]).not.toHaveClass('ps-4');
    expect(styled[1]).toHaveAttribute('dir', 'rtl');
    const top = partsNamed(container, 'heading')[0];
    expect(top).toHaveClass('pe-2');
    expect(top).toHaveAttribute('dir', 'ltr');
    expect(partsNamed(container, 'highlight.body')[0]).not.toHaveClass('ps-4');
  });

  it('gives text parts their own direction and leaves lists and items to the page', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'highlight.title')[0]).toHaveAttribute('dir', 'auto');
    expect(partsNamed(container, 'highlights')[0]).not.toHaveAttribute('dir');
    expect(partsNamed(container, 'highlight')[0]).not.toHaveAttribute('dir');
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

  it('keeps the link destination and the image alt text on their elements', () => {
    const { container } = renderBlock({}, true);
    const link = container.querySelector('[data-ck-part="link"]');
    expect(link?.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/story');
    expect(link).toHaveAttribute('dir', 'auto');
    const image = container.querySelector('[data-ck-part="image"]');
    expect(image?.tagName).toBe('IMG');
    expect(image).toHaveAttribute('alt', 'The team at work');
    expect(image).not.toHaveAttribute('dir');
  });
});
