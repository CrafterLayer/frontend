import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Report } from './Report';
import { reportExamples } from './examples';
import { changeOf, kpiModels, reportHosts } from './report-model';
import { reportSchema } from './schema';

const node: Node = { id: 'report', type: 'report', props: {} };

function renderReport(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <Report
      node={node}
      props={reportSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

const exampleProps = (index: number) =>
  (reportExamples[index]?.node as { props: Record<string, unknown> }).props;

describe('Report', () => {
  it('reads as a titled section: summary, KPI cards, a named chart and a table', () => {
    const { container } = renderReport(exampleProps(0));
    const region = screen.getByRole('region', { name: 'Sales rose for the third month running' });
    expect(region.tagName).toBe('SECTION');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Sales rose for the third month running',
    );
    const image = screen.getByRole('img', { name: 'Sales rose for the third month running' });
    expect(image).toHaveAttribute('aria-describedby', 'report-summary');
    expect(container.querySelector('figure')).toHaveAttribute('data-chart', 'combo');
    const cards = within(container.querySelector<HTMLElement>('[data-report-kpis]')!).getAllByRole(
      'listitem',
    );
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('Revenue in June$31,600▲⁦+13.7%⁩vs previous');
    /* Past 100,000 a card shortens its number. */
    expect(cards[2]).toHaveTextContent('Revenue this half$145.7K');
    /* The visible table carries the numbers, so the screen-reader one is left out. */
    expect(container.querySelector('[data-chart-table]')).toBeNull();
    /* A keyboard can scroll the table: a focusable group named by the report. */
    const scroller = screen.getByRole('group', { name: 'Sales rose for the third month running' });
    expect(scroller).toHaveAttribute('tabindex', '0');
    const grid = within(scroller).getByRole('table');
    expect(
      within(grid)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Revenue', 'Refunds']);
    expect(within(grid).getByRole('rowheader', { name: 'Jun' }).parentElement).toHaveTextContent(
      'Jun$31,600$820',
    );
  });

  it('colours a change by whether it is good, and always shows its arrow and sign', () => {
    const { container } = renderReport(exampleProps(0));
    const changes = [...container.querySelectorAll<HTMLElement>('[data-report-change]')];
    expect(changes.map((change) => change.dataset['reportChange'])).toEqual(['up', 'down']);
    /* Revenue up is good; refunds down is good too (better: down). */
    expect(changes[0]).toHaveClass('text-success');
    expect(changes[1]).toHaveClass('text-success');
    expect(changes[1]).toHaveTextContent('▼⁦−18%⁩vs previous');
    expect(changes[0]?.querySelector('[aria-hidden="true"]')).toHaveTextContent('▲');
    const worse = renderReport({
      categories: ['Q1', 'Q2'],
      series: [{ name: 'Costs', values: [10, 12] }],
      kpis: [{ label: 'Costs', series: 0, better: 'down' }],
    });
    const change = worse.container.querySelector('[data-report-change]');
    expect(change).toHaveAttribute('data-report-good', 'false');
    expect(change).not.toHaveClass('text-success');
    expect(change).toHaveClass('text-text');
  });

  it('speaks Arabic in an Arabic report, with its own change label', () => {
    renderReport(exampleProps(1));
    expect(screen.getByRole('img', { name: 'الحجوزات تضاعفت خلال العام' })).toBeInTheDocument();
    expect(screen.getAllByText('عن الربع السابق')).toHaveLength(2);
    expect(screen.getByText('متوسط الحجوزات').closest('li')).toHaveTextContent('175');
  });

  it('falls back to the screen-reader table when the visible one is off', () => {
    const { container } = renderReport(exampleProps(2));
    expect(screen.queryByRole('region', { name: /convert/u })?.tagName).toBe('SECTION');
    expect(container.querySelector('[data-report-table]')).toBeNull();
    expect(container.querySelector('[data-chart-table]')).toHaveClass('sr-only');
    expect(container.querySelectorAll('[data-chart-stage]')).toHaveLength(4);
    expect(container.querySelector('[data-report-change]')).toBeNull();
  });

  it('frames cards and the chart on the card look, and keeps the ink on their children', () => {
    const { container } = renderReport({ tone: 'dark' });
    const card = container.querySelector('[data-report-kpis] li');
    expect(card).toHaveClass('bg-surface', 'rounded-xl');
    expect(card?.querySelector('[data-report-value]')).toHaveClass('text-text');
    expect(container.querySelector('[data-chart-body]')).toHaveClass('text-text');
    const plain = renderReport({ variant: 'plain', tone: 'dark' });
    expect(plain.container.querySelector('[data-report-kpis] li')).toHaveClass('border-s-2');
    expect(plain.container.querySelector('[data-chart-axis]')).toHaveClass('opacity-80');
  });

  it('shows where the chart goes on the canvas when there is no data, nothing when published', () => {
    const canvas = renderReport({ series: [], kpis: [] }, true);
    expect(canvas.container.querySelector('[data-chart-empty]')).not.toBeNull();
    const published = renderReport({ series: [], kpis: [] });
    expect(published.container.querySelector('figure')).toBeNull();
    expect(published.container.querySelector('[data-report-table]')).toBeNull();
  });
});

describe('Report model', () => {
  it('measures a column as its last value, total, average, max or min', () => {
    const props = reportSchema.props.parse({
      categories: ['a', 'b', 'c'],
      series: [{ name: 'S', values: [4, 2, 6, 99] }],
      kpis: ['last', 'total', 'average', 'max'].map((measure) => ({ label: measure, measure })),
    });
    expect(kpiModels(props).map((kpi) => kpi.value)).toEqual([6, 12, 4, 6]);
    expect(kpiModels({ ...props, kpis: [{ ...props.kpis[0]!, series: 3 }] })[0]?.value).toBe(
      undefined,
    );
  });

  it('compares the last row with the one before, and only when that one is not zero', () => {
    expect(changeOf([100, 125], 'up')).toEqual({ direction: 'up', good: true, text: '⁦+25%⁩' });
    expect(changeOf([100, 75], 'up')).toEqual({ direction: 'down', good: false, text: '⁦−25%⁩' });
    expect(changeOf([100, 100.01], 'up')).toEqual({
      direction: 'flat',
      good: undefined,
      text: '0%',
    });
    expect(changeOf([0, 5], 'up')).toBeUndefined();
    expect(changeOf([5], 'up')).toBeUndefined();
  });

  it('chooses one host for every label printed in several places', () => {
    const props = reportSchema.props.parse({});
    const kpis = kpiModels(props);
    expect(reportHosts(props, kpis)).toEqual({
      affixes: 'kpis',
      affixKpi: 0,
      changeKpi: 0,
      labelsInTable: true,
    });
    expect(reportHosts({ ...props, showTable: false }, []).affixes).toBe('chart');
    expect(reportHosts(props, []).affixes).toBe('table');
  });
});

describe('Report schema', () => {
  it('defaults to a useful report and maps every inspector prop', () => {
    const defaults = reportSchema.props.parse({});
    expect(defaults).toMatchObject({
      title: 'Quarterly report',
      chartType: 'bar',
      showTable: true,
      changeLabel: 'vs previous',
      variant: 'card',
    });
    expect(defaults.kpis).toHaveLength(2);
    expect(Object.keys(reportSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(reportSchema.props.shape).sort(),
    );
  });

  it('bounds the KPIs and refuses a chart a report cannot draw', () => {
    const parse = (props: unknown) => reportSchema.props.safeParse(props).success;
    expect(parse({ kpis: Array.from({ length: 5 }, () => ({ label: 'K' })) })).toBe(false);
    expect(parse({ kpis: [{ label: 'K', series: 6 }] })).toBe(false);
    expect(parse({ chartType: 'gauge' })).toBe(false);
    expect(parse({ chartType: 'hbar' })).toBe(true);
  });

  it('ships English and Arabic examples that parse', () => {
    for (const example of reportExamples) {
      expect((example.node as { type: string }).type).toBe('report');
      expect(reportSchema.props.safeParse((example.node as { props: unknown }).props).success).toBe(
        true,
      );
    }
    expect(reportExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
