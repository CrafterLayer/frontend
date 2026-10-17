import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { ReviewSummary } from './ReviewSummary';
import { reviewSummarySchema, type ReviewSummaryProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, the total line, every star
  level's label, every review and its words, and the action are addressable
  on the canvas, carry nothing extra when published, take classes from
  `partStyles`, and render an inline editor at its bind exactly once.
*/
const node: Node = { id: 'reviews-parts', type: 'reviewSummary', props: {} };
const FULL = {
  eyebrow: 'Reviews',
  body: 'Real customers.',
  actionLabel: 'Read all',
  actionHref: '/reviews',
};

type Swap = (props: ReviewSummaryProps) => ReviewSummaryProps;

function renderBlock(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = reviewSummarySchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(
    <ReviewSummary node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />,
  );
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('ReviewSummary parts', () => {
  it('stamps the total, every level label, every review and its words, and the action', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'totalLabel')[0]).toHaveAttribute('data-ck-bind', 'totalLabel');
    expect(
      partsNamed(container, 'breakdown.label').map((label) => label.dataset['ckBind']),
    ).toEqual([0, 1, 2, 3, 4].map((index) => `breakdown.${String(index)}.label`));
    expect(partsNamed(container, 'review')[2]).toHaveAttribute('data-ck-bind', 'reviews.2');
    expect(partsNamed(container, 'review.quote')[0]).toHaveAttribute(
      'data-ck-bind',
      'reviews.0.quote',
    );
    expect(partsNamed(container, 'review.meta')).toHaveLength(2);
    expect(partsNamed(container, 'action')[0]?.tagName).toBe('A');
  });

  it('publishes no part markers', () => {
    const { container } = renderBlock({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('applies an all-items style and a this-item style, this winning', () => {
    const { container } = renderBlock(
      {
        partStyles: {
          'review.author': { className: 'text-accent' },
          'review.author@1': { className: 'text-inherit', dir: 'ltr' },
        },
      },
      true,
    );
    const authors = partsNamed(container, 'review.author');
    expect(authors[0]).toHaveClass('text-accent');
    expect(authors[1]).toHaveClass('text-inherit');
    expect(authors[1]).toHaveAttribute('dir', 'ltr');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderBlock({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      totalLabel: swapped('totalLabel'),
      breakdown: props.breakdown.map((row, index) => ({
        ...row,
        label: swapped(`breakdown.${String(index)}.label`),
      })),
      reviews: props.reviews.map((review, index) => ({
        ...review,
        quote: swapped(`reviews.${String(index)}.quote`),
        author: swapped(`reviews.${String(index)}.author`),
      })),
      actionLabel: swapped('actionLabel'),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'totalLabel',
      'breakdown.4.label',
      'reviews.1.quote',
      'reviews.2.author',
      'actionLabel',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
