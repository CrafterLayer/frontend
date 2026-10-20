import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Report } from './Report';
import { reportSchema, type ReportProps } from './schema';

/*
  Block parts (DESIGN §4.3): the title, the summary, every KPI card and its
  label, the change label, and the chart's own parts — categories, column
  names, the value prefix and suffix — are addressable on the canvas, carry
  nothing when published, and render an inline editor swapped in at its bind
  exactly once. A label printed in several places (a category in the chart and
  the table, the prefix beside every number, the change label on every card)
  shows the editor at one host and committed text elsewhere.
*/
const node: Node = { id: 'report-parts', type: 'report', props: {} };

type Swap = (props: ReportProps) => ReportProps;

function renderReport(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = reportSchema.props.parse({
    summary: 'Revenue grew every quarter.',
    valuePrefix: '$',
    valueSuffix: 'k',
    ...overrides,
  });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Report node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

function swapEverything(props: ReportProps): ReportProps {
  return {
    ...props,
    title: swapped('title'),
    summary: swapped('summary'),
    changeLabel: swapped('changeLabel'),
    otherLabel: swapped('otherLabel'),
    valuePrefix: swapped('valuePrefix'),
    valueSuffix: swapped('valueSuffix'),
    categories: props.categories.map((_, index) => swapped(`categories.${String(index)}`)),
    series: props.series.map((entry, index) => ({
      ...entry,
      name: swapped(`series.${String(index)}.name`),
    })),
    kpis: props.kpis.map((kpi, index) => ({
      ...kpi,
      label: swapped(`kpis.${String(index)}.label`),
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

const EVERY_LABEL = [
  'title',
  'summary',
  'changeLabel',
  'valuePrefix',
  'valueSuffix',
  'categories.0',
  'categories.3',
  'series.0.name',
  'series.1.name',
  'kpis.0.label',
  'kpis.1.label',
];

describe('Report parts', () => {
  it('stamps the title, summary, KPI cards and chart parts on the canvas', () => {
    const { container } = renderReport({}, true);
    expect(partsNamed(container, 'title')[0]).toHaveAttribute('data-ck-bind', 'title');
    expect(partsNamed(container, 'summary')[0]?.tagName).toBe('P');
    expect(partsNamed(container, 'kpis')[0]?.tagName).toBe('UL');
    expect(partsNamed(container, 'kpi')[1]).toHaveAttribute('data-ck-bind', 'kpis.1');
    expect(partsNamed(container, 'kpi.label')[1]).toHaveAttribute('data-ck-bind', 'kpis.1.label');
    expect(partsNamed(container, 'changeLabel')).toHaveLength(2);
    /* Each category in the chart's axis and in the table's row headers. */
    expect(partsNamed(container, 'category')).toHaveLength(8);
    expect(partsNamed(container, 'dataset.name')).toHaveLength(4);
  });

  it('keeps the data note editor visible and bound once', () => {
    const { container } = renderReport(
      { dataNote: 'Source and bin definitions.' },
      true,
      (props) => ({ ...props, dataNote: swapped('dataNote') }),
    );
    expectOnce(container, ['dataNote']);
    expect(partsNamed(container, 'dataNote')[0]?.tagName).toBe('P');
  });

  it('publishes no part markers', () => {
    const { container } = renderReport({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('renders every swapped label once: the table, the first card and the first change host', () => {
    const { container } = renderReport({ showValues: true }, true, swapEverything);
    expectOnce(container, EVERY_LABEL);
    expect(container.querySelector('[data-swap="categories.0"]')?.closest('table')).not.toBeNull();
    expect(
      container.querySelector('[data-swap="valuePrefix"]')?.closest('[data-report-kpis]'),
    ).not.toBeNull();
    /* Mid-edit, the chart is still named by the title element. */
    expect(container.querySelector('svg')).toHaveAttribute('aria-labelledby', 'report-parts-title');
  });

  it('lets the chart host the labels without a table, and the table host the affixes without cards', () => {
    const noTable = renderReport({ showTable: false, chartType: 'line' }, true, swapEverything);
    expectOnce(noTable.container, EVERY_LABEL);
    expect(
      noTable.container
        .querySelector('[data-swap="categories.0"]')
        ?.closest('[data-chart-categories]'),
    ).not.toBeNull();
    noTable.unmount();
    const noCards = renderReport({ kpis: [] }, true, swapEverything);
    expectOnce(noCards.container, ['valuePrefix', 'valueSuffix', 'categories.1']);
    expect(
      noCards.container.querySelector('[data-swap="valuePrefix"]')?.closest('table'),
    ).not.toBeNull();
  });

  it('applies a part style to every copy of a label', () => {
    const { container } = renderReport(
      {
        partStyles: {
          category: { className: 'font-bold' },
          'kpi.label': { className: 'text-accent' },
        },
      },
      true,
    );
    expect(
      partsNamed(container, 'category').every((label) => label.classList.contains('font-bold')),
    ).toBe(true);
    expect(partsNamed(container, 'kpi.label')[0]).toHaveClass('text-accent');
  });
});
