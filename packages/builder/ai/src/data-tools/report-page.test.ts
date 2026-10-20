import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { validateAiPlan } from '../plan/validate-plan';
import { agentToolPrompt, agentToolPromptMaxChars } from '../tools/agent/catalog-prompt';
import { expandAgentTools } from '../tools/agent/expand';
import { agentTool, agentToolsForLane } from '../tools/agent/registry';
import { dataKernel } from './data-show.fixtures';
import { reportKernel } from './report-page.fixtures';

interface Inserted {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly title: string | undefined;
}

interface Built {
  readonly issues: readonly string[];
  readonly inserted: readonly Inserted[];
  readonly page?: BuilderKernel;
}

/** Expand one report.page step, judge it with the real door, and apply it. */
function build(input: unknown, page: BuilderKernel = reportKernel()): Built {
  const expanded = expandAgentTools(
    {
      rationale: 'report page',
      commands: [{ command: 'tool', args: { name: 'report.page', input } }],
    },
    page,
  );
  if (expanded.issues.length > 0)
    return { issues: expanded.issues.map(({ message }) => message), inserted: [] };
  const steps = (
    expanded.plan as {
      commands: { command: string; args: Record<string, unknown>; title?: string }[];
    }
  ).commands;
  const judged = validateAiPlan(expanded.plan, page, {
    clock: fixedClock(2),
    ids: seededIds('report-page-door'),
  });
  if (!judged.ok) return { issues: judged.issues.map(({ message }) => message), inserted: [] };
  page.dispatchGroup(steps.map(({ command, args }) => ({ command, args })));
  return {
    issues: [],
    page,
    inserted: steps.map(({ args, title }) => ({
      type: String(args['type']),
      props: args['props'] as Record<string, unknown>,
      title,
    })),
  };
}

const MONTHS = 'Month,Revenue,Costs\nJan,120,80\nFeb,135,90\nMar,160,85\nApr,150,95';
const REGIONS = 'Region,Sales\nNorth,"$1,200"\nSouth,$900\nEast,$400\nWest,$350';

function charts(built: Built) {
  return built.inserted.filter(({ type }) => type === 'chart').map(({ props }) => props);
}

function tables(built: Built) {
  return built.inserted.filter(({ type }) => type === 'table').map(({ props }) => props);
}

