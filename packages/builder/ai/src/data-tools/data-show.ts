import type { BuilderKernel } from '@craftkit/builder-core';

import {
  isRecord,
  readTree,
  rootChildren,
  rootIdOf,
  setProp,
  unknownKeys,
} from '../tools/agent/shared';
import {
  defineAgentTool,
  type AgentToolContext,
  type AgentToolParse,
  type AgentToolRun,
  type AgentToolStep,
} from '../tools/agent/types';
import {
  columnUnit,
  isNumericColumn,
  isTimeline,
  readDataRows,
  readDataText,
  readNumber,
  type DataGrid,
} from './data-text';

/**
 * data.show (2026-10-12) — numbers onto the page as a chart or a table, from the rows the model
 * already has. `data` is CSV, TSV, a markdown table or rows of cells, the first row the
 * headings; the tool reads the numbers (Arabic digits, `$1,200`, `45%`, `1.2k`), picks the chart
 * (a line over time, a donut for shares of 100%, bars otherwise, a table when the data is
 * text or too long to plot), and writes the block's own props. With `id` it refills that chart
 * or table; otherwise it inserts one (after `after`, else at the end above the footer).
 *
 * A chart block is any registered block declaring `categories` + `series`, a table one
 * declaring `columns` + `rows` of cells; the door judges every value against that schema.
 */

export const DATA_SHOW_AS = ['auto', 'table', 'bar', 'line', 'area', 'pie', 'donut'] as const;
export type DataShowAs = (typeof DATA_SHOW_AS)[number];
type ChartType = Exclude<DataShowAs, 'auto' | 'table'>;

export interface DataShowInput {
  readonly grid: DataGrid;
  readonly as: DataShowAs;
  readonly id?: string | undefined;
  readonly after?: string | undefined;
  readonly title?: string | undefined;
  readonly caption?: string | undefined;
}

const KEYS = ['data', 'as', 'id', 'after', 'title', 'caption'] as const;
const LIMITS = {
  categories: 24,
  series: 6,
  label: 40,
  columns: 8,
  rows: 50,
  cell: 160,
  heading: 60,
} as const;
/** How many rows a donut of shares may hold before it reads as a bar chart. */
const DONUT_MAX = 5;

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

function propKeys(kernel: BuilderKernel, type: string): readonly string[] {
  const shape = (
    kernel.context.registry.block(type)?.schema.props as unknown as { shape?: unknown } | undefined
  )?.shape;
  return isRecord(shape) ? Object.keys(shape) : [];
}

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

// ── The data as props ────────────────────────────────────────────────────────

interface ChartData {
  readonly categories: readonly string[];
  readonly series: readonly { readonly name: string; readonly values: readonly number[] }[];
  readonly prefix?: string | undefined;
  readonly suffix?: string | undefined;
  readonly notes: readonly string[];
}

/** One affix all values share, or undefined when they differ (or carry none). */
function shared(values: readonly string[]): string | undefined {
  const [first] = values;
  return first !== undefined && first.trim() !== '' && values.every((value) => value === first)
    ? first
    : undefined;
}

/**
 * The chart reading of a grid: the first column labels the categories and every numeric column
 * is a series — or, when the headings are the times ("Metric,2022,2023"), each row is a series.
 */
function chartData(grid: DataGrid): ChartData | string {
  const numeric = grid.header.map((_, column) => column > 0 && isNumericColumn(grid, column));
  const byRow =
    isTimeline(grid.header.slice(1)) && !isTimeline(grid.rows.map((row) => row[0] ?? ''));
  const notes: string[] = [];
  let categories: string[];
  let series: { name: string; cells: string[] }[];
  if (byRow) {
    if (
      !grid.rows.every((row) =>
        row.slice(1).every((cell) => cell.trim() === '' || readNumber(cell) !== undefined),
      )
    ) {
      return 'the rows hold text as well as numbers; send as "table".';
    }
    categories = grid.header.slice(1);
    series = grid.rows.map((row) => ({ name: row[0] ?? '', cells: row.slice(1) }));
  } else {
    const columns = numeric.flatMap((isNumber, column) => (isNumber ? [column] : []));
    if (columns.length === 0) return 'no column after the first holds numbers; send as "table".';
    const skipped = grid.header.filter((_, column) => column > 0 && !numeric[column]);
    if (skipped.length > 0) notes.push(`text columns left out of the chart: ${skipped.join(', ')}`);
    categories = grid.rows.map((row) => row[0] ?? '');
    series = columns.map((column) => ({
      name: grid.header[column] ?? '',
      cells: grid.rows.map((row) => row[column] ?? ''),
    }));
  }
  if (categories.length > LIMITS.categories)
    return `a chart plots at most ${String(LIMITS.categories)} categories (got ${String(categories.length)}); send as "table" or group the rows.`;
  if (series.length > LIMITS.series)
    return `a chart plots at most ${String(LIMITS.series)} series (got ${String(series.length)}); keep the ones that matter.`;
  const label = categories.findIndex((category) => category.trim() === '');
  if (label >= 0) return `category ${String(label + 1)} has no label; give every row a first cell.`;
  const unnamed = series.findIndex((entry) => entry.name.trim() === '');
  if (unnamed >= 0) return `series ${String(unnamed + 1)} has no name; give its column a heading.`;
  const long = [...categories, ...series.map((entry) => entry.name)].find(
    (name) => name.length > LIMITS.label,
  );
  if (long !== undefined)
    return `"${long.slice(0, 50)}…" is over ${String(LIMITS.label)} characters; shorten the label.`;
  const read = series.flatMap((entry) => entry.cells.map((cell) => readNumber(cell)));
  if (read.some((number) => number === undefined)) notes.push('empty cells plotted as 0');
  const present = read.filter((number) => number !== undefined);
  return {
    categories,
    series: series.map((entry) => ({
      name: entry.name,
      values: entry.cells.map((cell) => readNumber(cell)?.value ?? 0),
    })),
    prefix: shared(present.map((number) => number.prefix)),
    suffix: shared(present.map((number) => number.suffix)),
    notes,
  };
}

