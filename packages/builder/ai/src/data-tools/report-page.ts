import type { BuilderKernel } from '@craftkit/builder-core';

import { isRecord, rootIdOf, unknownKeys } from '../tools/agent/shared';
import {
  defineAgentTool,
  type AgentToolContext,
  type AgentToolParse,
  type AgentToolRun,
  type AgentToolStep,
} from '../tools/agent/types';
import { ANALYSIS_LIMITS, analyzeGrid, type ReportLang } from './analysis';
import { readDataInput } from './data-input';
import { blockTypeWith, placeIndex, propKeys } from './data-place';
import type { DataGrid } from './data-text';
import { pageCharts } from './report-page-charts';
import {
  dataTable,
  findingsDoc,
  findingsTable,
  headerOf,
  kpiCards,
  kpiTable,
  summaryTable,
  type TableShape,
} from './report-page-sections';
import { pageWords } from './report-page-words';

/**
 * report.page (2026-10-14) — one dataset as a whole REPORT PAGE in one call, every figure computed
 * by the analysis engine (analysis/*) from the person's cells, never by the model: a header with
 * up to six KPI cards (a stats block), the trend, the breakdown, the pivot and the comparison
 * charts that the data has, the findings (the engine's EN/AR sentences, as rich text), a summary
 * table per measure and the data table whose caption is the method note. `data` is what
 * data.show reads, plus JSON; the model's part is words only (`title`, `summary`). Appended at
 * the end above the footer, or after `after`. report.build stays the one-section report.
 */

export interface ReportPageInput {
  readonly grid: DataGrid;
  readonly title?: string | undefined;
  readonly summary?: string | undefined;
  readonly measures?: readonly string[] | undefined;
  readonly period?: string | undefined;
  readonly after?: string | undefined;
  readonly lang?: ReportLang | undefined;
}

const KEYS = ['data', 'title', 'summary', 'measures', 'period', 'after', 'lang'] as const;
const MAX_MEASURES = 6;
/** Rows a table shows per page once it is long enough to page. */
const PAGE_SIZE = 10;
const ARABIC = /[\u0600-\u06ff]/u;

function no<T>(error: string): AgentToolParse<T> {
  return { ok: false, error };
}

function text(value: unknown, key: string, max: number): AgentToolParse<string | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value !== 'string' || value.trim() === '')
    return no(`"${key}" must be a non-empty string.`);
  if (value.trim().length > max) return no(`"${key}" must be at most ${String(max)} characters.`);
  return { ok: true, value: value.trim() };
}

function parse(input: unknown): AgentToolParse<ReportPageInput> {
  if (!isRecord(input))
    return no('input must be {"data":"Month,Sales\\nJan,120\\nFeb,140","title?":"…"}.');
  const extra = unknownKeys(input, KEYS);
  if (extra.length > 0) return no(`unknown keys ${extra.join(', ')}; use ${KEYS.join(', ')}.`);
  const read = readDataInput(input['data']);
  if (!read.ok) return no(read.error);
  const fields: Record<string, string | undefined> = {};
  for (const [key, max] of [
    ['title', 90],
    ['summary', 320],
    ['period', 60],
    ['after', 120],
  ] as const) {
    const field = text(input[key], key, max);
    if (!field.ok) return field;
    fields[key] = field.value;
  }
  const measures = input['measures'];
  if (
    measures !== undefined &&
    (!Array.isArray(measures) ||
      measures.length === 0 ||
      measures.length > MAX_MEASURES ||
      !measures.every((name) => typeof name === 'string' && name.trim() !== ''))
  )
    return no(`"measures" is a list of 1 to ${String(MAX_MEASURES)} column headings.`);
  const lang = input['lang'];
  if (lang !== undefined && lang !== 'en' && lang !== 'ar') return no('"lang" is "en" or "ar".');
  return {
    ok: true,
    value: {
      grid: read.grid,
      ...fields,
      ...(measures === undefined
        ? {}
        : { measures: (measures as string[]).map((name) => name.trim()) }),
      ...(lang === undefined ? {} : { lang }),
    },
  };
}

// ── The blocks ───────────────────────────────────────────────────────────────

/** The table block: `table` first, else any declaring columns and rows that is not a plan comparison. */
function tableType(kernel: BuilderKernel): string | undefined {
  const declares = (type: string) => {
    const keys = propKeys(kernel, type);
    return keys.includes('columns') && keys.includes('rows') && !/compar/iu.test(type);
  };
  if (kernel.context.registry.block('table') !== undefined && declares('table')) return 'table';
  return kernel.context.registry.blocks().find((block) => declares(block.schema.type))?.schema.type;
}

function richTextType(kernel: BuilderKernel): string | undefined {
  return kernel.context.registry.block('richText') !== undefined &&
    propKeys(kernel, 'richText').includes('content')
    ? 'richText'
    : undefined;
}

