import type { BuilderKernel } from '@craftkit/builder-core';

import { isRecord, rootIdOf, setProp, unknownKeys } from '../tools/agent/shared';
import {
  defineAgentTool,
  type AgentToolContext,
  type AgentToolParse,
  type AgentToolRun,
  type AgentToolStep,
} from '../tools/agent/types';
import {
  CHART_TYPES,
  LIMITS,
  autoChart,
  chartData,
  chartDataFor,
  chartPropsOf,
  plottable,
  type ChartType,
} from './data-chart';
import { placeIndex, propKeys } from './data-place';
import { isNumericColumn, readDataRows, readDataText, type DataGrid } from './data-text';

/**
 * data.show (2026-10-12) — numbers onto the page as a chart or a table, from the rows the model
 * already has. `data` is CSV, TSV, a markdown table or rows of cells, the first row the
 * headings; the tool reads the numbers (Arabic digits, `$1,200`, `45%`, `1.2k`), picks the chart
 * (a line over time, a donut for shares of 100%, bars otherwise, a table when the data is
 * text or too long to plot), and writes the block's own props. With `id` it refills that chart
 * or table; otherwise it inserts one (after `after`, else at the end above the footer).
 *
 * 2026-10-12: the chart types horizontal bars, combo, scatter, radar, funnel, gauge and
 * sparkline. Auto also picks horizontal bars for long labels, a scatter for numbers against a
 * numeric first column, a gauge for one value beside a Max column, and a funnel for narrowing
 * stages when the title or headings say funnel (data-chart.ts).
 *
 * A chart block is any registered block declaring `categories` + `series`, a table one
 * declaring `columns` + `rows` of cells; the door judges every value against that schema.
 */

export const DATA_SHOW_AS = ['auto', 'table', ...CHART_TYPES] as const;
export type DataShowAs = (typeof DATA_SHOW_AS)[number];

export interface DataShowInput {
  readonly grid: DataGrid;
  readonly as: DataShowAs;
  readonly id?: string | undefined;
  readonly after?: string | undefined;
  readonly title?: string | undefined;
  readonly caption?: string | undefined;
}

const KEYS = ['data', 'as', 'id', 'after', 'title', 'caption'] as const;
/* Drawn from the first series only. */
const FIRST_ONLY: ReadonlySet<string> = new Set([
  'pie',
  'donut',
  'funnel',
  'gauge',
  'treemap',
  'waterfall',
  'histogram',
  'lollipop',
]);

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

function parse(input: unknown): AgentToolParse<DataShowInput> {
  if (!isRecord(input))
    return no('input must be {"data":"Month,Sales\\nJan,120\\nFeb,140","as?":"auto"}.');
  const extra = unknownKeys(input, KEYS);
  if (extra.length > 0) return no(`unknown keys ${extra.join(', ')}; use ${KEYS.join(', ')}.`);
  const { data } = input;
  const read =
    typeof data === 'string'
      ? readDataText(data)
      : Array.isArray(data) && data.every(Array.isArray)
        ? readDataRows(data as unknown[][])
        : ({
            ok: false,
            error: '"data" is CSV/TSV/markdown text or rows of cells, the first row the headings.',
          } as const);
  if (!read.ok) return no(read.error);
  const as = input['as'] ?? 'auto';
  if (typeof as !== 'string' || !(DATA_SHOW_AS as readonly string[]).includes(as))
    return no(`"as" is one of ${DATA_SHOW_AS.join(', ')}.`);
  const fields: Record<string, string | undefined> = {};
  for (const [key, max] of [
    ['id', 120],
    ['after', 120],
    ['title', 90],
    ['caption', 240],
  ] as const) {
    const field = text(input[key], key, max);
    if (!field.ok) return field;
    fields[key] = field.value;
  }
  if (fields['id'] !== undefined && fields['after'] !== undefined) {
    return no('"id" refills that chart or table; "after" places a new one: send one of them.');
  }
  return { ok: true, value: { grid: read.grid, as: as as DataShowAs, ...fields } };
}

