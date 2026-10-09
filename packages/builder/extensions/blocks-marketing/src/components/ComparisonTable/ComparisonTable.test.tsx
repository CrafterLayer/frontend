import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { ComparisonTable } from './ComparisonTable';
import { comparisonTableSchema } from './schema';

const node: Node = { id: 'comparison', type: 'comparisonTable', props: {} };

const plans = [
  {
    name: 'Starter',
    description: 'For small teams',
    price: '$19',
    period: '/ month',
    actionLabel: 'Start free',
    actionHref: '/signup/starter',
  },
  {
    name: 'Growth',
    badge: 'Popular',
    price: '$49',
    actionLabel: 'Start free',
    actionHref: '/signup/growth',
    featured: true,
  },
];

const rows = [
  { feature: 'Projects', values: ['3', 'Unlimited'] },
  { feature: 'Priority support', values: ['Community'], highlight: true },
];

function renderComparison(overrides: Record<string, unknown> = {}) {
  return render(
    <ComparisonTable
      node={node}
      props={comparisonTableSchema.props.parse({
        heading: 'Compare plans',
        plans,
        rows,
        ...overrides,
      })}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('ComparisonTable', () => {
  it('renders semantic headers, featured plan details, values, and labelled actions', () => {
    renderComparison({ eyebrow: 'Pricing', body: 'Pick the right fit.', note: 'Cancel anytime.' });

    expect(screen.getByRole('region', { name: 'Compare plans' })).toHaveClass('@container');
    const table = screen.getByRole('table', { name: 'Compare plans' });
    expect(table).toHaveClass('rounded-xl', 'shadow-elevated');
    expect(within(table).getByRole('columnheader', { name: /Starter/ })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Projects' })).toBeInTheDocument();
    expect(within(table).getByText('Popular')).toBeInTheDocument();
    expect(within(table).getByText('/ month')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Start free Growth' })).toHaveAttribute(
      'href',
      '/signup/growth',
    );
    expect(within(table).getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Cancel anytime.')).toBeInTheDocument();
    expect(screen.getByLabelText('Scrollable plan comparison')).toHaveAttribute('tabindex', '0');
  });

  it.each(['boxed', 'minimal', 'contrast'] as const)(
    'renders the %s visual treatment',
    (variant) => {
      renderComparison({ variant, showActions: variant !== 'minimal' });
      const table = screen.getByRole('table');
      expect(table).toHaveClass(
        variant === 'boxed'
          ? 'border-separate'
          : variant === 'minimal'
            ? 'border-collapse'
            : 'bg-surface-inverse',
      );
      if (variant === 'minimal') expect(screen.queryByRole('link')).not.toBeInTheDocument();
      if (variant === 'contrast') expect(table).toHaveClass('mkt-slab');
    },
  );

  it('combines token-based colour, typography, and logical spacing controls', () => {
    renderComparison({ background: 'accent', fontFamily: 'serif', marginInlineEnd: 4 });
    const section = screen.getByRole('region', { name: 'Compare plans' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });

  it('bounds plans and rows, rejects unsafe actions, and maps every inspector prop', () => {
    const defaults = comparisonTableSchema.props.parse({});
    expect(defaults).toMatchObject({
      emptyValue: '—',
      excludedLabel: 'Not included',
      featureLabel: 'Features',
      includedLabel: 'Included',
      heading: 'Compare plans',
      plans: [],
      rows: [],
      showActions: true,
      spacing: 'lg',
      variant: 'boxed',
      width: 'wide',
    });
    expect(Object.keys(comparisonTableSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(comparisonTableSchema.props.shape).sort(),
    );
    expect(
      comparisonTableSchema.props.safeParse({
        plans: [{ name: 'Unsafe', actionLabel: 'Open', actionHref: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
    expect(
      comparisonTableSchema.props.safeParse({
        plans: Array.from({ length: 5 }, (_, index) => ({ name: `Plan ${String(index)}` })),
      }).success,
    ).toBe(false);
    expect(
      comparisonTableSchema.props.safeParse({
        rows: Array.from({ length: 17 }, (_, index) => ({
          feature: `Feature ${String(index)}`,
        })),
      }).success,
    ).toBe(false);
  });
});

// blocks-polish additions (2026-10-08): the phone layout and glyph alternatives.
describe('ComparisonTable below a 640px container', () => {
  it('renders one stacked card per plan beside the table, each layout in its own container class', () => {
    const { container } = renderComparison();
    const scroll = container.querySelector('[data-comparison-scroll]');
    const cards = container.querySelector('[data-comparison-cards]');
    /* section-layout.css swaps the two at 40rem; neither hides behind aria-hidden. */
    expect(scroll).toHaveClass('mkt-compare__table');
    expect(cards).toHaveClass('mkt-compare__cards');
    expect(cards?.closest('[aria-hidden]')).toBeNull();
    expect(scroll?.closest('[aria-hidden]')).toBeNull();
    expect(within(cards as HTMLElement).getAllByRole('listitem')).toHaveLength(2);
  });

  it('gives each card its name, price, rows as label and value, and its action', () => {
    const { container } = renderComparison();
    const cards = within(container.querySelector<HTMLElement>('[data-comparison-cards]')!);
    const growth = cards.getByRole('heading', { level: 3, name: 'Growth' }).closest('li') as HTMLElement;
    expect(growth).toHaveAttribute('data-comparison-card', 'featured');
    expect(within(growth).getByText('$49')).toBeInTheDocument();
    expect(within(growth).getByText('Popular')).toBeInTheDocument();
    const terms = within(growth).getAllByRole('term').map((term) => term.textContent);
    const values = within(growth).getAllByRole('definition').map((value) => value.textContent);
    expect(terms).toEqual(['Projects', 'Priority support']);
    /* The missing value shows the empty text, read out as "Not included". */
    expect(values).toEqual(['Unlimited', '—']);
    expect(within(growth).getByRole('img', { name: 'Not included' })).toHaveTextContent('—');
    expect(within(growth).getByRole('link', { name: 'Start free Growth' })).toHaveAttribute(
      'href',
      '/signup/growth',
    );
    const starter = cards.getByRole('heading', { level: 3, name: 'Starter' }).closest('li') as HTMLElement;
    expect(within(starter).getByText('/ month')).toBeInTheDocument();
    expect(within(starter).getByRole('link', { name: 'Start free Starter' })).toBeInTheDocument();
  });

  it('pairs a check or a cross with words in both layouts, in the language the page sets', () => {
    const { container } = renderComparison({
      rows: [{ feature: 'Custom domain', values: ['✗', '✓'] }],
      includedLabel: 'مشمول',
      excludedLabel: 'غير مشمول',
    });
    const table = screen.getByRole('table');
    expect(within(table).getByRole('img', { name: 'مشمول' })).toHaveTextContent('✓');
    expect(within(table).getByRole('img', { name: 'غير مشمول' })).toHaveTextContent('✗');
    const cards = container.querySelector<HTMLElement>('[data-comparison-cards]')!;
    expect(within(cards).getAllByRole('img', { name: 'مشمول' })).toHaveLength(1);
    expect(within(cards).getAllByRole('img', { name: 'غير مشمول' })).toHaveLength(1);
    /* The words live in the glyph's name, never as a second text node in the cell. */
    expect(table.textContent).not.toContain('مشمول');
  });

  it('keeps an ordinary value as plain text and the contrast cards on a slab', () => {
    const { container } = renderComparison({ variant: 'contrast' });
    const cards = container.querySelector<HTMLElement>('[data-comparison-cards]')!;
    for (const card of within(cards).getAllByRole('listitem')) expect(card).toHaveClass('mkt-slab');
    expect(within(cards).getAllByText('Unlimited')[0]?.children).toHaveLength(0);
  });

  it('renders no cards when there are no plans', () => {
    const { container } = renderComparison({ plans: [] });
    expect(container.querySelector('[data-comparison-cards]')).toBeNull();
  });
});
