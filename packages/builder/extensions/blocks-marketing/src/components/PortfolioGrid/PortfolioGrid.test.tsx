import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { PortfolioGrid } from './PortfolioGrid';
import { portfolioGridSchema } from './schema';

const node: Node = { id: 'portfolio', type: 'portfolioGrid', props: {} };

const items = [
  {
    category: 'Fintech',
    title: 'A clearer finance workspace',
    summary: 'A dependable operating view for growing finance teams.',
    imageSrc: '/finance.jpg',
    imageAlt: 'Finance dashboard with cash flow forecasts',
    href: '/work/finance',
    metrics: [
      { label: 'Faster reporting', value: '4.2×' },
      { label: 'Adoption', value: '86%' },
    ],
  },
  {
    category: 'Commerce',
    title: 'A storefront built for repeat customers',
    summary: 'Editorial storytelling meets a frictionless purchase path.',
    href: '/work/commerce',
    metrics: [],
  },
];

function renderPortfolio(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <PortfolioGrid
      node={node}
      props={portfolioGridSchema.props.parse({
        heading: 'Selected work',
        items,
        ...overrides,
      })}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

describe('PortfolioGrid', () => {
  it('renders semantic case cards, lazy media, metrics, and labelled links', () => {
    renderPortfolio({ eyebrow: 'Portfolio', body: 'Outcomes from recent partnerships.' });

    expect(screen.getByRole('region', { name: 'Selected work' })).toHaveClass('@container');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(
      screen.getByRole('img', { name: 'Finance dashboard with cash flow forecasts' }),
    ).toHaveAttribute('loading', 'lazy');
    expect(screen.getByText('4.2×')).toBeInTheDocument();
    expect(screen.getByText('Faster reporting')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View case study A clearer finance workspace' }),
    ).toHaveAttribute('href', '/work/finance');
    expect(screen.getByText('A clearer finance workspace').closest('article')).toHaveClass(
      'rounded-xl',
      'shadow-soft',
      'motion-reduce:transition-none',
    );
  });

  it('uses one-column editorial cards and can hide metrics without deleting their data', () => {
    renderPortfolio({ variant: 'editorial', columns: '2', showMetrics: false });

    expect(screen.getByRole('list')).toHaveClass('grid-cols-1');
    expect(screen.getAllByRole('article')[0]).toHaveClass('grid', '@lg:grid-cols-5');
    expect(screen.queryByText('4.2×')).not.toBeInTheDocument();
    expect(screen.getByText('A clearer finance workspace')).toBeInTheDocument();
  });

  it('uses a decorative initial when a project has no image', () => {
    renderPortfolio();
    expect(screen.getByText('A clearer finance workspace')).toBeInTheDocument();
    expect(screen.getByText('A', { selector: '[aria-hidden="true"]' })).toBeInTheDocument();
  });

  it('renders a professional empty state on canvas only', () => {
    const { rerender } = renderPortfolio({ items: [] }, true);
    expect(screen.getByText('Add case studies to showcase your strongest outcomes.')).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    rerender(
      <PortfolioGrid
        node={node}
        props={portfolioGridSchema.props.parse({ heading: 'Selected work', items: [] })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(
      screen.queryByText('Add case studies to showcase your strongest outcomes.'),
    ).not.toBeInTheDocument();
  });

  it('preserves case-study anchors but prevents navigation on the builder canvas', () => {
    renderPortfolio({}, true);
    const action = screen.getByRole('link', {
      name: 'View case study A clearer finance workspace',
    });
    expect(action).toHaveAttribute('href', '/work/finance');
    expect(fireEvent.click(action)).toBe(false);
  });

  it('combines shared token colour, typography, and logical spacing on the section', () => {
    renderPortfolio({ background: 'surfaceInverse', fontFamily: 'serif', paddingInlineStart: 4 });
    const section = screen.getByRole('region', { name: 'Selected work' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.paddingInlineStart).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });

  it('rejects unsafe links and bounded content while exposing every prop to the inspector', () => {
    const defaults = portfolioGridSchema.props.parse({});
    expect(defaults).toMatchObject({
      actionLabel: 'View case study',
      columns: '3',
      heading: 'Selected work',
      items: [],
      showMetrics: true,
      spacing: 'lg',
      variant: 'grid',
      width: 'wide',
    });
    expect(Object.keys(portfolioGridSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(portfolioGridSchema.props.shape).sort(),
    );
    expect(
      portfolioGridSchema.props.safeParse({
        items: [
          {
            category: 'Unsafe',
            title: 'Unsafe link',
            summary: 'This URL must be rejected.',
            href: 'javascript:alert(1)',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      portfolioGridSchema.props.safeParse({
        items: [
          {
            category: 'Unsafe',
            title: 'Backslash link',
            summary: 'This URL must be rejected.',
            href: '/\\evil.example/work',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      portfolioGridSchema.props.safeParse({
        items: [
          {
            category: 'Unsafe',
            title: 'Executable image',
            summary: 'This media URL must be rejected.',
            imageSrc: 'javascript:alert(1)',
            href: '/work',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      portfolioGridSchema.props.safeParse({
        items: [
          {
            category: 'Unsafe',
            title: 'Protocol-relative image',
            summary: 'This media URL must be rejected.',
            imageSrc: '//evil.example/work.jpg',
            href: '/work',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      portfolioGridSchema.props.safeParse({
        items: [
          {
            category: 'Unsafe',
            title: 'Backslash image',
            summary: 'This media URL must be rejected.',
            imageSrc: '/\\evil.example/work.jpg',
            href: '/work',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      portfolioGridSchema.props.safeParse({
        items: [
          {
            category: 'Unsafe',
            title: 'Protocol-relative link',
            summary: 'This URL must be rejected.',
            href: '//evil.example/work',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      portfolioGridSchema.props.safeParse({
        items: Array.from({ length: 13 }, (_, index) => ({
          category: 'Work',
          title: `Project ${String(index)}`,
          summary: 'A bounded project summary.',
          href: `/work/${String(index)}`,
        })),
      }).success,
    ).toBe(false);
  });
});