function autoChart(data: ChartData): ChartType {
  if (isTimeline(data.categories)) return 'line';
  const [only] = data.series;
  if (
    data.series.length === 1 &&
    only !== undefined &&
    data.categories.length <= DONUT_MAX &&
    data.suffix?.trim() === '%'
  ) {
    const total = only.values.reduce((sum, value) => sum + value, 0);
    if (only.values.every((value) => value >= 0) && Math.abs(total - 100) <= 2) return 'donut';
  }
  return 'bar';
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

/** Whether the data reads as a chart: numbers after the first column, and nothing but numbers. */
function plottable(grid: DataGrid): boolean {
  const numeric = grid.header.map((_, column) => column > 0 && isNumericColumn(grid, column));
  const textColumns = grid.header.filter((_, column) => column > 0 && !numeric[column]);
  // One value axis: minutes beside dollars, or a column of mixed units, is a table.
  const units = new Set(
    numeric.flatMap((isNumber, column) =>
      isNumber ? [columnUnit(grid, column) ?? `mixed-${String(column)}`] : [],
    ),
  );
  return (
    numeric.some(Boolean) &&
    textColumns.length === 0 &&
    units.size === 1 &&
    grid.rows.length <= LIMITS.categories
  );
}

// ── The run ──────────────────────────────────────────────────────────────────

function wanted(input: DataShowInput, existing: DataKind | undefined): DataKind {
  if (input.as === 'table') return 'table';
  if (input.as !== 'auto') return 'chart';
  return existing ?? (plottable(input.grid) ? 'chart' : 'table');
}

function chartProps(
  input: DataShowInput,
  data: ChartData,
  current: unknown,
): Record<string, unknown> {
  const chartType =
    input.as === 'auto' ? (typeof current === 'string' ? current : autoChart(data)) : input.as;
  return {
    categories: data.categories,
    series: data.series,
    chartType,
    ...(data.prefix === undefined ? {} : { valuePrefix: data.prefix.slice(0, 12) }),
    ...(data.suffix === undefined ? {} : { valueSuffix: data.suffix.slice(0, 12) }),
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.caption === undefined ? {} : { description: input.caption }),
  };
}

function tableProps(input: DataShowInput, data: TableData): Record<string, unknown> {
  return {
    columns: data.columns,
    rows: data.rows,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.caption === undefined ? {} : { caption: input.caption.slice(0, 160) }),
  };
}

function isFooter(context: AgentToolContext, id: string): boolean {
  const type = context.kernel.getDocument().nodes[id]?.type ?? '';
  if (type !== 'customCode') return /footer/iu.test(type);
  const outer = readTree(context, id)?.children[0];
  return isRecord(outer) && outer['tag'] === 'footer';
}

function placeIndex(
  context: AgentToolContext,
  after: string | undefined,
): number | string | undefined {
  const children = rootChildren(context.kernel);
  if (after !== undefined) {
    const at = children.indexOf(after);
    return at < 0
      ? `"after": no section "${after}" on the page; use one of ${children.slice(0, 12).join(', ')}.`
      : at + 1;
  }
  const footer = children.findIndex((id) => isFooter(context, id));
  return footer >= 0 ? footer : undefined;
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
  const data = kind === 'chart' ? chartData(input.grid) : tableData(input.grid);
  if (typeof data === 'string') return { ok: false, error: data };
  const props =
    'series' in data ? chartProps(input, data, node?.props['chartType']) : tableProps(input, data);
  const notes = 'notes' in data ? [...data.notes] : [];
  const round = props['chartType'] === 'pie' || props['chartType'] === 'donut';
  if (round && 'series' in data && data.series.length > 1)
    notes.push(`a ${String(props['chartType'])} plots the first series only`);
  const title =
    `${kind === 'chart' ? 'Chart' : 'Table'} · ${input.title ?? input.grid.header[0] ?? 'data'}`.slice(
      0,
      160,
    );
  if (node !== undefined) {
    const steps: AgentToolStep[] = Object.entries(props).map(([key, value]) =>
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
