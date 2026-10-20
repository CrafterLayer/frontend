import { describe, expect, it } from 'vitest';
import type { BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { expandAgentTools } from '../tools/agent/expand';
import { validateAiPlan } from '../plan/validate-plan';
import { dataKernel } from './data-show.fixtures';
import { readDataRequest } from './direct-data';

function apply(kernel: BuilderKernel, input: unknown) {
  const expanded = expandAgentTools(
    {
      rationale: 'Report supplied figures',
      commands: [{ command: 'tool', args: { name: 'report.build', input } }],
    },
    kernel,
  );
  if (expanded.issues.length > 0) return expanded.issues.map((issue) => issue.message).join(' ');
  const judged = validateAiPlan(expanded.plan, kernel, {
    clock: fixedClock(3),
    ids: seededIds('report-update'),
  });
  if (!judged.ok) return judged.issues.map((issue) => issue.message).join(' ');
  kernel.dispatchGroup(judged.plan.commands);
  return undefined;
}

describe('professional compact reports', () => {
  it('preserves configured KPI semantics when refreshing and reordering source columns', () => {
    const kernel = dataKernel();
    const card = {
      column: 'Revenue',
      label: 'Typical revenue',
      measure: 'median',
      better: 'up',
      target: 200,
      comparisonValue: 90,
      detail: 'Approved baseline '.repeat(6).trim(),
    };
    expect(
      apply(kernel, { data: 'Month,Revenue,Costs\nJan,$100,$20\nFeb,$120,$30', kpis: [card] }),
    ).toBeUndefined();
    const report = Object.values(kernel.getDocument().nodes).find((node) => node.type === 'report');
    expect(
      apply(kernel, { id: report?.id, data: 'Month,Costs,Revenue\nMar,$40,$130\nApr,$50,$160' }),
    ).toBeUndefined();
    expect(kernel.getDocument().nodes[report?.id ?? '']?.props['kpis']).toEqual([
      {
        label: card.label,
        series: 1,
        measure: card.measure,
        better: card.better,
        target: card.target,
        comparisonValue: card.comparisonValue,
        detail: card.detail,
      },
    ]);
    const before = kernel.getDocument();
    expect(apply(kernel, { id: report?.id, data: 'Month,Revenue\nMay,12\nJun,18' })).toContain(
      'units changed',
    );
    expect(apply(kernel, { id: report?.id, data: 'Month,Orders\nMay,12\nJun,18' })).toContain(
      'source columns changed',
    );
    expect(kernel.getDocument()).toBe(before);
  });

  it('persists histogram source units and binning semantics visibly', () => {
    const kernel = dataKernel();
    expect(
      apply(kernel, { as: 'histogram', data: 'Price\n$10\n$20', summary: 'Sample prices' }),
    ).toBeUndefined();
    const report = Object.values(kernel.getDocument().nodes).find((node) => node.type === 'report');
    expect(report?.props['dataNote']).toContain('Equal-width bins of Price ($)');
    expect(report?.props['dataNote']).toContain('upper bounds excluded except the final bin');
    expect(apply(kernel, { id: report?.id, data: 'Price\n$20\n$40' })).toBeUndefined();
    expect(kernel.getDocument().nodes[report?.id ?? '']?.props['summary']).toBe('Sample prices');
    expect(kernel.getDocument().nodes[report?.id ?? '']?.props['dataNote']).toContain('Price ($)');
  });
  it('applies explicit comparisons, goals, median/count and eight cards from supplied columns', () => {
    const kernel = dataKernel();
    expect(
      apply(kernel, {
        data: 'Month,Revenue\nJan,100\nFeb,120\nMar,180',
        showTrends: true,
        showTable: false,
        kpis: [
          {
            column: 'Revenue',
            measure: 'median',
            target: 200,
            comparisonValue: 90,
            detail: 'Quarterly target',
          },
          { column: 'Revenue', measure: 'count', label: 'Periods' },
          ...Array.from({ length: 6 }, () => ({ column: 'Revenue', measure: 'last' })),
        ],
      }),
    ).toBeUndefined();
    const report = Object.values(kernel.getDocument().nodes).find((node) => node.type === 'report');
    expect(report?.props).toMatchObject({
      showTrends: true,
      showTable: false,
      kpis: [
        { measure: 'median', target: 200, comparisonValue: 90, detail: 'Quarterly target' },
        { measure: 'count', label: 'Periods' },
        {},
        {},
        {},
        {},
        {},
        {},
      ],
    });
  });

  it('updates the same report, preserves title/display, clears stale units and undoes once', () => {
    const kernel = dataKernel();
    expect(
      apply(kernel, {
        data: 'Month,Revenue\nJan,$100\nFeb,$120',
        title: 'Business overview',
        as: 'area',
        showTrends: true,
      }),
    ).toBeUndefined();
    const report = Object.values(kernel.getDocument().nodes).find((node) => node.type === 'report');
    expect(report).toBeDefined();
    const before = kernel.getDocument();
    expect(
      apply(kernel, { id: report?.id, data: 'Month,Orders\nJan,20\nFeb,35', kpis: ['Orders'] }),
    ).toBeUndefined();
    expect(
      Object.values(kernel.getDocument().nodes).filter((node) => node.type === 'report'),
    ).toHaveLength(1);
    expect(kernel.getDocument().nodes[report?.id ?? '']?.props).toMatchObject({
      title: 'Business overview',
      showTrends: true,
      chartType: 'area',
      valuePrefix: ' ',
      series: [{ name: 'Orders', values: [20, 35] }],
    });
    kernel.undo();
    expect(kernel.getDocument()).toEqual(before);
  });

  it.each([
    { id: 'chart-1', data: 'A,V\nx,2' },
    { id: 'missing', data: 'A,V\nx,2' },
    { data: 'A,V\nx,2', kpis: [{ column: 'V', target: Infinity }] },
    { data: 'A,V\nx,2', showTrends: 'true' },
    { data: 'A,X,Y\nx,$20,40%' },
  ])('refuses invalid report configuration without changing the document', (input) => {
    const kernel = dataKernel();
    const before = kernel.getDocument();
    expect(apply(kernel, input)).toBeTypeOf('string');
    expect(kernel.getDocument()).toBe(before);
  });
});

describe('explicit chart requests reach their tool without a model call', () => {
  it.each([
    ['Make a heatmap:', 'heatmap'],
    ['اعمل مخطط شلال:', 'waterfall'],
    ['Make a histogram:', 'histogram'],
    ['Create a boxplot:', 'boxplot'],
    ['ارسم مخطط شموع:', 'candlestick'],
    ['Draw a bullet chart:', 'bullet'],
    ['Make a bubble chart:', 'bubble'],
    ['Make a treemap:', 'treemap'],
    ['Draw a lollipop chart:', 'lollipop'],
  ])('preserves %s', (instruction, as) => {
    expect(readDataRequest(`${instruction}\nName,Value\nA,10\nB,20`)).toMatchObject({
      tool: 'data.show',
      input: { as },
    });
  });
  it('preserves a named family in a compact report or detailed report page', () => {
    expect(readDataRequest('Make a report with a heatmap:\nDay,A,B\nMon,1,2')).toMatchObject({
      tool: 'report.build',
      input: { as: 'heatmap' },
    });
    expect(
      readDataRequest('Make a detailed report with a heatmap:\nDay,A,B\nMon,1,2'),
    ).toMatchObject({ tool: 'report.page', input: { charts: [{ as: 'heatmap' }] } });
    expect(readDataRequest('اعمل تقرير تنفيذي:\nالشهر,المبيعات\nيناير,120')).toMatchObject({
      tool: 'report.page',
      input: { presentation: 'executive' },
    });
  });
  it('does not silently replace an unsupported named family with automatic bars', () => {
    expect(readDataRequest('Make a Sankey chart:\nName,Value\nA,10')).toBeUndefined();
  });
});
