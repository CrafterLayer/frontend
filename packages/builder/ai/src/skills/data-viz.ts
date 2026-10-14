import type { AiSkillDefinitionV1 } from './types';

/**
 * Numbers on a page (2026-10-12): when the request carries data, or asks for a chart, a table,
 * statistics or a report, the agent puts the rows through `data.show` — one short CSV in its
 * plan instead of hand-built series — or, for a whole report or dashboard, `report.build`, and
 * picks the form by the question the numbers answer. Auto on data vocabulary in English and
 * Arabic. The honesty rule is the one that matters: a chart looks like evidence, so it never
 * carries numbers the person did not give.
 *
 * 2026-10-12 (charts and reports): the chart types horizontal bars, combo, scatter, radar,
 * funnel, gauge and sparkline, and `report.build` (KPI cards, a chart and the table in one call).
 *
 * 2026-10-14 (report page): `report.page` for a detailed report, an analysis or a dashboard PAGE —
 * the tool computes every figure; the model writes words only, and for a description with numbers
 * writes the person's numbers as rows, without arithmetic, before calling it. The tool's menu line
 * is its bare name (catalog-prompt.ts), so its inputs are taught here.
 */
export const DATA_VIZ_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.data-viz',
  name: 'Charts and tables',
  description:
    'Numbers as a chart, a table, a report section or a whole computed report page through data.show, report.build and report.page: which form answers which question, titles that state the finding, units, and no invented figures.',
  version: '1.2.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 46,
  activation: {
    mode: 'auto',
    keywords: [
      'chart',
      'graph',
      'data',
      'statistics',
      'stats',
      'csv',
      'spreadsheet',
      'dashboard',
      'report',
      'kpi',
      'metrics',
      'figures',
      'مخطط',
      'رسم بياني',
      'جدول',
      'بيانات',
      'إحصائيات',
      'إحصاءات',
      'أرقام',
      'تقرير',
      'لوحة معلومات',
      'funnel',
      'gauge',
      'scatter',
      'radar',
      'sparkline',
      'قمع',
      'مؤشرات',
      'لوحة تحكم',
      'مخطط راداري',
      'مخطط انتشار',
      'analysis',
      'analyse',
      'analyze',
      'detailed report',
      'تحليل',
      'تقرير مفصل',
      'صفحة تقرير',
    ],
  },
  tags: ['content', 'data', 'charts'],
  instructions: `DATA goes through the tool, never hand-built series or a wall of numbers in a paragraph: {"command":"tool","args":{"name":"data.show","input":{"data":"Month,Bookings\\nJan,120\\nFeb,135","title":"Bookings doubled since January"}}}. The first row is the headings, the first column labels the rows; write numbers as people do ("$1,200", "45%", "١٢٠") and the tool reads them, units included. "id" refills an existing chart or table; "after" places a new one after a section.
FORM by the question: change over time is a line (area when the total matters; sparkline for a compact trend per series), comparing items is a bar (hbar when the labels are long; stacked when the parts add up), a volume beside a rate on one axis is a combo (first column of numbers as bars, the rest as lines), how two measures move together is a scatter (the first column holds the x numbers), one profile over three to twelve criteria is a radar, stages that narrow are a funnel, one value against a maximum is a gauge (add a "Max" column, and a "Target" column for a goal), shares of one whole (five slices at most, adding to 100%) is a donut, exact values or text is "table". Leave "as" out and the tool chooses the same way: hbar for long labels, scatter for a numeric first column, gauge beside a Max column, funnel when the title says funnel.
REPORT: a report or dashboard of one dataset is ONE call, never a hand-built section: {"command":"tool","args":{"name":"report.build","input":{"data":"Month,Revenue,Costs\\nJan,120,80\\nFeb,135,90","title":"Revenue grew while costs held","summary":"February revenue rose 12.5%; costs rose less."}}}. It makes up to four KPI cards (each column's last value and its change against the previous row, an arrow and a sign, good when it goes up — or down for a cost), one chart and the table. "kpis":["Revenue"] picks the cards; {"column":"Revenue","measure":"total"} shows a total, average, max or min instead; "as" picks the chart.
PAGE: a detailed report, an analysis or a dashboard PAGE is ONE report.page call; the tool computes every total, average, change, share, trend and projection and writes the findings: {"command":"tool","args":{"name":"report.page","input":{"data":"Month,Revenue,Costs\nJan,120,80\nFeb,135,90","title":"First-quarter sales","summary":"…"}}}. Optional "measures":["Revenue"], "period":"Month", "after", "lang". Never compute a figure yourself; for a description with numbers, write the person's numbers as rows exactly as stated (no arithmetic, no invented figures), then call report.page. "summary" is words, no new numbers.
TITLE states the finding, not the topic ("Bookings doubled since March", not "Bookings"); the caption or summary names the source and the period. One unit per chart: minutes beside dollars is two charts or a table.
SIZE: at most six series and twenty-four categories; group the rest, or show a table.
HONEST: plot only numbers the request, the page or the attached data gives. With no numbers, build the section with the block's sample data only when the person asked for a template, and say in followUp which figures they should supply; never present invented statistics as real.`,
  references: {
    'checks/data.md':
      'Numbers placed with data.show, a report or dashboard section with report.build, a detailed report page with report.page (its figures computed by the tool, a described dataset written as rows without arithmetic); the form fits the question (line over time, bar to compare, hbar for long labels, combo for a volume beside a rate, scatter for two measures, radar for a profile, funnel for stages, gauge for one value against a maximum, sparkline for a compact trend, donut for shares of 100%, table for exact values or text); the title states the finding; one unit per chart; no figure the person did not give.',
  },
};
