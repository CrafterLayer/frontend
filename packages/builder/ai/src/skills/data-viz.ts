import type { AiSkillDefinitionV1 } from './types';

/**
 * Numbers on a page (2026-10-12): when the request carries data, or asks for a chart, a table,
 * statistics or a report, the agent puts the rows through `data.show` — one short CSV in its
 * plan instead of hand-built series — and picks the form by the question the numbers answer.
 * Auto on data vocabulary in English and Arabic. The honesty rule is the one that matters: a
 * chart looks like evidence, so it never carries numbers the person did not give.
 */
export const DATA_VIZ_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.data-viz',
  name: 'Charts and tables',
  description:
    'Numbers as a chart or a table through data.show: which form answers which question, titles that state the finding, units, and no invented figures.',
  version: '1.0.0',
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
    ],
  },
  tags: ['content', 'data', 'charts'],
  instructions: `DATA goes through the tool, never hand-built series or a wall of numbers in a paragraph: {"command":"tool","args":{"name":"data.show","input":{"data":"Month,Bookings\\nJan,120\\nFeb,135","title":"Bookings doubled since January"}}}. The first row is the headings, the first column labels the rows; write numbers as people do ("$1,200", "45%", "١٢٠") and the tool reads them, units included. "id" refills an existing chart or table; "after" places a new one after a section.
FORM by the question: change over time is a line (area when the total matters), comparing items is a bar (stacked when the parts add up), shares of one whole (five slices at most, adding to 100%) is a donut, exact values or text is "table". Leave "as" out and the tool chooses the same way.
TITLE states the finding, not the topic ("Bookings doubled since March", not "Bookings"); the caption names the source and the period. One unit per chart: minutes beside dollars is two charts or a table.
SIZE: at most six series and twenty-four categories; group the rest, or show a table.
HONEST: plot only numbers the request, the page or the attached data gives. With no numbers, build the section with the block's sample data only when the person asked for a template, and say in followUp which figures they should supply; never present invented statistics as real.`,
  references: {
    'checks/data.md':
      'Numbers placed with data.show; the form fits the question (line over time, bar to compare, donut for shares of 100%, table for exact values or text); the title states the finding; one unit per chart; no figure the person did not give.',
  },
};
