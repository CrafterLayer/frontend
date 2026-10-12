import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Chart } from './Chart';
import { chartSchema, type ChartProps } from './schema';

/*
  Block parts (DESIGN §4.3): the title, the description, every category label,
  the "other" slice label and every series name in the legend are addressable
  on the canvas, carry nothing extra when published, take classes and
  direction from `partStyles`, and render an inline editor swapped in at its
  bind exactly once — never inside an attribute, a tooltip or the
  screen-reader table.
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
    const { container } = renderChart({}, true, swapEverything);
    expectOnce(container, [
      'title',
      'description',
      'categories.0',
      'categories.3',
      'series.0.name',
      'series.1.name',
    ]);
    /* Mid-edit, the picture is still named by the title element; tooltips fall back to the value. */
    expect(container.querySelector('svg')).toHaveAttribute('aria-labelledby', 'chart-parts-title');
    expect(container.querySelector('[data-chart-table] caption')).toBeNull();
    expect(container.querySelector('[data-chart-bar] title')?.textContent).toBe('42');
  });

  it('keeps a pie swapped in once, its tooltips and table on committed text only', () => {
    const categories = Array.from({ length: 9 }, (_, index) => `C${String(index)}`);
    const { container } = renderChart(
      {
        chartType: 'donut',
        title: undefined,
        categories,
        series: [{ name: 'S', values: categories.map((_, at) => at + 1) }],
      },
      true,
      (props) => ({ ...swapEverything(props), title: undefined }),
    );
    expectOnce(container, ['otherLabel', 'categories.8', 'categories.2']);
    expect(container.querySelector('svg')).toHaveAttribute('aria-label', 'donut');
    expect(container.querySelector('[data-chart-slice] title')?.textContent).toMatch(/^\d/u);
  });
});
