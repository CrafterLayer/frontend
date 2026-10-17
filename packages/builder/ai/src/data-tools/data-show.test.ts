import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { validateAiPlan } from '../plan/validate-plan';
import { expandAgentTools } from '../tools/agent/expand';
import { agentToolPrompt, agentToolPromptMaxChars } from '../tools/agent/catalog-prompt';
import { agentTool, agentToolsForLane } from '../tools/agent/registry';
import { dataKernel as kernel } from './data-show.fixtures';

interface Shown {
  readonly issues: readonly string[];
  readonly steps: readonly {
    readonly command: string;
    readonly args: Record<string, unknown>;
    readonly title?: string;
  }[];
  readonly applied?: BuilderKernel;
}

/** Expand one data.show step, judge it with the real door, and apply it to a fresh kernel. */
function show(input: unknown): Shown {
  const page = kernel();
  const expanded = expandAgentTools(
    { rationale: 'chart it', commands: [{ command: 'tool', args: { name: 'data.show', input } }] },
    page,
  );
  const steps = (expanded.plan as { commands: Shown['steps'] }).commands;
  if (expanded.issues.length > 0)
    return { issues: expanded.issues.map(({ message }) => message), steps };
  const judged = validateAiPlan(expanded.plan, page, {
    clock: fixedClock(2),
    ids: seededIds('data-show-door'),
  });
  if (!judged.ok) return { issues: judged.issues.map(({ message }) => message), steps };
  page.dispatchGroup(steps.map(({ command, args }) => ({ command, args })));
  return { issues: [], steps, applied: page };
}

function inserted(page: BuilderKernel | undefined) {
  const document = page?.getDocument();
  const ids = (document?.nodes['root']?.slots as { default: string[] } | undefined)?.default ?? [];
  const id = ids.find(
    (each) => !['stats-1', 'chart-1', 'table-1', 'plans-1', 'footer-1'].includes(each),
  );
  return { ids, node: id === undefined ? undefined : document?.nodes[id] };
}

