import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { advancedChartTypes } from '../advanced-contract';
import { AdvancedChart } from './AdvancedChart';
import { exampleDrawing } from './fixtures';

describe('AdvancedChart', () => {
  it('exports every advanced family as standalone SVG markup without a client runtime', () => {
    for (const kind of advancedChartTypes) {
      const html = renderToStaticMarkup(<AdvancedChart drawing={exampleDrawing(kind)} />);
      expect(html).toContain(`data-chart-plot="${kind}"`);
      expect(html).toContain('<svg');
      expect(html).toContain('role="img"');
      expect(html).not.toMatch(/<script|<iframe|NaN|Infinity/iu);
    }
  });
  it.each(advancedChartTypes)(
    'renders %s as its requested SVG family without executable content',
    (kind) => {
      const drawing = exampleDrawing(kind);
      const { container } = render(<AdvancedChart drawing={drawing} />);
      expect(screen.getByRole('img', { name: drawing.props.title ?? '' })).toBeInTheDocument();
      expect(container.querySelector('[data-chart-plot]')).toHaveAttribute('data-chart-plot', kind);
      expect(container.querySelectorAll('[data-chart-mark]').length).toBeGreaterThan(0);
      expect(container.innerHTML).not.toMatch(
        /NaN|Infinity|#[0-9a-f]{3,8}\b|rgb\(|<script|<iframe/iu,
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(container.querySelector('svg')).toHaveClass('rtl:-scale-x-100');
    },
  );

  it('shows signed waterfall increments and their running totals in the actual marks', () => {
    const { container } = render(<AdvancedChart drawing={exampleDrawing('waterfall')} />);
    const marks = [...container.querySelectorAll('[data-chart-mark="waterfall"] title')].map(
      (node) => node.textContent,
    );
    expect(marks[0]).toContain('Change: $50,000 · Running total: $50,000');
    expect(marks[2]).toContain('Change: $⁦−28,000⁩ · Running total: $64,000');
    expect(container.querySelectorAll('[data-chart-mark="connector"]')).toHaveLength(4);
  });

  it('keeps bubble area proportional to Size, with independent X/Y/Size units', () => {
    const drawing = exampleDrawing('bubble', {
      categories: ['1', '2', '3'],
      series: [
        { name: 'Revenue', values: [100, 200, 300] },
        { name: 'People', values: [1, 4, 0] },
      ],
    });
    const { container } = render(<AdvancedChart drawing={drawing} />);
    const marks = container.querySelectorAll('[data-chart-mark="bubble"]');
    expect(marks[0]).toHaveAttribute('stroke-width', '20');
    expect(marks[1]).toHaveAttribute('stroke-width', '40');
    expect(marks[2]).toHaveAttribute('stroke-width', '0');
    expect(marks[0]?.querySelector('title')).toHaveTextContent('X: 1 · Y: $100 · Size: 1');
    expect(marks[0]?.querySelector('title')?.textContent).not.toContain('Size: $');
  });

  it('renders body fill and printed OHLC roles so candlestick direction is not color-only', () => {
    const { container } = render(<AdvancedChart drawing={exampleDrawing('candlestick')} />);
    const bodies = container.querySelectorAll('[data-chart-mark="candle"]');
    expect(bodies[0]).toHaveClass('fill-none');
    expect(bodies[1]).not.toHaveClass('fill-none');
    expect(screen.getByText(/Hollow: close ≥ open/u)).toBeInTheDocument();
    expect(bodies[0]?.querySelector('title')).toHaveTextContent(
      'Open: $100 · High: $112 · Low: $96 · Close: $108',
    );
  });

  it('prints heatmap endpoints and every row label, preserving the matrix values', () => {
    const { container } = render(<AdvancedChart drawing={exampleDrawing('heatmap')} />);
    expect(container.querySelector('[data-chart-scale]')).toHaveTextContent('4 — 21');
    expect(container.querySelectorAll('[data-chart-mark="cell"]')).toHaveLength(12);
    expect(container.querySelector('[data-chart-rows]')).toHaveTextContent('التصميمالتطويرالجودة');
  });

  it('retains zero treemap weights in the key but never gives them an invented area', () => {
    const { container } = render(
      <AdvancedChart
        drawing={exampleDrawing('treemap', {
          categories: ['Active', 'Empty'],
          series: [{ name: 'Weight', values: [5, 0] }],
        })}
      />,
    );
    expect(container.querySelectorAll('[data-chart-mark="tile"]')).toHaveLength(1);
    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(screen.getByText('Empty').parentElement).toHaveTextContent('$0');
  });

  it.each([
    ['bubble', { categories: ['a', 'b', 'c', 'd'] }, 'numeric X'],
    [
      'bubble',
      {
        series: [
          { name: 'Y', values: [1, 2, 3, 4] },
          { name: 'Size', values: [1, -1, 2, 3] },
        ],
      },
      'nonnegative',
    ],
    ['boxplot', { series: [{ name: 'Min', values: [1, 2, 3] }] }, 'exactly 5'],
    [
      'boxplot',
      {
        categories: ['A'],
        series: [
          { name: 'Min', values: [1] },
          { name: 'Q1', values: [4] },
          { name: 'Median', values: [3] },
          { name: 'Q3', values: [6] },
          { name: 'Max', values: [8] },
        ],
      },
      'Min ≤ Q1',
    ],
    [
      'candlestick',
      {
        categories: ['A'],
        series: [
          { name: 'Open', values: [5] },
          { name: 'High', values: [4] },
          { name: 'Low', values: [2] },
          { name: 'Close', values: [3] },
        ],
      },
      'Low must',
    ],
    [
      'treemap',
      { categories: ['A'], series: [{ name: 'Weight', values: [0] }] },
      'positive weight',
    ],
    [
      'histogram',
      { categories: ['A'], series: [{ name: 'Count', values: [1.5] }] },
      'whole observation counts',
    ],
    ['heatmap', { series: [{ name: 'Missing', values: [1] }] }, 'one finite number per category'],
    ['bullet', { maxValue: 40 }, 'include every Actual'],
    ['lollipop', { series: [] }, '1–6 data series'],
  ] as const)(
    'explains invalid %s data without a substitute picture',
    (kind, overrides, message) => {
      const { container } = render(<AdvancedChart drawing={exampleDrawing(kind, overrides)} />);
      expect(screen.getByRole('status')).toHaveTextContent(message);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(container.querySelector('[data-chart-mark]')).toBeNull();
    },
  );

  it('rejects nonfinite direct props even if the schema boundary was bypassed', () => {
    const drawing = exampleDrawing('heatmap');
    render(
      <AdvancedChart
        drawing={{
          ...drawing,
          props: { ...drawing.props, series: [{ name: 'Invalid', values: [NaN, 1, 2, 3] }] },
        }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('finite number');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('draws finite extreme numbers without invalid geometry', () => {
    const { container } = render(
      <AdvancedChart
        drawing={exampleDrawing('lollipop', {
          categories: ['Low', 'High'],
          series: [{ name: 'Delta', values: [-1e308, 1e308] }],
        })}
      />,
    );
    expect(container.querySelector('svg')?.innerHTML).not.toMatch(/NaN|Infinity/u);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('preserves canvas category and matrix series parts, with no duplicate tooltip copies', () => {
    const { container } = render(<AdvancedChart drawing={exampleDrawing('heatmap', {}, true)} />);
    expect(container.querySelector('[data-ck-bind="categories.0"]')).toHaveTextContent('الأسبوع ١');
    expect(container.querySelector('[data-ck-bind="series.1.name"]')).toHaveTextContent('التطوير');
    expect(container.querySelector('title')).toBeNull();
  });
});
