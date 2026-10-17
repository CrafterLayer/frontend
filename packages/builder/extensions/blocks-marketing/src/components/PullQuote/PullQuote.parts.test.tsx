import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { PullQuote } from './PullQuote';
import { pullQuoteSchema, type PullQuoteProps } from './schema';

/*
  Block parts (DESIGN §4.3): the quote, the speaker, the role, the source and
  the portrait are addressable on the canvas, carry nothing extra when
  published, take classes and direction from `partStyles`, and render an
  inline editor swapped in at its bind exactly once.
*/
const node: Node = { id: 'quote-parts', type: 'pullQuote', props: {} };
const FULL = {
  author: 'Lina Haddad',
  role: 'Founder',
  source: 'The Daily',
  sourceHref: 'https://example.com/a',
  imageSrc: '/assets/lina.jpg',
  imageAlt: 'Lina Haddad',
};

type Swap = (props: PullQuoteProps) => PullQuoteProps;

function renderBlock(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = pullQuoteSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<PullQuote node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('PullQuote parts', () => {
  it('stamps the quote, the attribution and the portrait on the canvas', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'quote')[0]).toHaveAttribute('data-ck-bind', 'quote');
    expect(partsNamed(container, 'author')[0]).toHaveAttribute('data-ck-bind', 'author');
    expect(partsNamed(container, 'role')[0]).toHaveAttribute('data-ck-bind', 'role');
    expect(partsNamed(container, 'source')[0]?.tagName).toBe('A');
    expect(partsNamed(container, 'source')[0]).toHaveAttribute('data-ck-bind', 'source');
    expect(partsNamed(container, 'image')[0]).toHaveAttribute('data-ck-bind', 'imageSrc');
  });

  it('publishes no part markers', () => {
    const { container } = renderBlock({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('applies a part style and its direction', () => {
    const { container } = renderBlock(
      { partStyles: { quote: { className: 'italic', dir: 'ltr' } } },
      true,
    );
    expect(partsNamed(container, 'quote')[0]).toHaveClass('italic', 'font-semibold');
    expect(partsNamed(container, 'quote')[0]).toHaveAttribute('dir', 'ltr');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderBlock({}, true, (props) => ({
      ...props,
      quote: swapped('quote'),
      author: swapped('author'),
      role: swapped('role'),
      source: swapped('source'),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of ['quote', 'author', 'role', 'source']) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