// ── Which blocks hold data ───────────────────────────────────────────────────

type DataKind = 'chart' | 'table';

function kindOfType(kernel: BuilderKernel, type: string): DataKind | undefined {
  const keys = propKeys(kernel, type);
  if (keys.includes('categories') && keys.includes('series')) return 'chart';
  // A plan comparison also has columns and rows, but its columns are plans, not headings.
  if (keys.includes('columns') && keys.includes('rows') && !/compar/iu.test(type)) return 'table';
  return undefined;
}

/** The registered block type that draws a kind: `chart`/`table` first, else any of that shape. */
function typeFor(kernel: BuilderKernel, kind: DataKind): string | undefined {
  if (kernel.context.registry.block(kind) !== undefined && kindOfType(kernel, kind) === kind)
    return kind;
  return kernel.context.registry
    .blocks()
    .find((block) => kindOfType(kernel, block.schema.type) === kind)?.schema.type;
}

interface TableData {
  readonly columns: readonly {
    readonly label: string;
    readonly align: 'start' | 'center' | 'end';
  }[];
  readonly rows: readonly { readonly cells: readonly string[] }[];
}

function tableData(grid: DataGrid): TableData | string {
  if (grid.header.length > LIMITS.columns)
    return `a table holds at most ${String(LIMITS.columns)} columns (got ${String(grid.header.length)}).`;
  if (grid.rows.length > LIMITS.rows)
    return `a table holds at most ${String(LIMITS.rows)} rows (got ${String(grid.rows.length)}); split it or summarise.`;
  const empty = grid.header.findIndex((label) => label.trim() === '');
  if (empty >= 0) return `column ${String(empty + 1)} has no heading; name every column.`;
  const long = grid.header.find((label) => label.length > LIMITS.heading);
  if (long !== undefined)
    return `the heading "${long.slice(0, 50)}…" is over ${String(LIMITS.heading)} characters.`;
  const cell = grid.rows.flat().find((value) => value.length > LIMITS.cell);
  if (cell !== undefined)
    return `a cell is over ${String(LIMITS.cell)} characters ("${cell.slice(0, 40)}…").`;
  return {
    columns: grid.header.map((label, column) => ({
      label,
      align:
        grid.aligns?.[column] ?? (column > 0 && isNumericColumn(grid, column) ? 'end' : 'start'),
    })),
    rows: grid.rows.map((row) => ({ cells: [...row] })),
  };
}

// ── The run ──────────────────────────────────────────────────────────────────

function wanted(input: DataShowInput, existing: DataKind | undefined): DataKind {
  if (input.as === 'table') return 'table';
  if (input.as !== 'auto') return 'chart';
  return existing ?? (plottable(input.grid) ? 'chart' : 'table');
}

function isChartType(value: unknown): value is ChartType {
  return typeof value === 'string' && (CHART_TYPES as readonly string[]).includes(value);
}

/** The chart props for the data: the type asked for, the existing chart's, or the one that fits. */
function chartProps(
  input: DataShowInput,
  current: unknown,
): { readonly props: Record<string, unknown>; readonly notes: readonly string[] } | string {
  const words = [input.title, input.caption, input.grid.header[0]].join(' ');
  const base = input.as === 'auto' && !isChartType(current) ? chartData(input.grid) : undefined;
  if (typeof base === 'string') return base;
  const chartType: ChartType =
    input.as === 'auto' || input.as === 'table'
      ? isChartType(current)
        ? current
        : base === undefined
          ? 'bar'
          : autoChart(input.grid, base, words)
      : input.as;
  const data = chartDataFor(input.grid, chartType);
  if (typeof data === 'string') return data;
  const notes = [...data.notes];
  if (FIRST_ONLY.has(chartType) && data.series.length > 1)
    notes.push(`a ${chartType} plots the first series only`);
  return {
    props: {
      ...chartPropsOf(data, chartType),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.caption === undefined
        ? data.notes.length === 0
          ? {}
          : { description: data.notes.join(' · ').slice(0, 240) }
        : { description: input.caption }),
    },
    notes,
  };
}

