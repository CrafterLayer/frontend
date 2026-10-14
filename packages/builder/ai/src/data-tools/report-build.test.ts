import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { validateAiPlan } from '../plan/validate-plan';
import { agentToolPrompt, agentToolPromptMaxChars } from '../tools/agent/catalog-prompt';
import { expandAgentTools } from '../tools/agent/expand';
import { agentTool, agentToolsForLane } from '../tools/agent/registry';
import { dataKernel as kernel } from './data-show.fixtures';

interface Built {
  readonly issues: readonly string[];
  readonly title?: string | undefined;
  readonly applied?: BuilderKernel;
}

/** Expand one report.build step, judge it with the real door, and apply it to a fresh kernel. */
function build(input: unknown): Built {
  const page = kernel();
  const expanded = expandAgentTools(
    { rationale: 'report', commands: [{ command: 'tool', args: { name: 'report.build', input } }] },
    page,
  );
  if (expanded.issues.length > 0) return { issues: expanded.issues.map(({ message }) => message) };
  const steps = (
    expanded.plan as {
      commands: { command: string; args: Record<string, unknown>; title?: string }[];
    }
  ).commands;
  const judged = validateAiPlan(expanded.plan, page, {
    clock: fixedClock(2),
    ids: seededIds('report-build-door'),
  });
  if (!judged.ok) return { issues: judged.issues.map(({ message }) => message) };
  page.dispatchGroup(steps.map(({ command, args }) => ({ command, args })));
  return { issues: [], title: steps[0]?.title, applied: page };
}

function report(page: BuilderKernel | undefined) {
  const document = page?.getDocument();
  const ids = (document?.nodes['root']?.slots as { default: string[] } | undefined)?.default ?? [];
  const id = ids.find((each) => document?.nodes[each]?.type === 'report');
  return { ids, node: id === undefined ? undefined : document?.nodes[id] };
}

const MONTHS = 'Month,Revenue,Costs\nJan,120,80\nFeb,135,90\nMar,160,85';

describe('report.build', () => {
  it('is listed for the edit and build lanes with its signature and data line', () => {
    expect(agentTool('report.build')?.lanes).toEqual(['edit', 'build']);
    for (const lane of ['edit', 'build'] as const) {
      expect(agentToolsForLane(lane).map(({ name }) => name)).toContain('report.build');
      const prompt = agentToolPrompt(lane);
      expect(prompt.length).toBeLessThanOrEqual(agentToolPromptMaxChars(lane));
      expect(prompt).toContain('report.build {data,title?,summary?,kpis?:[column],as?,after?}');
      expect(prompt).toContain('report.build data like data.show → title, KPIs (last + change');
    }
  });

  it('inserts a report above the footer: KPI cards from every numeric column, a line over time', () => {
    const result = build({ data: MONTHS, summary: 'Revenue grew while costs held.' });
    expect(result.issues).toEqual([]);
    const { ids, node } = report(result.applied);
    expect(ids.at(-1)).toBe('footer-1');
    expect(ids.indexOf(node?.id ?? '')).toBe(ids.length - 2);
    expect(node?.props).toMatchObject({
      title: 'Revenue · Costs',
      summary: 'Revenue grew while costs held.',
      chartType: 'line',
      categories: ['Jan', 'Feb', 'Mar'],
      series: [
        { name: 'Revenue', values: [120, 135, 160] },
        { name: 'Costs', values: [80, 90, 85] },
      ],
      kpis: [
        { label: 'Revenue', series: 0, measure: 'last', better: 'up' },
        { label: 'Costs', series: 1, measure: 'last', better: 'down' },
      ],
    });
    expect(result.title).toBe('Report · Revenue · Costs');
  });

  it('makes the cards named, with their own measure, and places the report after a section', () => {
    const result = build({
      data: MONTHS,
      title: 'First quarter',
      kpis: ['costs', { column: 'Revenue', measure: 'total', label: 'Revenue this quarter' }],
      as: 'combo',
      after: 'stats-1',
    });
    expect(result.issues).toEqual([]);
    const { ids, node } = report(result.applied);
    expect(ids.indexOf(node?.id ?? '')).toBe(1);
    expect(node?.props).toMatchObject({
      title: 'First quarter',
      chartType: 'combo',
      kpis: [
        { label: 'Costs', series: 1, measure: 'last', better: 'down' },
        { label: 'Revenue this quarter', series: 0, measure: 'total', better: 'up' },
      ],
    });
  });

  it('reads Arabic headings, Arabic digits and a currency, and knows an Arabic cost', () => {
    const result = build({
      data: 'الشهر,المبيعات,المصاريف\nيناير,"١٬٢٠٠ ر.س","٨٠٠ ر.س"\nفبراير,"١٬٥٠٠ ر.س","٧٥٠ ر.س"',
    });
    expect(result.issues).toEqual([]);
    expect(report(result.applied).node?.props).toMatchObject({
      chartType: 'line',
      valueSuffix: ' ر.س',
      series: [
        { name: 'المبيعات', values: [1200, 1500] },
        { name: 'المصاريف', values: [800, 750] },
      ],
      kpis: [
        { label: 'المبيعات', better: 'up' },
        { label: 'المصاريف', better: 'down' },
      ],
    });
  });

  it('keeps at most four cards and draws bars where the data asks for a gauge', () => {
    const wide = build({ data: 'Q,A,B,C,D,E\nQ1,1,2,3,4,5\nQ2,2,3,4,5,6' });
    expect((report(wide.applied).node?.props['kpis'] as unknown[]).length).toBe(4);
    const gauge = build({ data: 'Metric,Score,Max\nNPS,72,100' });
    expect(report(gauge.applied).node?.props['chartType']).toBe('bar');
  });

  it.each([
    [{ data: MONTHS, kpis: ['Profit'] }, 'no numeric column "Profit"; use one of Revenue, Costs'],
    [{ data: MONTHS, kpis: ['A', 'B', 'C', 'D', 'E'] }, 'at most 4 column headings'],
    [{ data: MONTHS, kpis: [{ column: 'Revenue', measure: 'median' }] }, '"measure" is one of'],
    [{ data: MONTHS, as: 'gauge' }, '"as" is one of auto, bar'],
    [{ data: 'Name,Role\nAda,Engineer' }, 'use data.show with "as":"table"'],
    [{ data: MONTHS, after: 'nope' }, '"after": no section "nope"'],
    [{ data: MONTHS, colour: 'red' }, 'unknown keys colour'],
  ])('refuses %j with the fix', (input, error) => {
    expect(build(input).issues.join(' ')).toContain(error);
  });
});