describe('report.page', () => {
  it('is in the edit and build lanes, its name paid for in both menus', () => {
    expect(agentTool('report.page')?.lanes).toEqual(['edit', 'build']);
    for (const lane of ['edit', 'build'] as const) {
      expect(agentToolsForLane(lane).map(({ name }) => name)).toContain('report.page');
      const prompt = agentToolPrompt(lane);
      expect(prompt.length).toBeLessThanOrEqual(agentToolPromptMaxChars(lane));
      expect(prompt.split('\n')).toContain('report.page');
      /* report.build and data.show keep their signatures. */
      expect(prompt).toContain(
        'report.build {data,title?,summary?,kpis?,as?,id?,after?,showTrends?,showTable?,stacked?}',
      );
      expect(prompt).toContain('data.show {data,as?,id?,after?,title?,caption?}');
    }
  });

  it('inserts a whole page above the footer, in order, every section judged by the door', () => {
    const built = build({ data: MONTHS, title: 'First four months', summary: 'Costs held.' });
    expect(built.issues).toEqual([]);
    expect(built.inserted.map(({ type }) => type)).toEqual([
      'stats',
      'chart',
      'chart',
      'richText',
      'table',
      'table',
    ]);
    const ids = (built.page?.getDocument().nodes['root']?.slots as { default: string[] }).default;
    expect(ids[0]).toBe('intro-1');
    expect(ids.at(-1)).toBe('footer-1');
    expect(ids).toHaveLength(8);
    expect(built.inserted[0]?.title).toBe('Report page · Header · First four months');
  });

  it('opens with the key stats of a timeline: total, average, latest with its change and CAGR, highest', () => {
    const [header] = build({ data: MONTHS, summary: 'Costs held.' }).inserted;
    expect(header?.props).toEqual({
      eyebrow: 'Jan → Apr',
      heading: 'Revenue report',
      body: 'Revenue rose 25.0% from Jan to Apr (120 → 150). Costs held.',
      items: [
        { value: '565', label: 'Revenue · total', detail: '4 rows' },
        { value: '141', label: 'Revenue · average', detail: 'median 143 · std. dev. 17.5' },
        { value: '150', label: 'Revenue · latest', detail: 'Apr · -6.3% vs previous · CAGR +7.7%' },
        { value: '160', label: 'Revenue · highest', detail: 'Mar' },
      ],
    });
  });

  it('keeps the unit on the key stats of categories: total, average, highest and lowest', () => {
    const [header] = build({ data: REGIONS }).inserted;
    expect(header?.props['items']).toEqual([
      { value: '$2,850', label: 'Sales · total', detail: '4 rows' },
      { value: '$713', label: 'Sales · average', detail: 'median $650 · std. dev. $409' },
      { value: '$1,200', label: 'Sales · highest', detail: 'North' },
      { value: '$350', label: 'Sales · lowest', detail: 'West' },
    ]);
  });

  it('charts a timeline as a trend line and a comparison of the derived pair', () => {
    const [trend, comparison] = charts(build({ data: MONTHS }));
    expect(trend).toMatchObject({
      chartType: 'line',
      title: 'Revenue: +25.0% from Jan to Apr',
      description: 'Linear trend fit R² 0.72.',
      categories: ['Jan', 'Feb', 'Mar', 'Apr'],
      series: [
        { name: 'Revenue', values: [120, 135, 160, 150] },
        { name: 'Costs', values: [80, 90, 85, 95] },
      ],
    });
    expect(comparison).toMatchObject({
      chartType: 'combo',
      title: 'Revenue vs Costs',
      description: 'Profit margin: 38.1% overall (profit 215 on Revenue 565).',
      series: [
        { name: 'Revenue' },
        { name: 'Costs' },
        { name: 'Profit', values: [40, 45, 75, 55] },
      ],
    });
    /* One measure over time is an area. */
    expect(charts(build({ data: 'Month,Visits\nJan,10\nFeb,12\nMar,15' }))[0]?.['chartType']).toBe(
      'area',
    );
  });

  it('charts categories as a sorted ranking and their shares as a donut', () => {
    const [ranking, share] = charts(
      build({ data: 'Region,Sales\nEast,$400\nNorth,"$1,200"\nWest,$350\nSouth,$900' }),
    );
    expect(ranking).toMatchObject({
      chartType: 'bar',
      title: 'Sales by Region',
      categories: ['North', 'South', 'East', 'West'],
      series: [{ name: 'Sales', values: [1200, 900, 400, 350] }],
      valuePrefix: '$',
    });
    expect(share).toMatchObject({ chartType: 'donut', title: 'Share of Sales by Region' });
  });

  it('ranks the top ten categories, folds the rest into "other", and leaves out a donut past six parts', () => {
    const rows = Array.from(
      { length: 14 },
      (_, at) => `Shop ${String(at + 1)},${String(100 - at)}`,
    );
    const built = build({ data: `Shop,Sales\n${rows.join('\n')}` });
    const all = charts(built);
    expect(all.map((props) => props['chartType'])).toEqual(['bar']);
    expect(all[0]?.['categories']).toEqual([
      ...rows.slice(0, 10).map((row) => row.split(',')[0]),
      'Other',
    ]);
    /* Shops 11-14: 90 + 89 + 88 + 87. */
    expect((all[0]?.['series'] as { values: number[] }[])[0]?.values.at(-1)).toBe(354);
  });

  it('groups a long table: total trend, region shares, and regions over time', () => {
    const data =
      'Region,Month,Sales\nNorth,Jan,100\nSouth,Jan,80\nNorth,Feb,120\nSouth,Feb,70\nNorth,Mar,130\nSouth,Mar,90';
    const [trend, share, pivot] = charts(build({ data }));
    expect(trend).toMatchObject({
      chartType: 'area',
      series: [{ name: 'Sales', values: [180, 190, 220] }],
    });
    expect(share).toMatchObject({
      chartType: 'donut',
      categories: ['North', 'South'],
      series: [{ values: [350, 240] }],
    });
    expect(pivot).toMatchObject({
      chartType: 'line',
      title: 'Sales by Region over time',
      series: [
        { name: 'North', values: [100, 120, 130] },
        { name: 'South', values: [80, 70, 90] },
      ],
    });
  });

  it('draws a scatter when two measures move together and no pair is named', () => {
    const built = build({
      data: 'Month,Ads,Sales\nJan,10,100\nFeb,20,210\nMar,30,290\nApr,40,410',
    });
    expect(charts(built).at(-1)).toMatchObject({
      chartType: 'scatter',
      categories: ['10', '20', '30', '40'],
      series: [{ name: 'Sales', values: [100, 210, 290, 410] }],
    });
  });

  it('lists the computed findings as rich text', () => {
    const findings = build({ data: MONTHS }).inserted.find(({ type }) => type === 'richText');
    const doc = findings?.props['content'] as { content: { type: string; content: unknown[] }[] };
    expect(doc.content[0]).toEqual({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Key findings' }],
    });
    const items = JSON.stringify(doc.content[1]);
    expect(items).toContain('Revenue rose 25.0% from Jan to Apr (120 → 150).');
    expect(items).toContain('Projection, not a result');
  });

  it('makes both tables interactive: sortable by column kind, sticky header; search and pages past ten rows', () => {
    const [summary, data] = tables(build({ data: MONTHS }));
    expect(summary).toMatchObject({
      title: 'Summary by measure',
      sortable: true,
      stickyHeader: true,
      searchLabel: 'Search the table',
      countLabel: '{shown} of {total} rows',
      pageLabel: 'Page {page} of {pages}',
      columns: [
        { label: 'Measure', align: 'start', sortAs: 'auto' },
        { label: 'Total', align: 'end', sortAs: 'number' },
        { label: 'Average', align: 'end', sortAs: 'number' },
        { label: 'Min', align: 'end', sortAs: 'auto' },
        { label: 'Max', align: 'end', sortAs: 'auto' },
        { label: 'Change', align: 'end', sortAs: 'number' },
        { label: 'CAGR', align: 'end', sortAs: 'number' },
      ],
    });
    expect((summary?.['rows'] as { cells: string[] }[])[0]?.cells).toEqual([
      'Revenue',
      '565',
      '141',
      '120 (Jan)',
      '160 (Mar)',
      '+25.0%',
      '+7.7%',
    ]);
    expect(summary).not.toHaveProperty('searchable');
    expect(data).toMatchObject({
      caption: 'Computed from the 4 rows × 3 columns provided; projections are linear.',
      sortable: true,
      columns: [
        { label: 'Month', sortAs: 'auto' },
        { label: 'Revenue', align: 'end', sortAs: 'number' },
        { label: 'Costs', align: 'end', sortAs: 'number' },
      ],
    });
    const days = Array.from(
      { length: 12 },
      (_, at) => `2024-01-${String(at + 1).padStart(2, '0')},${String(at)}`,
    );
    const long = tables(build({ data: `Date,Visits\n${days.join('\n')}` }))[1];
    expect(long).toMatchObject({
      searchable: true,
      pageSize: 10,
      sortable: true,
      stickyHeader: true,
    });
    expect((long?.['columns'] as { sortAs: string }[])[0]?.sortAs).toBe('date');
  });

  it('writes an Arabic page in Arabic, with Arabic-Indic digits and the table words', () => {
    const built = build(
      {
        data: 'المنطقة,المبيعات\nالرياض,"١٬٢٠٠ ر.س"\nجدة,"٩٠٠ ر.س"\nالدمام,"٤٠٠ ر.س"\nمكة,"٣٥٠ ر.س"',
      },
      reportKernel('ar'),
    );
    expect(built.issues).toEqual([]);
    expect(built.inserted[0]?.props).toMatchObject({
      eyebrow: 'الصفوف: ٤',
      heading: 'تقرير المبيعات',
      body: 'الأكبر في المبيعات: الرياض بحصة ٤٢٫١٪ من الإجمالي (١٬٢٠٠ ر.س من ٢٬٨٥٠ ر.س).',
      items: [
        { value: '٢٬٨٥٠ ر.س', label: 'المبيعات · الإجمالي' },
        { value: '٧١٣ ر.س', label: 'المبيعات · المتوسط' },
        { value: '١٬٢٠٠ ر.س', label: 'المبيعات · الأعلى', detail: 'الرياض' },
        { value: '٣٥٠ ر.س', label: 'المبيعات · الأدنى', detail: 'مكة' },
      ],
    });
    expect(charts(built)[0]).toMatchObject({ title: 'المبيعات حسب المنطقة', valueSuffix: ' ر.س' });
    expect(tables(built)[0]).toMatchObject({
      title: 'ملخص المؤشرات',
      searchLabel: 'ابحث في الجدول',
      previousLabel: 'السابق',
      nextLabel: 'التالي',
      pageLabel: 'صفحة {page} من {pages}',
    });
    /* Arabic headings on an English page make an Arabic report; "lang" overrides both. */
    expect(
      build({ data: 'المنطقة,المبيعات\nالرياض,١٠\nجدة,٨' }).inserted[0]?.props['heading'],
    ).toBe('تقرير المبيعات');
    expect(build({ data: MONTHS, lang: 'ar' }).inserted[0]?.props['heading']).toBe('تقرير Revenue');
  });

  it('places the page after a section, and reads JSON rows', () => {
    const built = build({
      data: [
        { Month: 'Jan', Sales: 10 },
        { Month: 'Feb', Sales: 14 },
      ],
      after: 'intro-1',
    });
    expect(built.issues).toEqual([]);
    const ids = (built.page?.getDocument().nodes['root']?.slots as { default: string[] }).default;
    expect(ids[0]).toBe('intro-1');
    expect(built.page?.getDocument().nodes[ids[1] ?? '']?.type).toBe('stats');
  });

  it('falls back to tables on a site with no stats or rich-text block', () => {
    const built = build({ data: MONTHS }, dataKernel());
    expect(built.issues).toEqual([]);
    expect(built.inserted.map(({ type }) => type)).toEqual([
      'table',
      'chart',
      'chart',
      'table',
      'table',
      'table',
    ]);
    expect(built.inserted[0]?.props['title']).toBe('Revenue report');
  });

  it.each([
    [{ data: MONTHS, measures: ['Profit'] }, 'no numeric column "Profit"'],
    [{ data: MONTHS, measures: [] }, '"measures" is a list of 1 to 6'],
    [{ data: MONTHS, period: 'Week' }, '"period": no column "Week"'],
    [{ data: MONTHS, lang: 'fr' }, '"lang" is "en" or "ar"'],
    [{ data: 'Name,Role\nAda,Engineer' }, 'no column holds numbers'],
    [{ data: MONTHS, after: 'nope' }, '"after": no section "nope"'],
    [{ data: MONTHS, colour: 'red' }, 'unknown keys colour'],
    [{ data: 42 }, '"data" is CSV/TSV/markdown/JSON text'],
    [{ data: '[{"a":{"b":1}}]' }, 'holds a list or an object'],
  ])('refuses %j with the fix', (input, error) => {
    expect(build(input).issues.join(' ')).toContain(error);
  });
});
