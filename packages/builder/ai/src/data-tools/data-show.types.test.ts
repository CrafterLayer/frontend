import { describe, expect, it } from 'vitest';

import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { validateAiPlan } from '../plan/validate-plan';
import { expandAgentTools } from '../tools/agent/expand';
import { agentTool } from '../tools/agent/registry';
import { autoChart, chartData, chartDataFor } from './data-chart';
import { dataKernel } from './data-show.fixtures';
import { readDataText, type DataGrid } from './data-text';

/*
  data.show's chart types added on 2026-10-12, judged by the real door: horizontal bars for
  long labels, a scatter for numbers against a numeric first column, a gauge for one value
  beside a Max column, a funnel for narrowing stages when the words say so — and every type
  asked for by name.
*/

function grid(text: string): DataGrid {
  const read = readDataText(text);
  if (!read.ok) throw new Error(read.error);
  return read.grid;
}

function auto(text: string, words = ''): string {
  const rows = grid(text);
  const data = chartData(rows);
  if (typeof data === 'string') throw new Error(data);
  return autoChart(rows, data, words);
}

/** The chart data.show inserts for this input, after the door has judged it. */
function inserted(input: Record<string, unknown>) {
  const page = dataKernel();
  const expanded = expandAgentTools(
    { rationale: 'chart it', commands: [{ command: 'tool', args: { name: 'data.show', input } }] },
    page,
  );
  if (expanded.issues.length > 0)
    return { error: expanded.issues.map((issue) => issue.message).join(' ') };
  const judged = validateAiPlan(expanded.plan, page, {
    clock: fixedClock(2),
    ids: seededIds('data-show-types'),
  });
  if (!judged.ok) return { error: judged.issues.map((issue) => issue.message).join(' ') };
  const steps = (
    expanded.plan as { commands: { command: string; args: Record<string, unknown> }[] }
  ).commands;
  page.dispatchGroup(steps.map(({ command, args }) => ({ command, args })));
  const ids = (page.getDocument().nodes['root']?.slots as { default: string[] }).default;
  const id = ids.find(
    (each) => !['stats-1', 'chart-1', 'table-1', 'plans-1', 'footer-1'].includes(each),
  );
  return { props: id === undefined ? undefined : page.getDocument().nodes[id]?.props };
}

describe('data.show — choosing the added chart types', () => {
  it('lays long labels across as horizontal bars', () => {
    expect(
      auto('Reason,Share\nClose to home or work,41\nRecommended by a friend,27\nPrice,13'),
    ).toBe('hbar');
    expect(auto('Branch,Sales\nNorth,4\nSouth,6')).toBe('bar');
  });

  it('plots numbers against a numeric first column as a scatter, but years as a line', () => {
    expect(auto('Spend,Revenue\n500,2100\n800,2900\n1200,4300')).toBe('scatter');
    expect(auto('Year,Revenue\n2022,10\n2023,14\n2024,19')).toBe('line');
  });

  it('draws one value beside a Max column as a gauge, with its target', () => {
    expect(auto('Metric,Score,Max,Target\nSatisfaction,86,100,90')).toBe('gauge');
    expect(auto('Score,Max\n82,100')).toBe('gauge');
    const data = chartDataFor(grid('Metric,Score,Max,Target\nSatisfaction,86,100,90'), 'gauge');
    expect(data).toMatchObject({
      categories: ['Satisfaction'],
      series: [{ name: 'Score', values: [86] }],
      maxValue: 100,
      targetValue: 90,
    });
    /* A Max that changes from row to row is a series, not a dial's end. */
    expect(auto('Branch,Seats,Max\nNorth,40,60\nSouth,30,80')).toBe('bar');
  });

  it('draws narrowing stages as a funnel only when the words say funnel', () => {
    const stages = 'Stage,People\nVisitors,12000\nSign-ups,3100\nTrials,1400\nPaying,600';
    expect(auto(stages, 'Sales funnel')).toBe('funnel');
    expect(auto(stages, 'قمع المبيعات')).toBe('funnel');
    expect(auto(stages)).toBe('bar');
    expect(auto('Stage,People\nA,10\nB,30\nC,5', 'funnel')).toBe('bar');
  });
});

describe('data.show — the added types through the door', () => {
  it('inserts a gauge with its dial end and target', () => {
    const { props, error } = inserted({ data: 'Metric,Score,Max,Target\nNPS,72,100,80' });
    expect(error).toBeUndefined();
    expect(props).toMatchObject({ chartType: 'gauge', maxValue: 100, targetValue: 80 });
  });

  it('writes a scatter’s x values as plain numbers', () => {
    const { props } = inserted({ data: 'Spend,Revenue\n"$1,200",4300\n$500,2100\n1.5k,5200' });
    expect(props).toMatchObject({
      chartType: 'scatter',
      categories: ['1200', '500', '1500'],
      series: [{ name: 'Revenue', values: [4300, 2100, 5200] }],
    });
  });

  it('inserts a funnel from the title’s words and horizontal bars for long labels', () => {
    expect(
      inserted({
        data: 'Stage,People\nVisitors,900\nLeads,300\nCustomers,40',
        title: 'Our sales funnel',
      }).props?.['chartType'],
    ).toBe('funnel');
    expect(
      inserted({
        data: 'Question,Yes\nWould you recommend us to a friend,82\nWould you come back,91',
      }).props?.['chartType'],
    ).toBe('hbar');
  });

  it.each(['hbar', 'combo', 'radar', 'sparkline', 'funnel', 'gauge'])(
    'draws "as":"%s" when asked',
    (as) => {
      const { props, error } = inserted({
        data: 'Skill,Ours,Theirs\nPrice,7,8\nQuality,8,7\nSupport,9,5',
        as,
      });
      expect(error).toBeUndefined();
      expect(props?.['chartType']).toBe(as);
    },
  );

  it('says a funnel plots the first series only', () => {
    const tool = agentTool('data.show');
    const page = dataKernel();
    const parsed = tool?.parse({ data: 'S,A,B\nx,3,2\ny,2,2\nz,1,2', as: 'funnel' });
    if (parsed?.ok !== true) throw new Error('parse failed');
    const result = tool?.run(parsed.value, {
      kernel: page,
      readProp: (id, key) => page.getDocument().nodes[id]?.props[key],
      locale: { lang: 'en', dir: 'ltr' },
      sampleValues: [],
    });
    expect(result).toMatchObject({
      ok: true,
      note: 'funnel chart · 3 categories · a funnel plots the first series only',
    });
  });
});