function tableShape(
  input: DataShowInput,
): { readonly props: Record<string, unknown>; readonly notes: readonly string[] } | string {
  const table = tableData(input.grid);
  return typeof table === 'string' ? table : { props: tableProps(input, table), notes: [] };
}

function tableProps(input: DataShowInput, data: TableData): Record<string, unknown> {
  return {
    columns: data.columns,
    rows: data.rows,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.caption === undefined ? {} : { caption: input.caption.slice(0, 160) }),
  };
}

function describe(kind: DataKind, props: Record<string, unknown>): string {
  if (kind === 'table') return `table · ${String((props['rows'] as unknown[]).length)} rows`;
  return `${String(props['chartType'])} chart · ${String((props['categories'] as unknown[]).length)} categories`;
}

function run(input: DataShowInput, context: AgentToolContext): AgentToolRun {
  const { kernel } = context;
  const node = input.id === undefined ? undefined : kernel.getDocument().nodes[input.id];
  if (input.id !== undefined && node === undefined)
    return {
      ok: false,
      error: `"id": no block "${input.id}" on the page; omit it to add a new chart or table.`,
    };
  const existing = node === undefined ? undefined : kindOfType(kernel, node.type);
  if (node !== undefined && existing === undefined) {
    return {
      ok: false,
      error: `"${node.id}" is a ${node.type} block, not a chart or table; omit "id" (or send "after":"${node.id}") to add one.`,
    };
  }
  const kind = wanted(input, existing);
  if (existing !== undefined && kind !== existing) {
    return {
      ok: false,
      error: `"${node?.id ?? ''}" is a ${existing}; send "as" ${existing === 'table' ? '"table"' : 'a chart type'}, or "after" to add a ${kind} beside it.`,
    };
  }
  const shaped = kind === 'chart' ? chartProps(input, node?.props['chartType']) : tableShape(input);
  if (typeof shaped === 'string') return { ok: false, error: shaped };
  const { props, notes } = shaped;
  const title =
    `${kind === 'chart' ? 'Chart' : 'Table'} · ${input.title ?? input.grid.header[0] ?? 'data'}`.slice(
      0,
      160,
    );
  if (node !== undefined) {
    const next = { ...props };
    if (kind === 'chart')
      for (const key of ['valuePrefix', 'valueSuffix']) {
        if (node.props[key] !== undefined && props[key] === undefined) next[key] = ' ';
      }
    const steps: AgentToolStep[] = Object.entries(next).map(([key, value]) =>
      setProp(node.id, key, value),
    );
    const [first, ...rest] = steps;
    /* v8 ignore next -- a chart or table always writes its data. */
    if (first === undefined) return { ok: false, error: 'nothing to change.' };
    return {
      ok: true,
      steps: [{ ...first, title }, ...rest],
      note: [describe(kind, props), ...notes].join(' · '),
    };
  }
  const type = typeFor(kernel, kind);
  if (type === undefined)
    return {
      ok: false,
      error: `this site has no ${kind} block; describe the numbers in a section instead.`,
    };
  const index = placeIndex(context, input.after);
  if (typeof index === 'string') return { ok: false, error: index };
  return {
    ok: true,
    steps: [
      {
        command: 'insertNode',
        args: {
          type,
          parentId: rootIdOf(kernel),
          ...(index === undefined ? {} : { index }),
          props,
        },
        title,
      },
    ],
    note: [describe(kind, props), ...notes].join(' · '),
  };
}

export const dataShowTool = defineAgentTool<DataShowInput>({
  name: 'data.show',
  lanes: ['edit', 'build'],
  summary: 'Numbers as a chart or table',
  signature: '{data,as?,id?,after?,title?,caption?}',
  parse,
  run,
});
