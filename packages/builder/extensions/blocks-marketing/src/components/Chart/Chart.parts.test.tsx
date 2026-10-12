import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Chart } from './Chart';
import { chartSchema, type ChartProps } from './schema';

/*
  Block parts (DESIGN §4.3): the title, the description, every category label,
  the "other" slice label, every series name in the legend and the value
  prefix and suffix are addressable on the canvas, carry nothing extra when
  published, take classes and direction from `partStyles`, and render an
  inline editor swapped in at its bind exactly once — never inside an
  attribute. The canvas leaves out the tooltips and the screen-reader table,
  which would only repeat the labels being edited.
*/
const node: Node = { id: 'chart-parts', type: 'chart', props: {} };

const FULL = { title: 'Quarterly results', description: 'Revenue against costs.' };

type Swap = (props: ChartProps) => ChartProps;

function renderChart(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = chartSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Chart node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

function swapEverything(props: ChartProps): ChartProps {
  return {
    ...props,
    title: swapped('title'),
    description: swapped('description'),
    otherLabel: swapped('otherLabel'),
    targetLabel: swapped('targetLabel'),
    valuePrefix: props.valuePrefix === undefined ? undefined : swapped('valuePrefix'),
    valueSuffix: props.valueSuffix === undefined ? undefined : swapped('valueSuffix'),
    categories: props.categories.map((_, index) => swapped(`categories.${String(index)}`)),
    series: props.series.map((entry, index) => ({
      ...entry,
      name: swapped(`series.${String(index)}.name`),
    })),
  };
}

function expectOnce(container: HTMLElement, keys: readonly string[]) {
  expect(container.innerHTML).not.toContain('[object Object]');
  for (const key of keys) {
    const found = [...container.querySelectorAll('[data-swap]')].filter(
      (element) => element.getAttribute('data-swap') === key,
    );
    expect(found, key).toHaveLength(1);
    expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
  }
}

describe('Chart parts', () => {
  it('stamps the title, description, category labels and legend on the canvas', () => {
    const { container } = renderChart({}, true);
    expect(partsNamed(container, 'title')[0]).toHaveAttribute('data-ck-bind', 'title');
    expect(partsNamed(container, 'description')[0]?.tagName).toBe('P');
    expect(partsNamed(container, 'categories')[0]).toHaveAttribute('data-chart-categories');
    expect(partsNamed(container, 'category').map((label) => label.dataset['ckBind'])).toEqual([
      'categories.0',
      'categories.1',
      'categories.2',
      'categories.3',
    ]);
    expect(partsNamed(container, 'series')[0]?.tagName).toBe('UL');
    expect(partsNamed(container, 'dataset')[1]).toHaveAttribute('data-ck-bind', 'series.1');
    expect(partsNamed(container, 'dataset.name')[1]).toHaveAttribute(
      'data-ck-bind',
      'series.1.name',
    );
  });

  it('moves the category parts into the legend of a pie, with the "other" slice label', () => {
    const categories = Array.from({ length: 9 }, (_, index) => `C${String(index)}`);
    const { container } = renderChart(
      {
        chartType: 'pie',
        categories,
        series: [{ name: 'S', values: categories.map((_, at) => at + 1) }],
      },
      true,
    );
    expect(partsNamed(container, 'categories')[0]?.tagName).toBe('UL');
    expect(partsNamed(container, 'category')).toHaveLength(7);
    expect(partsNamed(container, 'otherLabel')[0]).toHaveTextContent('Other');
    expect(partsNamed(container, 'series')).toHaveLength(0);
  });

  it('publishes no part markers', () => {
    const { container } = renderChart({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'Quarterly results' })).toBeInTheDocument();
  });

  it('applies an all-items style to every label and a this-item style to one, this winning', () => {
    const { container } = renderChart(
      {
        partStyles: {
          category: { className: 'font-bold' },
          'category@2': { className: 'font-regular', dir: 'ltr' },
          title: { className: 'text-accent' },
        },
      },
      true,
    );
    const labels = partsNamed(container, 'category');
    expect(labels[0]).toHaveClass('font-bold');
    expect(labels[0]).toHaveAttribute('dir', 'auto');
    expect(labels[2]).toHaveClass('font-regular');
    expect(labels[2]).not.toHaveClass('font-bold');
    expect(labels[2]).toHaveAttribute('dir', 'ltr');
    expect(partsNamed(container, 'title')[0]).toHaveClass('text-accent');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderChart(
      { showValues: true, valuePrefix: '$', valueSuffix: 'k' },
      true,
      swapEverything,
    );
    expectOnce(container, [
      'title',
      'description',
      'categories.0',
      'categories.3',
      'series.0.name',
      'series.1.name',
      'valuePrefix',
      'valueSuffix',
    ]);
    /* Mid-edit, the picture is still named by the title element. */
    expect(container.querySelector('svg')).toHaveAttribute('aria-labelledby', 'chart-parts-title');
    expect(container.querySelector('[data-chart-table]')).toBeNull();
    expect(container.querySelector('[data-chart-bar] title')).toBeNull();
  });

  it('wraps every committed prefix and suffix on the canvas in its part', () => {
    const { container } = renderChart(
      { showValues: true, valuePrefix: '$', valueSuffix: 'k' },
      true,
    );
    const prefixes = partsNamed(container, 'valuePrefix');
    /* Six axis ticks and eight value labels. */
    expect(prefixes).toHaveLength(14);
    expect(prefixes.every((prefix) => prefix.textContent === '$')).toBe(true);
    expect(prefixes[0]).toHaveAttribute('data-ck-bind', 'valuePrefix');
    expect(partsNamed(container, 'valueSuffix')[0]).toHaveTextContent('k');
  });

  it('lets the donut total host the affixes when there is no legend', () => {
    const { container } = renderChart(
      {
        chartType: 'donut',
        title: undefined,
        showLegend: false,
        showValues: true,
        valueSuffix: '%',
      },
      true,
      swapEverything,
    );
    expectOnce(container, ['valueSuffix']);
    expect(
      container.querySelector('[data-swap="valueSuffix"]')?.closest('[data-chart-total]'),
    ).not.toBeNull();
  });

  it('keeps a pie swapped in once, the legend hosting the prefix, with no tooltips', () => {
    const categories = Array.from({ length: 9 }, (_, index) => `C${String(index)}`);
    const { container } = renderChart(
      {
        chartType: 'donut',
        title: undefined,
        categories,
        series: [{ name: 'S', values: categories.map((_, at) => at + 1) }],
        showValues: true,
        valuePrefix: '$',
      },
      true,
      (props) => ({ ...swapEverything(props), title: undefined }),
    );
    expectOnce(container, ['otherLabel', 'categories.8', 'categories.2', 'valuePrefix']);
    expect(container.querySelector('[data-swap="valuePrefix"]')?.closest('ul')).not.toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-label', 'donut');
    expect(container.querySelector('[data-chart-slice] title')).toBeNull();
  });

  it.each([
    ['hbar', {}],
    ['combo', {}],
    ['scatter', { categories: ['1', '2', '3', '4'] }],
    ['radar', { categories: ['A', 'B', 'C', 'D'] }],
    ['funnel', {}],
    ['sparkline', {}],
  ] as const)('swaps every visible label of a %s in once, in its bind', (chartType, extra) => {
    const { container } = renderChart(
      { chartType, showValues: true, valuePrefix: '$', valueSuffix: 'k', ...extra },
      true,
      swapEverything,
    );
    expectOnce(container, ['title', 'description', 'valuePrefix', 'valueSuffix']);
    const visible = [...container.querySelectorAll('[data-swap]')].map((element) =>
      element.getAttribute('data-swap'),
    );
    expect(new Set(visible).size).toBe(visible.length);
    for (const element of container.querySelectorAll('[data-swap]')) {
      expect(element.closest('[data-ck-bind]')).toHaveAttribute(
        'data-ck-bind',
        element.getAttribute('data-swap'),
      );
    }
  });

  it('puts a gauge’s label and its target label in their parts, the first dial hosting', () => {
    const { container } = renderChart(
      {
        chartType: 'gauge',
        categories: ['Speed', 'Care'],
        series: [{ name: 'Score', values: [70, 90] }],
        maxValue: 100,
        targetValue: 80,
        valueSuffix: '%',
      },
      true,
      swapEverything,
    );
    expectOnce(container, ['categories.0', 'categories.1', 'targetLabel', 'valueSuffix']);
    expect(partsNamed(container, 'targetLabel')).toHaveLength(2);
    expect(container.querySelector('[data-swap="targetLabel"]')?.closest('[data-chart-dial]')).toBe(
      container.querySelector('[data-chart-dial]'),
    );
  });
});
