import { describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { validateAiPlan } from '../plan/validate-plan';
import { expandAgentTools } from '../tools/agent/expand';
import { CHART_TYPES, type ChartType } from './data-chart';
import { reportKernel, reportPageBlocks } from './report-page.fixtures';
import { REPORT_PRESENTATIONS } from './report-page-options';

const FINANCE = 'Month,Revenue,Costs\nMar,$300,$90\nJan,$100,$40\nFeb,$200,$70';
const OPERATIONS = 'Month,Actual,Target\nMar,125,100\nJan,40,50\nFeb,80,100';
const MARKETING = 'Channel,Visits,Conversions\nEmail,1000,80\nSearch,2000,120\nSocial,500,25';

function expand(input: unknown, kernel: BuilderKernel = reportKernel()) {
  return expandAgentTools(
    {
      rationale: 'Present the supplied observations.',
      commands: [{ command: 'tool', args: { name: 'report.page', input } }],
    },
    kernel,
  );
}

/** Actual expansion, validation and one atomic application; every successful case also proves Undo. */
function apply(input: unknown, lang: 'en' | 'ar' = 'en') {
  const kernel = reportKernel(lang);
  const before = kernel.getDocument();
  const expanded = expand(input, kernel);
  expect(expanded.issues).toEqual([]);
  const valid = validateAiPlan(expanded.plan, kernel, {
    clock: fixedClock(2),
    ids: seededIds('page-capabilities'),
  });
  expect(valid.ok, JSON.stringify(valid)).toBe(true);
  if (!valid.ok) throw new Error('Expected a valid report page.');
  kernel.dispatchGroup(valid.plan.commands);
  const document = kernel.getDocument();
  const order = document.nodes['root']?.slots?.['default'] ?? [];
  const nodes = order.flatMap((id) => {
    const node = document.nodes[id];
    return node === undefined || before.nodes[id] !== undefined ? [] : [node];
  });
  expect(nodes.length).toBeGreaterThan(0);
  kernel.undo();
  expect(kernel.getDocument()).toEqual(before);
  return nodes;
}

interface Card {
  readonly label: string;
  readonly value: string;
  readonly change?: string;
  readonly sentiment?: string;
  readonly trend?: readonly number[];
  readonly progress?: number;
  readonly progressLabel?: string;
}

const TYPES: Readonly<Record<ChartType, string>> = {
  bar: MARKETING,
  hbar: MARKETING,
  line: 'Month,Visits\nJan,10\nFeb,20\nMar,30',
  area: 'Month,Visits\nJan,10\nFeb,20\nMar,30',
  combo: MARKETING,
  scatter: 'Spend,Conversions\n10,2\n20,3\n30,5',
  radar: 'Metric,Actual,Target\nQuality,80,90\nSpeed,70,80\nCoverage,95,100',
  funnel: 'Stage,Visitors\nView,1000\nSignup,200\nPurchase,50',
  gauge: 'Team,Actual,Max,Target\nA,80,100,90\nB,95,100,90',
  sparkline: 'Month,Visits\nJan,10\nFeb,20\nMar,30',
  pie: 'Channel,Visits\nEmail,10\nSearch,20\nSocial,5',
  donut: 'Channel,Visits\nEmail,10\nSearch,20\nSocial,5',
  waterfall: 'Stage,Change\nOpening,100\nIncome,60\nCosts,-40',
  heatmap: 'Channel,Mon,Tue\nEmail,10,15\nSearch,20,30',
  treemap: 'Channel,Visits\nEmail,10\nSearch,20\nSocial,5',
  histogram: 'Hours\n1\n2\n2\n4\n5',
  bubble: 'Spend,Conversions,Audience\n10,2,100\n20,3,200\n30,5,500',
  boxplot: 'Team,Min,Q1,Median,Q3,Max\nA,1,3,5,7,9\nB,2,4,6,8,10',
  candlestick: 'Date,Open,High,Low,Close\n2026-01-01,10,14,8,12\n2026-01-02,12,15,10,13',
  lollipop: 'Project,Variance\nA,10\nB,-5\nC,3',
  bullet: 'Team,Actual,Target\nA,80,100\nB,120,100',
};

describe('professional report.page presentations', () => {
  it.each(REPORT_PRESENTATIONS)(
    'applies the %s presentation through the kernel and Undo',
    (presentation) => {
      const nodes = apply({ data: FINANCE, presentation });
      expect(nodes[0]?.type).toBe('stats');
      expect(nodes.filter((node) => node.type === 'chart').length).toBeGreaterThan(0);
    },
  );

  it('keeps executive findings ahead of two key charts and permits opting the source table back in', () => {
    const nodes = apply({ data: FINANCE, presentation: 'executive' });
    expect(nodes.map((node) => node.type)).toEqual(['stats', 'richText', 'chart', 'chart']);
    const cards = nodes[0]?.props['items'] as unknown as readonly Card[];
    expect(cards).toHaveLength(4);
    expect(cards[0]).toMatchObject({
      label: 'Revenue · latest',
      value: '$300',
      change: '+50.0% vs previous',
      sentiment: 'neutral',
      trend: [100, 200, 300],
    });
    expect(cards.map((card) => card.label)).toEqual([
      'Revenue · latest',
      'Costs · latest',
      'Profit · total',
      'Margin',
    ]);
    const withData = apply({ data: FINANCE, presentation: 'executive', includeData: true });
    expect(withData.at(-1)?.props['title']).toBe('The data');
  });

  it('prioritizes finance comparisons and computes weighted margin from the same paired source rows', () => {
    const nodes = apply({ data: FINANCE, presentation: 'financial', includeData: false });
    expect(nodes[1]?.props['chartType']).toBe('combo');
    const cards = nodes[0]?.props['items'] as unknown as readonly Card[];
    expect(cards).toContainEqual(
      expect.objectContaining({ label: 'Profit · total', value: '$400' }),
    );
    expect(cards).toContainEqual(expect.objectContaining({ label: 'Margin', value: '66.7%' }));
    expect(nodes.some((node) => node.props['title'] === 'The data')).toBe(false);
    expect(nodes.at(-1)?.props['title']).toBe('Summary by measure');
  });

  it('shows observed operational latest values, comparison badges and target attainment', () => {
    const nodes = apply({ data: OPERATIONS, presentation: 'operational' });
    const cards = nodes[0]?.props['items'] as unknown as readonly Card[];
    expect(cards[0]).toMatchObject({
      label: 'Actual · latest',
      value: '125',
      change: '+56.3% vs previous',
      trend: [40, 80, 125],
    });
    expect(cards.find((card) => card.label === 'Attainment')).toMatchObject({
      value: '98.0%',
      progress: 98,
      progressLabel: '98.0% of target',
      trend: [80, 80, 125],
    });
    const over = apply({
      data: 'Month,Actual,Target\nJan,120,100\nFeb,140,100',
      presentation: 'operational',
    });
    const overCards = over[0]?.props['items'] as unknown as readonly Card[];
    expect(overCards.find((card) => card.label === 'Attainment')).toMatchObject({
      value: '130.0%',
      progress: 100,
      progressLabel: '130.0% of target',
    });
  });

  it('ranks marketing channels without inventing targets, finances or chronological sparklines', () => {
    const nodes = apply({ data: MARKETING, presentation: 'comparison' });
    expect(nodes[1]?.props['categories']).toEqual(['Search', 'Email', 'Social']);
    const cards = nodes[0]?.props['items'] as unknown as readonly Card[];
    expect(cards.map((card) => card.label)).toEqual(['Visits · total', 'Conversions · total']);
    expect(cards.every((card) => card.progress === undefined && card.trend === undefined)).toBe(
      true,
    );
    const finance = apply({ data: MARKETING, presentation: 'financial' });
    expect(JSON.stringify(finance)).not.toMatch(/Profit|Margin|Attainment/u);
  });

  it('retains missing-data caveats and does not fill sparse trends or compare an absent latest period', () => {
    const nodes = apply({
      data: 'Month,Actual,Target\nJan,40,50\nFeb,80,100\nMar,,100',
      presentation: 'operational',
    });
    const cards = nodes[0]?.props['items'] as unknown as readonly Card[];
    expect(cards[0]).toMatchObject({ label: 'Actual · total', value: '120' });
    expect(cards[0]?.trend).toBeUndefined();
    expect(cards[0]?.change).toBeUndefined();
    expect(JSON.stringify(nodes)).toContain('missing');
    expect(cards.find((card) => card.label === 'Attainment')?.value).toBe('80.0%');
  });

  it('bounds trends to 24 actual periods and produces localized Arabic target labels', () => {
    const rows = Array.from(
      { length: 30 },
      (_, index) => `Day ${String(index + 1)},${String(index + 1)}`,
    );
    const nodes = apply({ data: `Day,Actual\n${rows.join('\n')}`, presentation: 'executive' });
    const cards = nodes[0]?.props['items'] as unknown as readonly Card[];
    expect(cards[0]?.trend).toEqual(Array.from({ length: 24 }, (_, index) => index + 7));
    const arabic = apply(
      { data: 'الشهر,الفعلي,الهدف\nيناير,80,100\nفبراير,120,100', presentation: 'operational' },
      'ar',
    );
    expect(JSON.stringify(arabic)).toContain('من الهدف');
    expect(JSON.stringify(arabic)).toContain('عن السابق');
  });
});

describe('explicit report.page charts', () => {
  it.each(CHART_TYPES)(
    'preserves the requested %s family through validation, application and Undo',
    (as) => {
      const nodes = apply({
        data: TYPES[as],
        charts: [{ as, title: `Requested ${as}` }],
        includeData: false,
      });
      const charts = nodes.filter((node) => node.type === 'chart');
      expect(charts).toHaveLength(1);
      expect(charts[0]?.props).toMatchObject({ chartType: as, title: `Requested ${as}` });
    },
  );

  it('selects ordered columns, sorts unambiguous chart periods and preserves the original table', () => {
    const nodes = apply({
      data: FINANCE,
      charts: [
        { as: 'line', columns: ['Month', 'Costs'] },
        { as: 'waterfall', columns: ['Month', 'Revenue'] },
      ],
    });
    const charts = nodes.filter((node) => node.type === 'chart');
    expect(charts[0]?.props).toMatchObject({
      categories: ['Jan', 'Feb', 'Mar'],
      series: [{ name: 'Costs', values: [40, 70, 90] }],
    });
    expect(charts[1]?.props).toMatchObject({ categories: ['Mar', 'Jan', 'Feb'] });
    expect(nodes.at(-1)?.props['rows']).toEqual([
      { cells: ['Mar', '$300', '$90'] },
      { cells: ['Jan', '$100', '$40'] },
      { cells: ['Feb', '$200', '$70'] },
    ]);
  });

  it('allows an explicit chart list to override executive automatic limits and an empty list to omit all charts', () => {
    const charts = [{ as: 'bar' }, { as: 'line' }, { as: 'hbar' }];
    const nodes = apply({ data: MARKETING, presentation: 'executive', charts });
    expect(
      nodes.filter((node) => node.type === 'chart').map((node) => node.props['chartType']),
    ).toEqual(['bar', 'line', 'hbar']);
    expect(apply({ data: FINANCE, charts: [] }).some((node) => node.type === 'chart')).toBe(false);
  });

  it.each([
    { input: { presentation: 'fictional' }, error: 'presentation' },
    { input: { includeData: 'yes' }, error: 'includeData' },
    { input: { charts: Array.from({ length: 7 }, () => ({ as: 'bar' })) }, error: 'six' },
    { input: { charts: [{ as: 'unknown' }] }, error: '.as' },
    { input: { charts: [{ as: 'bar', source: 'url' }] }, error: 'must be' },
    { input: { charts: [{ as: 'bar', columns: [] }] }, error: 'columns' },
    { input: { charts: [{ as: 'bar', title: '' }] }, error: 'title' },
    {
      input: { charts: [{ as: 'bar', columns: ['Month', 'Missing'] }] },
      error: 'no source column',
    },
    {
      input: { charts: [{ as: 'bar', columns: ['Month', 'Revenue', 'Revenue'] }] },
      error: 'selected twice',
    },
    { input: { charts: [{ as: 'boxplot' }] }, error: 'exactly 5' },
    { input: { data: 'Month,Sales\nJan,10\nFeb,', charts: [{ as: 'line' }] }, error: 'missing' },
    {
      input: { data: 'Team,Actual,Target\nA,-10,100', charts: [{ as: 'bullet' }] },
      error: 'nonnegative',
    },
    {
      input: { data: 'Team,Min,Q1,Median,Q3,Max\nA,1,3,2,7,9', charts: [{ as: 'boxplot' }] },
      error: 'ordered',
    },
    { input: { data: 'Name,Note\nAlpha,Text' }, error: 'no column holds numbers' },
    { input: { data: 'Month,Sales' }, error: 'row' },
  ])('rejects invalid options/data before any document mutation ($error)', ({ input, error }) => {
    const kernel = reportKernel();
    const before = kernel.getDocument();
    const expanded = expand({ data: FINANCE, ...input }, kernel);
    expect(expanded.issues.length).toBeGreaterThan(0);
    expect(expanded.issues.map(({ message }) => message).join(' ')).toContain(error);
    expect(kernel.getDocument()).toEqual(before);
  });

  it('fails explicitly when a requested chart renderer is unavailable', () => {
    const base = reportKernel();
    const kernel = createBuilder({
      document: base.getDocument(),
      extensions: [
        {
          ...reportPageBlocks,
          contributes: {
            blocks:
              reportPageBlocks.contributes?.blocks?.filter(
                ({ schema }) => schema.type !== 'chart' && schema.type !== 'report',
              ) ?? [],
          },
        },
      ],
      ports: { clock: fixedClock(1), ids: seededIds('no-charts') },
    });
    const before = kernel.getDocument();
    const expanded = expand({ data: FINANCE, charts: [{ as: 'bar' }] }, kernel);
    expect(expanded.issues.map(({ message }) => message).join(' ')).toContain('no chart block');
    expect(kernel.getDocument()).toEqual(before);
  });
});
