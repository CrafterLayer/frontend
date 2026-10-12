import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Chart } from './Chart';
import { chartExamples } from './examples';
import { chartSchema } from './schema';

const node: Node = { id: 'chart', type: 'chart', props: {} };

function renderChart(overrides: Record<string, unknown> = {}, isCanvas = false) {
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

describe('Chart', () => {
  it('draws the default bar chart as a named image with a data table behind it', () => {
    const { container } = renderChart({
      title: 'Quarterly results',
      description: 'Revenue and costs.',
    });
    const figure = container.querySelector('figure');
    expect(figure).toHaveAttribute('data-chart', 'bar');
    const image = screen.getByRole('img', { name: 'Quarterly results' });
    expect(image.tagName.toLowerCase()).toBe('svg');
    expect(image).toHaveAttribute('aria-describedby', 'chart-description');
    expect(image).toHaveClass('rtl:-scale-x-100', 'size-full');
    expect(image).toHaveAttribute('preserveAspectRatio', 'none');
    expect(image.parentElement).toHaveClass('h-64');
    expect(container.querySelectorAll('[data-chart-bar]')).toHaveLength(8);
    expect(screen.getByRole('region', { name: 'Quarterly results' })).toHaveClass('@container');

    const table = screen.getByRole('table', { name: 'Quarterly results' });
    expect(table).toHaveClass('sr-only');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Revenue', 'Costs']);
    expect(within(table).getByRole('rowheader', { name: 'Q4' }).parentElement).toHaveTextContent(
      'Q48145',
    );
  });

  it('names an untitled chart by its series and leaves the section unlabelled', () => {
    const { container } = renderChart();
    expect(screen.getByRole('img', { name: 'Revenue, Costs' })).not.toHaveAttribute(
      'aria-describedby',
    );
    expect(container.querySelector('section')).not.toHaveAttribute('aria-labelledby');
    expect(container.querySelector('figcaption')).toBeNull();
    expect(container.querySelector('caption')).toBeNull();
  });

  it('puts the y axis, category labels and a legend in HTML, hidden from screen readers', () => {
    const { container } = renderChart({ valuePrefix: '$' });
    const axis = container.querySelector('[data-chart-axis]');
    expect(axis).toHaveAttribute('aria-hidden', 'true');
    expect(axis?.textContent).toBe('$0$20$40$60$80$100');
    const categories = container.querySelector('[data-chart-categories]');
    expect(categories).toHaveAttribute('aria-hidden', 'true');
    expect(categories?.textContent).toBe('Q1Q2Q3Q4');
    const legend = screen.getByRole('list');
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Revenue', 'Costs']);
    expect(container.querySelectorAll('[data-chart-grid]')).toHaveLength(6);
    expect(container.querySelector('[data-chart-baseline]')).not.toBeNull();
  });

  it('shows no legend for one series, no gridlines when asked, and value labels on request', () => {
    const { container } = renderChart({
      series: [{ name: 'Revenue', values: [1200, -300, 900] }],
      categories: ['Jan', 'Feb', 'Mar'],
      showGrid: false,
      showValues: true,
      valuePrefix: '$',
    });
    expect(screen.queryByRole('list')).toBeNull();
    expect(container.querySelector('[data-chart-grid]')).toBeNull();
    const values = container.querySelector('[data-chart-values]');
    expect(values).toHaveAttribute('aria-hidden', 'true');
    const labels = [...(values?.querySelectorAll<HTMLElement>(':scope > span') ?? [])];
    expect(labels.map((label) => label.textContent)).toEqual(['$1,200', '$⁦−300⁩', '$900']);
    expect(labels[1]).toHaveClass('mt-1');
    expect(labels[0]).toHaveClass('-translate-y-full', 'rtl:translate-x-1/2');
    expect(labels[0]?.style.insetInlineStart).toMatch(/%$/u);
  });

  it('gives every mark a tooltip with its category, series and value', () => {
    const { container } = renderChart({ valueSuffix: '%' });
    const titles = [...container.querySelectorAll('[data-chart-bar] title')].map(
      (title) => title.textContent,
    );
    expect(titles[0]).toBe('Q1 · Revenue: 42%');
    expect(titles).toHaveLength(8);
  });

  it('draws a line chart with ringed markers and line swatches in its legend', () => {
    const { container } = renderChart({ chartType: 'line', palette: 'mixed' });
    const lines = container.querySelectorAll('[data-chart-line]');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveClass('stroke-accent');
    expect(lines[1]).toHaveClass('stroke-success');
    expect(lines[0]).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    const markers = container.querySelectorAll('[data-chart-marker]');
    expect(markers).toHaveLength(8);
    expect(markers[0]).toHaveClass('stroke-accent');
    expect(markers[0]).toHaveAttribute('stroke-linecap', 'round');
    expect(container.querySelector('[data-chart-ring]')).toHaveClass('stroke-surface');
    const swatch = screen.getAllByRole('listitem')[0]?.querySelector('[data-chart-swatch]');
    expect(swatch).toHaveAttribute('aria-hidden', 'true');
    expect(swatch).not.toHaveClass('bg-surface');
    expect(swatch?.firstElementChild).toHaveClass('h-0.5', 'bg-accent');
  });

  it('lays the surface under translucent tones so they read the same on any ground', () => {
    const { container } = renderChart({ variant: 'plain', tone: 'dark', palette: 'accent' });
    /* Slot two (`text-muted`) is opaque; slot three (`accent/55`) is translucent. */
    const bars = [...container.querySelectorAll('[data-chart-bar]')];
    expect(bars[0]?.previousElementSibling).toBeNull();
    const third = renderChart({
      series: [
        { name: 'A', values: [1] },
        { name: 'B', values: [2] },
        { name: 'C', values: [3] },
      ],
      categories: ['Only'],
      chartType: 'line',
    });
    const underlays = third.container.querySelectorAll('[data-chart-underlay]');
    /* The third series' line and its one marker each get an underlay. */
    expect(underlays).toHaveLength(2);
    expect(underlays[0]).toHaveClass('stroke-surface');
    const swatches = third.container.querySelectorAll('[data-chart-swatch]');
    expect(swatches[2]).toHaveClass('bg-surface');
    expect(swatches[2]?.firstElementChild).toHaveClass('bg-accent/55');
  });

  it('fills stacked areas more strongly than overlapping ones', () => {
    const { container, unmount } = renderChart({ chartType: 'area', stacked: true });
    expect(container.querySelectorAll('[data-chart-area]')[0]).toHaveAttribute(
      'fill-opacity',
      '0.4',
    );
    expect(container.querySelectorAll('[data-chart-line]')).toHaveLength(2);
    expect(container.querySelector('[data-chart-marker]')).toBeNull();
    unmount();
    const overlapping = renderChart({ chartType: 'area' });
    expect(overlapping.container.querySelector('[data-chart-area]')).toHaveAttribute(
      'fill-opacity',
      '0.14',
    );
    expect(overlapping.container.querySelector('[data-chart-area] title')).toHaveTextContent(
      'Revenue',
    );
  });

  it('slices a pie from the first series and lists each category with its share', () => {
    const { container } = renderChart({ chartType: 'pie', palette: 'success', showValues: true });
    expect(container.querySelectorAll('[data-chart-slice]')).toHaveLength(4);
    expect(container.querySelector('[data-chart-slice]')).toHaveClass(
      'fill-success',
      'stroke-surface',
    );
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Q142 · 17.1%',
      'Q258 · 23.7%',
      'Q364 · 26.1%',
      'Q481 · 33.1%',
    ]);
    expect(container.querySelector('[data-chart-total]')).toBeNull();
    /* The screen-reader table carries the first series only. */
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(1);
    expect(container.querySelector('[data-chart-slice] title')).toHaveTextContent('Q1: 42 (17.1%)');
  });

  it('shows a donut total, folds small slices into "other", and can hide its legend', () => {
    const categories = Array.from({ length: 10 }, (_, index) => `C${String(index + 1)}`);
    const { container } = renderChart({
      chartType: 'donut',
      categories,
      series: [{ name: 'Share', values: categories.map((_, index) => index + 1) }],
      otherLabel: 'Everything else',
      showValues: true,
    });
    expect(container.querySelector('[data-chart-total]')).toHaveTextContent('55');
    expect(container.querySelectorAll('[data-chart-slice]')).toHaveLength(8);
    expect(screen.getByText('Everything else')).toBeInTheDocument();
    const hidden = renderChart({ chartType: 'donut', showLegend: false });
    expect(within(hidden.container).queryByRole('list')).toBeNull();
    expect(hidden.container.querySelector('[data-chart-total]')).toBeNull();
  });

  it('shows where an empty chart will be on the canvas and nothing when published', () => {
    const canvas = renderChart({ title: 'Nothing yet', categories: [] }, true);
    expect(canvas.container.querySelector('[data-chart-empty]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(within(canvas.container).queryByRole('img')).toBeNull();
    expect(within(canvas.container).queryByRole('table')).toBeNull();
    const published = renderChart({ title: 'Nothing yet', chartType: 'pie', series: [] });
    expect(published.container.querySelector('[data-chart-empty]')).toBeNull();
    expect(
      within(published.container).getByRole('heading', { name: 'Nothing yet' }),
    ).toBeInTheDocument();
  });

  it('keeps secondary text legible on a plain chart over a dark section', () => {
    const { container } = renderChart({
      variant: 'plain',
      tone: 'dark',
      chartType: 'line',
      description: 'Trend.',
    });
    expect(container.querySelector('figure')).not.toHaveClass('bg-surface');
    expect(container.querySelector('[data-chart-body]')).not.toHaveClass('text-text');
    expect(container.querySelector('figcaption')).not.toHaveClass('text-text');
    expect(container.querySelector('[data-chart-axis]')).toHaveClass('opacity-80');
    expect(container.querySelector('[data-chart-ring]')).toHaveClass('stroke-surface-inverse');
    expect(screen.getByText('Trend.')).toHaveClass('opacity-80');
  });

  it('frames a card chart and combines token colour, typography and spacing controls', () => {
    const { container } = renderChart({
      background: 'accent',
      fontFamily: 'serif',
      marginInlineEnd: 4,
    });
    expect(container.querySelector('figure')).toHaveClass(
      'rounded-xl',
      'bg-surface',
      'shadow-soft',
    );
    /* On a dark section the slab rules recolour the card's own ink, so its children carry it. */
    expect(container.querySelector('[data-chart-body]')).toHaveClass('text-text');
    const section = container.querySelector('section')!;
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });

  it('thins crowded category labels once the container narrows', () => {
    const categories = Array.from({ length: 12 }, (_, index) => `M${String(index + 1)}`);
    const { container } = renderChart({
      categories,
      series: [{ name: 'S', values: categories.map(() => 1) }],
    });
    const labels = container.querySelectorAll('[data-chart-categories] > span');
    expect(labels[0]).not.toHaveClass('@max-3xl:invisible');
    expect(labels[1]).toHaveClass('@max-3xl:invisible');
  });
});

describe('Chart schema', () => {
  it('defaults to a useful two-series bar chart and maps every inspector prop', () => {
    const defaults = chartSchema.props.parse({});
    expect(defaults).toMatchObject({
      chartType: 'bar',
      categories: ['Q1', 'Q2', 'Q3', 'Q4'],
      palette: 'accent',
      showLegend: true,
      showValues: false,
      showGrid: true,
      stacked: false,
      height: 'md',
      variant: 'card',
      otherLabel: 'Other',
    });
    expect(defaults.series).toHaveLength(2);
    expect(Object.keys(chartSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(chartSchema.props.shape).sort(),
    );
  });

  it('bounds the data and refuses what is not a number', () => {
    const parse = (props: unknown) => chartSchema.props.safeParse(props).success;
    expect(parse({ categories: Array.from({ length: 25 }, (_, index) => String(index)) })).toBe(
      false,
    );
    expect(
      parse({
        series: Array.from({ length: 7 }, (_, index) => ({
          name: `S${String(index)}`,
          values: [],
        })),
      }),
    ).toBe(false);
    expect(parse({ series: [{ name: 'S', values: ['12'] }] })).toBe(false);
    expect(parse({ series: [{ name: 'S', values: [Number.NaN] }] })).toBe(false);
    expect(parse({ chartType: 'bubble' })).toBe(false);
    expect(parse({ chartType: 'gauge', maxValue: 100, targetValue: 90 })).toBe(true);
    expect(parse({ series: [{ name: 'S' }] })).toBe(true);
  });

  it('ships model-facing examples for the chart types, in English and Arabic', () => {
    const types = new Set<string>();
    for (const example of chartExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('chart');
      const parsed = chartSchema.props.parse(exampleNode.props);
      types.add(parsed.chartType);
    }
    expect([...types].sort()).toEqual([
      'area',
      'bar',
      'combo',
      'donut',
      'funnel',
      'gauge',
      'hbar',
      'line',
      'radar',
      'scatter',
      'sparkline',
    ]);
    const arabic = chartExamples.filter((example) => /[؀-ۿ]/u.test(example.prompt));
    expect(arabic.length).toBeGreaterThanOrEqual(4);
  });
});
