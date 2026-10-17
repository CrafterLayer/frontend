import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { ReviewSummary } from './ReviewSummary';
import { reviewSummaryExamples } from './examples';
import { reviewSummarySchema } from './schema';

const node: Node = { id: 'reviews', type: 'reviewSummary', props: {} };

function renderSummary(overrides: Record<string, unknown> = {}) {
  return render(
    <ReviewSummary
      node={node}
      props={reviewSummarySchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('ReviewSummary', () => {
  it('names the average once, as the stars image, and prints the total line', () => {
    const { container } = renderSummary();
    expect(screen.getByRole('region', { name: 'What our customers say' })).toHaveClass(
      '@container',
    );
    expect(screen.getByRole('img', { name: '4.7 out of 5 stars' })).toBeInTheDocument();
    expect(container.querySelector('[data-review-summary-average]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByText('Based on 1,248 reviews')).toBeInTheDocument();
    const fills = [...container.querySelectorAll('[data-review-summary-card] [data-star-fill]')];
    expect(fills.map((star) => star.getAttribute('data-star-fill'))).toEqual([
      '1.0',
      '1.0',
      '1.0',
      '1.0',
      '0.7',
    ]);
    expect(fills[0]).toHaveClass('rtl:-scale-x-100');
  });

  it('draws one bar per star level from the counts, with the share in words beside it', () => {
    const { container } = renderSummary({
      breakdown: [
        { label: '5 stars', count: 75 },
        { label: '1 star', count: 25 },
      ],
    });
    const rows = within(container.querySelector('[data-review-summary-card] ul')!).getAllByRole(
      'listitem',
    );
    expect(rows[0]).toHaveTextContent('5 stars75%');
    expect(rows[1]).toHaveTextContent('1 star25%');
    const bars = container.querySelectorAll<HTMLElement>('[data-review-summary-bar]');
    expect(bars[0]?.style.inlineSize).toBe('75%');
    expect(bars[0]?.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('prints Arabic-Indic digits and an Arabic star name on an Arabic page', () => {
    renderSummary({ average: 4.6, numberLanguage: 'ar', ratingLabel: '{rating} من ٥ نجوم' });
    expect(screen.getByRole('img', { name: '٤٫٦ من ٥ نجوم' })).toBeInTheDocument();
    expect(screen.getByText(/^٧٩/u)).toHaveClass('tabular-nums');
  });

  it('lists the reviews as figures with their own rating and attribution', () => {
    renderSummary();
    const reviews = screen.getAllByRole('figure');
    expect(reviews).toHaveLength(3);
    expect(within(reviews[2]!).getByRole('img', { name: '4 out of 5 stars' })).toBeInTheDocument();
    expect(within(reviews[0]!).getByText('Hana M.')).toHaveClass('font-semibold');
    expect(within(reviews[0]!).getByText('Verified customer')).toHaveClass('text-text-muted');
  });

  it('shows the action only with both a label and a link, and survives no reviews', () => {
    const { unmount } = renderSummary({ actionLabel: 'Read all reviews' });
    expect(screen.queryByRole('link')).toBeNull();
    unmount();
    const { container } = renderSummary({
      reviews: [],
      breakdown: [],
      actionLabel: 'Read all reviews',
      actionHref: '/reviews',
    });
    expect(screen.getByRole('link', { name: 'Read all reviews' })).toHaveAttribute(
      'href',
      '/reviews',
    );
    expect(container.querySelectorAll('figure')).toHaveLength(0);
  });

  it('keeps the card light with its own ink on a dark section', () => {
    const { container } = renderSummary({ tone: 'dark' });
    expect(container.querySelector('[data-review-summary-card]')).toHaveClass(
      'bg-surface',
      'text-text',
    );
    expect(screen.getByText('Riyadh')).toHaveClass('opacity-80');
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    renderSummary({ background: 'accent', fontFamily: 'serif', marginInlineEnd: 4 });
    const section = screen.getByRole('region', { name: 'What our customers say' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('ReviewSummary schema', () => {
  it('defaults to a believable summary and maps every inspector prop', () => {
    const defaults = reviewSummarySchema.props.parse({});
    expect(defaults.breakdown).toHaveLength(5);
    expect(defaults.reviews).toHaveLength(3);
    expect(defaults).toMatchObject({ average: 4.7, numberLanguage: 'en', width: 'wide' });
    expect(Object.keys(reviewSummarySchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(reviewSummarySchema.props.shape).sort(),
    );
  });

  it('bounds the average, the levels, the reviews and their ratings', () => {
    const parse = (value: unknown) => reviewSummarySchema.props.safeParse(value).success;
    expect(parse({ average: 5.1 })).toBe(false);
    expect(parse({ average: -1 })).toBe(false);
    expect(parse({ breakdown: Array.from({ length: 6 }, () => ({ label: 'x', count: 1 })) })).toBe(
      false,
    );
    expect(parse({ breakdown: [{ label: 'x', count: 1.5 }] })).toBe(false);
    expect(parse({ reviews: [{ quote: 'q', author: 'a', rating: 6 }] })).toBe(false);
    expect(parse({ actionHref: 'javascript:alert(1)' })).toBe(false);
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of reviewSummaryExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('reviewSummary');
      expect(reviewSummarySchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(
        true,
      );
    }
    expect(reviewSummaryExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
