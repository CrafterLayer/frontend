import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type Node, parsePropPath, setAtPropPath } from '@craftkit/builder-schema';

import { chartTypes } from '../Chart/schema';
import { Report } from './Report';
import { kpiModels, reportChartProps } from './report-model';
import { reportSchema } from './schema';

const node: Node = { id: 'report-kpis', type: 'report', props: {} };
const base = {
  categories: ['Jan', 'Feb', 'Mar', 'Apr'],
  series: [{ name: 'Revenue', values: [40, 10, 120, 30] }],
  valuePrefix: '$',
};

function draw(props: Record<string, unknown>) {
  return render(
    <Report
      node={node}
      props={reportSchema.props.parse({ ...base, ...props })}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('Report professional KPIs', () => {
  it('computes even and odd medians from copies and counts actual observations', () => {
    const props = reportSchema.props.parse({
      ...base,
      kpis: [
        { label: 'Median', measure: 'median' },
        { label: 'Count', measure: 'count' },
      ],
    });
    expect(kpiModels(props).map((kpi) => kpi.value)).toEqual([35, 4]);
    expect(props.series[0]?.values).toEqual([40, 10, 120, 30]);
    expect(
      kpiModels({ ...props, categories: ['Jan', 'Feb', 'Mar'] }).map((kpi) => kpi.value),
    ).toEqual([40, 3]);
    expect(kpiModels({ ...props, series: [] }).map((kpi) => kpi.value)).toEqual([undefined, 0]);
  });

  it('shows up to eight cards and keeps counts unitless', () => {
    const { container } = draw({
      showTrends: true,
      kpis: [
        { label: 'Observed months', measure: 'count', target: 5 },
        ...['last', 'total', 'average', 'min', 'max', 'median', 'total'].map((measure) => ({
          label: measure,
          measure,
        })),
      ],
    });
    expect(container.querySelectorAll('[data-report-kpis] > li')).toHaveLength(8);
    const count = screen.getByText('Observed months').closest('li');
    expect(count?.querySelector('[data-report-value]')).toHaveTextContent(/^4$/u);
    expect(count).not.toHaveTextContent('$');
    expect(count?.querySelector('svg')).toBeNull();
    expect(screen.getByRole('img', { name: 'median' })).toHaveAccessibleDescription(
      '40 → 10 → 120 → 30',
    );
  });

  it('uses an explicit comparison baseline for aggregated measures', () => {
    const { container } = draw({
      kpis: [{ label: 'Quarter revenue', measure: 'total', comparisonValue: 160 }],
    });
    expect(screen.getByText('Quarter revenue').closest('li')).toHaveTextContent('$200');
    expect(container.querySelector('[data-report-change]')).toHaveTextContent('+25%');
  });

  it('names and displays the explicit baseline instead of claiming the previous row', () => {
    const { container } = draw({
      categories: ['Jan', 'Feb'],
      series: [{ name: 'Revenue', values: [100, 120] }],
      kpis: [
        { label: 'Revenue', comparisonValue: 80 },
        { label: 'Observations', measure: 'count', comparisonValue: 1 },
      ],
    });
    const revenue = screen
      .getByText('Revenue', { selector: '[data-report-kpis] li > span' })
      .closest('li');
    expect(revenue).toHaveTextContent('+50%');
    expect(revenue).toHaveTextContent('vs baseline$80');
    const count = screen.getByText('Observations').closest('li');
    expect(count).toHaveTextContent('+100%');
    expect(count).toHaveTextContent('vs baseline1');
    expect(count).not.toHaveTextContent('$');
    expect(screen.queryByText('vs previous')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-report-baseline]')).toHaveLength(2);
  });

  it('keeps percentage above 100 visible while bounding the target bar', () => {
    draw({
      series: [{ name: 'Revenue', values: [100, 120] }],
      kpis: [{ label: 'Revenue', target: 100, detail: 'Approved monthly plan' }],
      targetLabel: 'Plan',
    });
    const bar = screen.getByRole('progressbar', { name: 'Revenue — Plan: ≥ $100' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('aria-valuetext', '120% (Plan: ≥ $100)');
    expect(screen.getByText('120%')).toBeVisible();
    expect(screen.getByText('Approved monthly plan')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Target met' })).toBeInTheDocument();
  });

  it('distinguishes a maximum target from a minimum without color alone', () => {
    draw({
      series: [{ name: 'Costs', values: [100, 80] }],
      kpis: [{ label: 'Costs', better: 'down', target: 100 }],
    });
    expect(screen.getByRole('progressbar', { name: 'Costs — Target: ≤ $100' })).toHaveAttribute(
      'aria-valuetext',
      '80% (Target: ≤ $100)',
    );
    expect(screen.getByRole('img', { name: 'Target met' })).toHaveTextContent('✓');
  });

  it('does not invent percentages from zero baselines or nonpositive targets', () => {
    const { container } = draw({
      series: [{ name: 'Errors', values: [0, 5] }],
      kpis: [{ label: 'Errors', comparisonValue: 0, target: 0, better: 'down' }],
    });
    expect(container.querySelector('[data-report-change]')).toBeNull();
    expect(screen.getByText('vs baseline')).toBeVisible();
    expect(container.querySelector('[data-report-baseline]')).toHaveTextContent('$0');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Target not met' })).toHaveTextContent('○');
    expect(container.innerHTML).not.toMatch(/Infinity|NaN/u);
  });

  it('keeps median and average finite for extreme finite observations', () => {
    const props = reportSchema.props.parse({
      categories: ['A', 'B'],
      series: [{ name: 'X', values: [Number.MAX_VALUE, Number.MAX_VALUE] }],
      kpis: [
        { label: 'Median', measure: 'median' },
        { label: 'Average', measure: 'average' },
      ],
    });
    expect(kpiModels(props).map((kpi) => kpi.value)).toEqual([Number.MAX_VALUE, Number.MAX_VALUE]);
  });

  it('preserves nonzero tiny observations in median and average', () => {
    const props = reportSchema.props.parse({
      categories: ['A', 'B'],
      series: [{ name: 'Small measurements', values: [Number.MIN_VALUE, Number.MIN_VALUE] }],
      kpis: [
        { label: 'Median', measure: 'median' },
        { label: 'Average', measure: 'average' },
      ],
    });
    expect(kpiModels(props).map((kpi) => kpi.value)).toEqual([Number.MIN_VALUE, Number.MIN_VALUE]);
  });

  it('retains legacy output until new options are selected', () => {
    const { container } = draw({});
    expect(container.querySelector('[data-metric-trend]')).toBeNull();
    expect(container.querySelector('[data-report-target]')).toBeNull();
  });

  it('accepts the same chart type set and forwards gauge scale and goal', () => {
    for (const chartType of chartTypes) {
      const props = reportSchema.props.parse({
        chartType,
        maxValue: 200,
        targetValue: 150,
        targetLabel: 'Plan',
      });
      expect(reportChartProps(props, { labels: 'raw', affixes: 'raw' })).toMatchObject({
        chartType,
        maxValue: 200,
        targetValue: 150,
        targetLabel: 'Plan',
      });
    }
  });

  it('hosts a target caption and affix editor once across cards, chart and trends', () => {
    let props = reportSchema.props.parse({
      ...base,
      chartType: 'gauge',
      maxValue: 200,
      targetValue: 100,
      targetLabel: 'Plan',
      comparisonLabel: 'vs approved reference',
      showTrends: true,
      kpis: [
        { label: 'Revenue', target: 100, comparisonValue: 80, detail: 'Source: ledger' },
        { label: 'Median', measure: 'median', target: 100, comparisonValue: 30 },
        { label: 'Previous-row comparison', measure: 'last' },
      ],
    });
    const paths = [
      'targetLabel',
      'comparisonLabel',
      'changeLabel',
      'valuePrefix',
      'kpis.0.label',
      'kpis.0.detail',
    ];
    for (const path of paths)
      props = setAtPropPath(props, parsePropPath(path), <span data-swap={path} />);
    const { container } = render(
      <Report node={node} props={props} slots={{}} data={{}} isCanvas />,
    );
    for (const path of paths) {
      const matches = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === path,
      );
      expect(matches, path).toHaveLength(1);
      expect(matches[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', path);
    }
    expect(container.innerHTML).not.toContain('[object Object]');
  });
});