/** Only the props the block declares: a site's simpler table keeps its own shape. */
function declared(
  kernel: BuilderKernel,
  type: string,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const keys = propKeys(kernel, type);
  return Object.fromEntries(
    Object.entries(props).filter(([key, value]) => value !== undefined && keys.includes(key)),
  );
}

/**
 * A table's props, interactive: sortable by every column (each with its `sortAs`) under a sticky
 * header, and — past ten rows — searchable and paged ten at a time; the tool words in the page's
 * language.
 */
export function tableProps(
  shape: TableShape,
  tools: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const long = shape.rows.length > PAGE_SIZE;
  return {
    title: shape.title,
    caption: shape.caption,
    columns: shape.columns,
    rows: shape.rows,
    sortable: true,
    stickyHeader: true,
    ...(long ? { searchable: true, pageSize: PAGE_SIZE } : {}),
    ...tools,
  };
}

interface Section {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly name: string;
}

function run(input: ReportPageInput, context: AgentToolContext): AgentToolRun {
  const { kernel } = context;
  /* The page's language; Arabic headings make an Arabic report too (its words wrap them). */
  const lang: ReportLang =
    input.lang ??
    (/^ar\b/iu.test(context.locale.lang) || ARABIC.test(input.grid.header.join(' ')) ? 'ar' : 'en');
  const words = pageWords(lang);
  const analysis = analyzeGrid(input.grid, {
    measures: input.measures,
    period: input.period,
    lang,
  });
  if (typeof analysis === 'string') return { ok: false, error: analysis };
  const chart = blockTypeWith(kernel, 'chart', ['categories', 'series', 'chartType']);
  const table = tableType(kernel);
  if (chart === undefined && table === undefined)
    return {
      ok: false,
      error: 'this site has no chart or table block; use report.build or data.show.',
    };
  const stats = blockTypeWith(kernel, 'stats', ['items', 'heading']);
  const rich = richTextType(kernel);
  const index = placeIndex(context, input.after);
  if (typeof index === 'string') return { ok: false, error: index };

  const header = headerOf(analysis, words, lang, input.title, input.summary);
  const cards = kpiCards(analysis, words, lang);
  const sections: Section[] = [];
  const tools = words.table;
  if (stats !== undefined) {
    sections.push({
      type: stats,
      name: 'Header',
      props: {
        eyebrow: header.eyebrow,
        heading: header.heading,
        body: header.body,
        items: cards.map(({ detail, ...card }) =>
          detail === undefined ? card : { ...card, detail },
        ),
      },
    });
  } else if (table !== undefined) {
    sections.push({
      type: table,
      name: 'Key figures',
      props: tableProps(kpiTable(cards, header, words), tools),
    });
  }
  if (chart !== undefined) {
    for (const section of pageCharts(analysis, words, lang)) {
      const props = lang === 'ar' ? { ...section.props, targetLabel: words.target } : section.props;
      sections.push({ type: chart, name: section.key, props });
    }
  }
  if (analysis.insights.length > 0 || header.leftover !== undefined) {
    if (rich !== undefined)
      sections.push({
        type: rich,
        name: 'Findings',
        props: { content: findingsDoc(analysis, words, lang, header.leftover) },
      });
    else if (table !== undefined && analysis.insights.length > 0)
      sections.push({
        type: table,
        name: 'Findings',
        props: tableProps(findingsTable(analysis, words, lang), tools),
      });
  }
  if (table !== undefined) {
    sections.push({
      type: table,
      name: 'Summary',
      props: tableProps(summaryTable(analysis, words, lang), tools),
    });
    sections.push({
      type: table,
      name: 'Data',
      props: tableProps(dataTable(analysis, words, lang), tools),
    });
  }
  const root = rootIdOf(kernel);
  const steps: AgentToolStep[] = sections.map((section, at) => ({
    command: 'insertNode',
    args: {
      type: section.type,
      parentId: root,
      ...(index === undefined ? {} : { index: index + at }),
      props: declared(kernel, section.type, section.props),
    },
    title: `Report page · ${section.name}${at === 0 ? ` · ${header.heading}` : ''}`.slice(0, 160),
  }));
  const notes = [
    `report page · ${String(steps.length)} sections · ${String(analysis.rows)} rows × ${String(analysis.columns)} columns · ${String(analysis.insights.length)} findings`,
    ...(analysis.totalRows > analysis.rows
      ? [`analysed the first ${String(ANALYSIS_LIMITS.rows)} of ${String(analysis.totalRows)} rows`]
      : []),
  ];
  return { ok: true, steps, note: notes.join(' · ') };
}

export const reportPageTool = defineAgentTool<ReportPageInput>({
  name: 'report.page',
  lanes: ['edit', 'build'],
  summary: 'Rows as a computed, detailed report page',
  signature: '{data,title?,summary?,measures?:[column],period?:column,after?,lang?:en|ar}',
  parse,
  run,
});
