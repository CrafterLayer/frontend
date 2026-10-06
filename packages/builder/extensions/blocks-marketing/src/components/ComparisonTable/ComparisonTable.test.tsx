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
    expect(screen.getByText('Popular')).toBeInTheDocument();
    expect(screen.getByText('/ month')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start free Growth' })).toHaveAttribute(
      'href',
      '/signup/growth',
    );
    expect(screen.getByText('—')).toBeInTheDocument();
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
      featureLabel: 'Features',
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
