import { describe, expect, it } from 'vitest';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { expandAgentTools } from '../tools/agent/expand';
import { validateAiPlan } from '../plan/validate-plan';
import { chartDataFor, type ChartType } from './data-chart';
import { readDataText } from './data-text';
import { dataKernel } from './data-show.fixtures';

const DATA: readonly [ChartType, string][] = [
  ['waterfall', 'Step,Change\nOpening,100\nSales,60\nCosts,-40'],
  ['heatmap', 'Day,Team A,Team B\nMon,4,6\nTue,8,2'],
  ['treemap', 'Channel,Revenue\nSearch,60\nEmail,40'],
  ['histogram', 'Duration\n1\n2\n3\n4\n8\n9'],
  ['bubble', 'Spend,Conversions,Reach\n10,5,100\n20,12,200'],
  ['boxplot', 'Team,Min,Q1,Median,Q3,Max\nA,1,2,3,4,8\nB,2,3,5,7,9'],
  ['candlestick', 'Date,Open,High,Low,Close\n2026-10-01,10,14,8,12\n2026-10-02,12,13,7,8'],
  ['lollipop', 'Project,Variance\nA,-4\nB,7'],
  ['bullet', 'Team,Actual,Target\nA,70,100\nB,120,100'],
];

function prepared(data: string, type: ChartType) {
  const result = readDataText(data);
  if (!result.ok) throw new Error(result.error);
  return chartDataFor(result.grid, type);
}

describe('professional chart contracts', () => {
  it.each(DATA)('applies %s through data.show and one Undo restores the page', (as, data) => {
    const kernel = dataKernel();
    const before = kernel.getDocument();
    const expanded = expandAgentTools(
      {
        rationale: 'Show supplied data',
        commands: [{ command: 'tool', args: { name: 'data.show', input: { as, data } } }],
      },
      kernel,
    );
    expect(expanded.issues).toEqual([]);
    const judged = validateAiPlan(expanded.plan, kernel, {
      clock: fixedClock(2),
      ids: seededIds(as),
    });
    expect(judged.ok).toBe(true);
    if (!judged.ok) throw new Error(JSON.stringify(judged.issues));
    kernel.dispatchGroup(judged.plan.commands);
    expect(
      Object.values(kernel.getDocument().nodes).some((node) => node.props['chartType'] === as),
    ).toBe(true);
    kernel.undo();
    expect(kernel.getDocument()).toEqual(before);
  });

  it.each(DATA)('supports %s inside a compact report', (as, data) => {
    const kernel = dataKernel();
    const expanded = expandAgentTools(
      {
        rationale: 'Report supplied data',
        commands: [{ command: 'tool', args: { name: 'report.build', input: { as, data } } }],
      },
      kernel,
    );
    expect(expanded.issues).toEqual([]);
    const judged = validateAiPlan(expanded.plan, kernel, {
      clock: fixedClock(2),
      ids: seededIds(as),
    });
    expect(judged.ok).toBe(true);
  });

  it('bins raw observations without losing any count or applying source currency to counts', () => {
    const result = prepared('Price\n$10\n$10\n$20\n$30', 'histogram');
    expect(result).toMatchObject({ series: [{ name: 'Count', values: [2, 2] }] });
    expect(typeof result === 'string' ? undefined : result.prefix).toBeUndefined();
    expect(typeof result === 'string' ? '' : result.notes.join(' ')).toContain('$');
  });

  it.each([
    ['boxplot', 'Group,Min,Q1,Median,Q3,Max\nA,1,5,3,7,9', 'ordered'],
    ['candlestick', 'Day,Open,High,Low,Close\nA,10,9,8,12', 'enclose'],
    ['bubble', 'X,Y,Size\n1,2,-1', 'nonnegative'],
    ['bullet', 'Team,Actual,Target\nA,2', 'exactly 2'],
    ['treemap', 'A,V\nx,-2', 'nonnegative'],
    ['waterfall', 'A,V\nx,1\ny,', 'missing'],
    ['heatmap', 'A,X,Y\nx,$2,3%', 'different units'],
    ['histogram', 'V\n$10\n20%', 'same unit'],
  ] as const)('rejects invalid %s instead of inventing data', (as, data, error) => {
    expect(prepared(data, as)).toContain(error);
  });

  it('accepts a Y unit while keeping bubble Size unitless', () => {
    const result = prepared('X,Sales,Reach\n1,$20,100\n2,$40,200', 'bubble');
    expect(result).toMatchObject({ prefix: '$', series: [{ name: 'Sales' }, { name: 'Reach' }] });
  });

  it.each(['X,Y,Size\n1,10,5%\n2,20,8%', 'X,Y,Size\n$1,10,5\n$2,20,8'])(
    'refuses bubble units that its X/Size roles cannot represent',
    (data) => {
      expect(prepared(data, 'bubble')).toContain('X and Size must be unitless');
    },
  );

  it('refuses intervening text columns instead of losing positional bubble units', () => {
    expect(prepared('X,Label,Y,Size\n1,A,10,5%\n2,B,20,8%', 'bubble')).toContain(
      'exactly three columns',
    );
  });

  it('keeps close histogram interval bounds distinct and conserves observations', () => {
    const data = prepared('Value\n1.000001\n1.000002', 'histogram');
    if (typeof data === 'string') throw new Error(data);
    expect(new Set(data.categories).size).toBe(2);
    expect(data.categories.every((category) => category !== '1–1')).toBe(true);
    expect(data.series[0]?.values).toEqual([1, 1]);
  });
});
