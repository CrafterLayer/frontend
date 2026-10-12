import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Chart } from './Chart';
import { chartExamples } from './examples';
import { chartSchema } from './schema';

/*
  The chart types added on 2026-10-12 — horizontal bars, combo, scatter,
  radar, funnel, gauge and sparkline — each drawn as SVG with no script,
  named as one image, backed by the screen-reader table, mirrored on an RTL
  page and coloured through theme roles only.
*/
const node: Node = { id: 'kinds', type: 'chart', props: {} };

function renderChart(overrides: Record<string, unknown>, isCanvas = false) {
  return render(
    <Chart
      node={node}
      props={chartSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

function example(chartType: string): Record<string, unknown> {
  const found = chartExamples.find(
    (entry) => (entry.node as { props: { chartType?: string } }).props.chartType === chartType,
  );
  return (found?.node as { props: Record<string, unknown> }).props;
}

const HEX = /#[0-9a-f]{3,8}\b|rgb\(/iu;

describe('Chart — the added types', () => {
  it('draws horizontal bars beside their long labels, the axis along the bottom', () => {
    const { container } = renderChart({ ...example('hbar'), title: 'Why people book' });
    const image = screen.getByRole('img', { name: 'Why people book' });
    expect(image.tagName.toLowerCase()).toBe('svg');
    expect(image).toHaveClass('rtl:-scale-x-100');
    expect(container.querySelector('[data-chart-plot]')).toHaveAttribute('data-chart-plot', 'hbar');
    expect(container.querySelectorAll('[data-chart-bar]')).toHaveLength(4);
    const labels = container.querySelector('[data-chart-categories]');
    expect(labels).toHaveAttribute('aria-hidden', 'true');
    expect(labels?.textContent).toContain('Recommended by a friend');
    /* Value labels sit after each bar's end, on the inline axis. */
    const values = [...container.querySelectorAll<HTMLElement>('[data-chart-values] > span')];
    expect(values.map((value) => value.textContent)).toEqual(['41%', '27%', '19%', '13%']);
    expect(values[0]).toHaveClass('ms-1');
    expect(values[0]?.style.insetInlineStart).toMatch(/%$/u);
    expect(container.querySelector('[data-chart-axis]')?.textContent).toContain('40%');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(5);
  });

  it('stacks horizontal bars and labels each row with its total', () => {
    const { container } = renderChart({
      chartType: 'hbar',
      stacked: true,
      showValues: true,
    });
    expect(container.querySelectorAll('[data-chart-bar]')).toHaveLength(8);
    const totals = [...container.querySelectorAll('[data-chart-values] > span')].map(
      (label) => label.textContent,
    );
    expect(totals).toEqual(['72', '92', '105', '126']);
  });

  it('draws a combo: the first series as bars, the rest as lines with line keys', () => {
    const { container } = renderChart(example('combo'));
    expect(container.querySelectorAll('[data-chart-bar]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-chart-line]')).toHaveLength(1);
    expect(container.querySelector('[data-chart-line]')).toHaveClass('stroke-success');
    const swatches = container.querySelectorAll('[data-chart-swatch]');
    expect(swatches[0]?.firstElementChild).toHaveClass('size-3');
    expect(swatches[1]?.firstElementChild).toHaveClass('h-0.5');
  });

  it('places scatter points on a numeric x axis, and over the bands when labels are words', () => {
    const { container } = renderChart(example('scatter'));
    expect(container.querySelectorAll('[data-chart-marker]')).toHaveLength(7);
    expect(container.querySelector('[data-chart-line]')).toBeNull();
    const axis = container.querySelector('[data-chart-x-axis]');
    expect(axis?.textContent).toContain('1K');
    expect(container.querySelector('[data-chart-categories]')).toBeNull();
    expect(container.querySelector('[data-chart-grid="x"]')).not.toBeNull();
    const words = renderChart({ chartType: 'scatter' });
    expect(words.container.querySelectorAll('[data-chart-marker]')).toHaveLength(8);
    expect(words.container.querySelector('[data-chart-categories]')?.textContent).toBe('Q1Q2Q3Q4');
    expect(words.container.querySelector('[data-chart-line]')).toBeNull();
  });

  it('draws a radar web with category labels around it, and bars outside three to twelve', () => {
    const { container } = renderChart(example('radar'));
    expect(container.querySelector('[data-chart-plot]')).toHaveAttribute(
      'data-chart-plot',
      'radar',
    );
    expect(container.querySelectorAll('[data-chart-line]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-chart-marker]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-chart-grid="spoke"]')).toHaveLength(6);
    const labels = container.querySelectorAll<HTMLElement>('[data-chart-categories] > span');
    expect(labels).toHaveLength(6);
    expect(labels[0]?.style.insetInlineStart).toBe('50%');
    expect(labels[0]).toHaveClass('-translate-y-full', 'rtl:translate-x-1/2');
    expect(container.querySelector('[data-chart-axis]')?.textContent).toContain('10');
    const two = renderChart({ chartType: 'radar', categories: ['A', 'B'] });
    expect(two.container.querySelector('figure')).toHaveAttribute('data-chart-drawn', 'bar');
    expect(two.container.querySelectorAll('[data-chart-bar]')).toHaveLength(4);
  });

  it('draws a funnel of the first series with each stage’s share of the first', () => {
    const { container } = renderChart({ ...example('funnel'), showLegend: true });
    expect(container.querySelectorAll('[data-chart-stage]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-chart-neck]')).toHaveLength(3);
    const values = [...container.querySelectorAll('[data-chart-values] > span')].map(
      (row) => row.textContent,
    );
    expect(values).toEqual(['12,000100%', '3,10025.8%', '1,40011.7%', '6005%']);
    expect(container.querySelectorAll('[data-chart-stage] title')[2]).toHaveTextContent(
      'Trials: 1,400 (11.7%)',
    );
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('draws a gauge against its maximum with the target marked and named', () => {
    const { container } = renderChart(example('gauge'));
    const image = screen.getByRole('img', { name: 'رضا العملاء هذا الربع' });
    expect(image.tagName.toLowerCase()).toBe('div');
    expect(container.querySelector('[data-chart-arc]')).toHaveClass('stroke-success');
    expect(container.querySelector('[data-chart-target]')).toHaveClass('stroke-current');
    expect(container.querySelector('[data-chart-total]')).toHaveTextContent('86%');
    expect(container.querySelector('[data-chart-ends]')?.textContent).toBe('0%100%');
    expect(container.querySelector('[data-chart-target-label]')).toHaveTextContent('الهدف 90%');
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['النتيجة', 'الهدف']);
    expect(
      within(table).getByRole('rowheader', { name: 'رضا العملاء' }).parentElement,
    ).toHaveTextContent('86% / 100%');
  });

  it('draws one dial per category up to six, finding a round maximum when none is set', () => {
    const { container } = renderChart({
      chartType: 'gauge',
      categories: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      series: [{ name: 'Score', values: [10, 20, 30, 40, 50, 60, 70] }],
    });
    expect(container.querySelectorAll('[data-chart-dial]')).toHaveLength(6);
    /* The six drawn dials decide the maximum: 60 is already round. */
    expect(container.querySelector('[data-chart-ends]')?.textContent).toBe('060');
    expect(container.querySelector('[data-chart-target]')).toBeNull();
  });

  it('draws a sparkline per series with its name and last value, and no axes', () => {
    const { container } = renderChart(example('sparkline'));
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['المبيعات70', 'الزيارات1,240']);
    expect(container.querySelectorAll('[data-chart-line]')).toHaveLength(2);
    expect(container.querySelector('[data-chart-axis]')).toBeNull();
    expect(container.querySelector('[data-chart-categories]')).toBeNull();
    expect(container.querySelector('svg')).toHaveClass('h-8', 'rtl:-scale-x-100');
  });

  it.each(['hbar', 'combo', 'scatter', 'radar', 'funnel', 'gauge', 'sparkline'])(
    'keeps %s free of literal colours and backs it with the data table',
    (chartType) => {
      const { container } = renderChart({ ...example(chartType), title: 'Named' });
      expect(container.innerHTML).not.toMatch(HEX);
      expect(screen.getByRole('img', { name: 'Named' })).toBeInTheDocument();
      expect(container.querySelector('[data-chart-table]')).toHaveClass('sr-only');
    },
  );

  it('leaves the tooltips and the table out on the canvas', () => {
    const { container } = renderChart(example('funnel'), true);
    expect(container.querySelector('[data-chart-table]')).toBeNull();
    expect(container.querySelector('[data-chart-stage] title')).toBeNull();
  });
});