describe('data.show', () => {
  it('is listed for the edit and build lanes with its signature and data line', () => {
    expect(agentTool('data.show')?.lanes).toEqual(['edit', 'build']);
    for (const lane of ['edit', 'build'] as const) {
      expect(agentToolsForLane(lane).map(({ name }) => name)).toContain('data.show');
      const prompt = agentToolPrompt(lane);
      expect(prompt.length).toBeLessThanOrEqual(agentToolPromptMaxChars(lane));
      expect(prompt).toContain('data.show {data,as?,id?,after?,title?,caption?}');
      expect(prompt).toContain(
        'as?:auto|table|bar|hbar|line|area|combo|scatter|radar|funnel|gauge|sparkline|pie|donut',
      );
    }
  });

  it('inserts a line chart for data over time, above the footer', () => {
    const result = show({
      data: 'Month,Bookings,Walk-ins\nJan,120,40\nFeb,135,38\nMar,160,52',
      title: 'Bookings since January',
    });
    expect(result.issues).toEqual([]);
    const { ids, node } = inserted(result.applied);
    expect(ids.at(-1)).toBe('footer-1');
    expect(ids.indexOf(node?.id ?? '')).toBe(ids.length - 2);
    expect(node?.type).toBe('chart');
    expect(node?.props).toMatchObject({
      chartType: 'line',
      title: 'Bookings since January',
      categories: ['Jan', 'Feb', 'Mar'],
      series: [
        { name: 'Bookings', values: [120, 135, 160] },
        { name: 'Walk-ins', values: [40, 38, 52] },
      ],
    });
    expect(result.steps[0]?.title).toBe('Chart · Bookings since January');
  });

  it('reads currency and Arabic digits into a bar chart with a shared prefix', () => {
    const result = show({
      data: 'Branch,Revenue\nNorth,$1,200\nSouth,"$١٬٥٠٠"\nEast,$900',
      after: 'stats-1',
    });
    expect(result.issues).toEqual([]);
    const { ids, node } = inserted(result.applied);
    expect(ids.indexOf(node?.id ?? '')).toBe(1);
    expect(node?.props).toMatchObject({
      chartType: 'bar',
      valuePrefix: '$',
      series: [{ name: 'Revenue', values: [1200, 1500, 900] }],
    });
  });

  it('draws shares of 100% as a donut', () => {
    const result = show({ data: 'Channel,Share\nSearch,45%\nSocial,30%\nEmail,25%' });
    expect(inserted(result.applied).node?.props).toMatchObject({
      chartType: 'donut',
      valueSuffix: '%',
    });
  });

  it('turns rows into series when the headings are the times', () => {
    const result = show({ data: 'Metric,2022,2023,2024\nRevenue,10,14,19\nCosts,8,9,11' });
    expect(inserted(result.applied).node?.props).toMatchObject({
      chartType: 'line',
      categories: ['2022', '2023', '2024'],
      series: [
        { name: 'Revenue', values: [10, 14, 19] },
        { name: 'Costs', values: [8, 9, 11] },
      ],
    });
  });

  it('makes a table of text, numbers aligned to the end and markdown alignment kept', () => {
    const result = show({
      data: 'Service,Duration,Price\nConsultation,30 min,$40\nAssessment,60 min,$90',
      caption: 'Prices include VAT.',
    });
    expect(result.issues).toEqual([]);
    const node = inserted(result.applied).node;
    expect(node?.type).toBe('table');
    expect(node?.props).toMatchObject({
      caption: 'Prices include VAT.',
      columns: [
        { label: 'Service', align: 'start' },
        { label: 'Duration', align: 'end' },
        { label: 'Price', align: 'end' },
      ],
      rows: [
        { cells: ['Consultation', '30 min', '$40'] },
        { cells: ['Assessment', '60 min', '$90'] },
      ],
    });
    const markdown = show({ data: '| Day | Opens |\n|---|:---:|\n| Mon | 9:00 |', as: 'table' });
    expect(inserted(markdown.applied).node?.props['columns']).toEqual([
      { label: 'Day', align: 'start' },
      { label: 'Opens', align: 'center' },
    ]);
  });

  it('refills an existing chart, keeping its type, and an existing table', () => {
    const chart = show({ id: 'chart-1', data: 'Q,Sales\nQ1,5\nQ2,7' });
    expect(chart.issues).toEqual([]);
    expect(chart.applied?.getDocument().nodes['chart-1']?.props).toMatchObject({
      chartType: 'area',
      categories: ['Q1', 'Q2'],
      series: [{ name: 'Sales', values: [5, 7] }],
    });
    const table = show({
      id: 'table-1',
      data: [
        ['Name', 'Role'],
        ['Ada', 'Engineer'],
      ],
    });
    expect(table.issues).toEqual([]);
    expect(table.applied?.getDocument().nodes['table-1']?.props['rows']).toEqual([
      { cells: ['Ada', 'Engineer'] },
    ]);
  });

  it('switches an existing chart to the type asked for', () => {
    const result = show({ id: 'chart-1', data: 'Q,Sales\nQ1,5\nQ2,7', as: 'bar' });
    expect(result.applied?.getDocument().nodes['chart-1']?.props['chartType']).toBe('bar');
  });

  it.each([
    [{ id: 'stats-1', data: 'A,B\nx,1' }, 'is a stats block, not a chart or table'],
    [{ id: 'plans-1', data: 'A,B\nx,1' }, 'not a chart or table'],
    [{ id: 'nope', data: 'A,B\nx,1' }, 'no block "nope"'],
    [{ id: 'table-1', data: 'A,B\nx,1', as: 'bar' }, 'is a table'],
    [{ after: 'nope', data: 'A,B\nx,1' }, '"after": no section "nope"'],
    [{ id: 'chart-1', after: 'stats-1', data: 'A,B\nx,1' }, 'send one of them'],
    [{ data: 'A,B\nx,1', as: 'bubble' }, '"as" is one of'],
    [{ data: 'A,B\nx,1', as: 'radar' }, 'a radar needs 3 to 12 categories'],
    [
      { data: 'Name,Score\nAda,1\nGrace,2', as: 'scatter' },
      'a scatter needs numbers in the first column',
    ],
    [{ data: 'A,B\nx,1', colour: 'red' }, 'unknown keys colour'],
    [{ data: 'Name,Role\nAda,Engineer', as: 'bar' }, 'no column after the first holds numbers'],
    [
      {
        data: `Day,Visits\n${Array.from({ length: 30 }, (_, day) => `D${String(day)},${String(day)}`).join('\n')}`,
        as: 'line',
      },
      'at most 24 categories',
    ],
    [{ data: ',Sales\n,5' }, 'category 1 has no label'],
    [{ data: 'A' }, 'header line and at least one row'],
  ])('refuses %j with the fix', (input, error) => {
    expect(show(input).issues.join(' ')).toContain(error);
  });

  it('says what it left out', () => {
    const run = agentTool('data.show');
    const page = kernel();
    const parsed = run?.parse({
      data: 'Region,Sales,Leader\nNorth,5,Ada\nSouth,7,Grace',
      as: 'pie',
    });
    if (parsed?.ok !== true) throw new Error('parse failed');
    const result = run?.run(parsed.value, {
      kernel: page,
      readProp: (id, key) => page.getDocument().nodes[id]?.props[key],
      locale: { lang: 'en', dir: 'ltr' },
      sampleValues: [],
    });
    expect(result).toMatchObject({
      ok: true,
      note: 'pie chart · 2 categories · text columns left out of the chart: Leader',
    });
  });
});
