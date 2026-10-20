import { normalizeIntentText } from '../intent/normalize-arabic';
import { isRecord, rootIdOf, setProp, unknownKeys } from '../tools/agent/shared';
import {
  defineAgentTool,
  type AgentToolContext,
  type AgentToolParse,
  type AgentToolRun,
} from '../tools/agent/types';
import { CHART_TYPES, autoChart, chartData, chartDataFor, chartPropsOf } from './data-chart';
import { blockTypeWith, placeIndex } from './data-place';
import {
  columnUnit,
  isNumericColumn,
  readDataRows,
  readDataText,
  type DataGrid,
} from './data-text';

/**
 * report.build (2026-10-12) — one dataset as a whole report section in one call: a title (and a
 * summary), up to four KPI cards, one chart and the table. `data` is what data.show reads (CSV,
 * TSV, a markdown table or rows of cells, the first row the headings). The KPI cards are the
 * numeric columns (the first four) unless `kpis` names them: each shows the column's last value
 * and its change against the previous row, judged good when it goes up — or down, for a column
 * that names a cost ("Costs", «المصاريف»). The chart is picked as data.show picks one, among the
 * types a report draws. Inserted after `after`, else at the end above the footer.
 */

export const REPORT_CHART_TYPES = CHART_TYPES;
export const REPORT_AS = ['auto', ...REPORT_CHART_TYPES] as const;
export type ReportAs = (typeof REPORT_AS)[number];

const MEASURES = ['last', 'total', 'average', 'max', 'min', 'median', 'count'] as const;
const MAX_KPIS = 8;

export interface ReportKpiInput {
  readonly column: string;
  readonly label?: string | undefined;
  readonly measure?: (typeof MEASURES)[number] | undefined;
  readonly better?: 'up' | 'down' | undefined;
  readonly comparisonValue?: number | undefined;
  readonly target?: number | undefined;
  readonly detail?: string | undefined;
}

export interface ReportBuildInput {
  readonly grid: DataGrid;
  readonly as: ReportAs;
  readonly title?: string | undefined;
  readonly summary?: string | undefined;
  readonly comparisonLabel?: string | undefined;
  readonly kpis?: readonly ReportKpiInput[] | undefined;
  readonly after?: string | undefined;
  readonly id?: string | undefined;
  readonly showTrends?: boolean | undefined;
  readonly showTable?: boolean | undefined;
  readonly stacked?: boolean | undefined;
}

const KEYS = [
  'data',
  'title',
  'summary',
  'comparisonLabel',
  'kpis',
  'as',
  'after',
  'id',
  'showTrends',
  'showTable',
  'stacked',
] as const;
const KPI_KEYS = [
  'column',
  'label',
  'measure',
  'better',
  'comparisonValue',
  'target',
  'detail',
] as const;

/* A column whose falling is good news: costs, refunds, churn, complaints (folded Arabic). */
const LOWER_IS_BETTER =
  /\b(?:costs?|expenses?|spend(?:ing)?|churn|refunds?|returns?|complaints?|bounces?|bounce rate|cancell?ations?|errors?|defects?|debts?|loss(?:es)?|wait(?:ing)? time|delays?)\b|تكلف|تكاليف|مصروف|مصاريف|انفاق|الغاء|الغاءات|مرتجع|استرجاع|شكاو|خساره|خسائر|ديون|اعطال|تاخير|انتظار/u;

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

function kpiOf(value: unknown, index: number): AgentToolParse<ReportKpiInput> {
  if (typeof value === 'string' && value.trim() !== '')
    return { ok: true, value: { column: value.trim() } };
  if (!isRecord(value))
    return no(
      `"kpis" ${String(index + 1)}: a column heading, or {column,measure?,better?,label?}.`,
    );
  const extra = unknownKeys(value, KPI_KEYS);
  if (extra.length > 0) return no(`"kpis" ${String(index + 1)}: unknown keys ${extra.join(', ')}.`);
  const column = text(value['column'], 'column', 60);
  if (!column.ok || column.value === undefined)
    return no(`"kpis" ${String(index + 1)} needs its "column".`);
  const label = text(value['label'], 'label', 40);
  if (!label.ok) return label;
  const measure = value['measure'];
  if (measure !== undefined && !(MEASURES as readonly unknown[]).includes(measure))
    return no(`"measure" is one of ${MEASURES.join(', ')}.`);
  const better = value['better'];
  if (better !== undefined && better !== 'up' && better !== 'down')
    return no('"better" is "up" or "down".');
  const detail = text(value['detail'], 'detail', 120);
  if (!detail.ok) return detail;
  for (const key of ['comparisonValue', 'target'] as const) {
    if (
      value[key] !== undefined &&
      (typeof value[key] !== 'number' || !Number.isFinite(value[key]))
    )
      return no(`"${key}" must be a finite number in the KPI's unit.`);
  }
  return {
    ok: true,
    value: {
      column: column.value,
      label: label.value,
      measure: measure as ReportKpiInput['measure'],
      better,
      comparisonValue: value['comparisonValue'] as number | undefined,
      target: value['target'] as number | undefined,
      detail: detail.value,
    },
  };
}

function parse(input: unknown): AgentToolParse<ReportBuildInput> {
  if (!isRecord(input))
    return no('input must be {"data":"Month,Sales\\nJan,120\\nFeb,140","title?":"…"}.');
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
  if (typeof as !== 'string' || !(REPORT_AS as readonly string[]).includes(as))
    return no(`"as" is one of ${REPORT_AS.join(', ')}.`);
  const fields: Record<string, string | undefined> = {};
  for (const [key, max] of [
    ['title', 90],
    ['summary', 320],
    ['comparisonLabel', 40],
    ['after', 120],
    ['id', 120],
  ] as const) {
    const field = text(input[key], key, max);
    if (!field.ok) return field;
    fields[key] = field.value;
  }
  if (fields['id'] !== undefined && fields['after'] !== undefined)
    return no('"id" updates a report; "after" inserts a new one. Use only one.');
  const flags: { showTrends?: boolean; showTable?: boolean; stacked?: boolean } = {};
  for (const key of ['showTrends', 'showTable', 'stacked'] as const) {
    const value = input[key];
    if (value !== undefined && typeof value !== 'boolean') return no(`"${key}" must be a boolean.`);
    if (typeof value === 'boolean') flags[key] = value;
  }
  let kpis: ReportKpiInput[] | undefined;
  if (input['kpis'] !== undefined) {
    if (!Array.isArray(input['kpis']) || input['kpis'].length > MAX_KPIS)
      return no(`"kpis" is a list of at most ${String(MAX_KPIS)} column headings.`);
    kpis = [];
    for (const [index, entry] of (input['kpis'] as unknown[]).entries()) {
      const kpi = kpiOf(entry, index);
      if (!kpi.ok) return kpi;
      kpis.push(kpi.value);
    }
  }
  return {
    ok: true,
    value: {
      grid: read.grid,
      as: as as ReportAs,
      ...fields,
      ...flags,
      ...(kpis === undefined ? {} : { kpis }),
    },
  };
}

function fold(name: string): string {
  return normalizeIntentText(name).trim();
}

/** The KPI cards: the ones named, else the first four columns; a cost-like column is better down. */
function kpiCards(
  names: readonly string[],
  asked: readonly ReportKpiInput[] | undefined,
): Record<string, unknown>[] | string {
  const wanted: readonly ReportKpiInput[] =
    asked ?? names.slice(0, 4).map((column) => ({ column }));
  const cards: Record<string, unknown>[] = [];
  for (const kpi of wanted) {
    const series = names.findIndex((name) => fold(name) === fold(kpi.column));
    if (series < 0)
      return `"kpis": no numeric column "${kpi.column}"; use one of ${names.join(', ')}.`;
    const label = (kpi.label ?? names[series] ?? kpi.column).slice(0, 40);
    cards.push({
      label,
      series,
      measure: kpi.measure ?? 'last',
      better: kpi.better ?? (LOWER_IS_BETTER.test(fold(names[series] ?? '')) ? 'down' : 'up'),
      ...(kpi.target === undefined ? {} : { target: kpi.target }),
      ...(kpi.comparisonValue === undefined ? {} : { comparisonValue: kpi.comparisonValue }),
      ...(kpi.detail === undefined ? {} : { detail: kpi.detail }),
    });
  }
  return cards;
}

/** A data refresh retains the author's cards, matching source names instead of column positions. */
function retainedKpis(
  props: Readonly<Record<string, unknown>>,
  names: readonly string[],
  unit: { readonly prefix?: string | undefined; readonly suffix?: string | undefined },
): readonly ReportKpiInput[] | string | undefined {
  const prior = props['kpis'];
  const series = props['series'];
  if (!Array.isArray(prior) || !Array.isArray(series)) return undefined;
  const sameUnit = ['prefix', 'suffix'].every((part) => {
    const old = props[part === 'prefix' ? 'valuePrefix' : 'valueSuffix'];
    const next = part === 'prefix' ? unit.prefix : unit.suffix;
    return (typeof old === 'string' ? old.trim() : '') === (next?.trim() ?? '');
  });
  const cards: ReportKpiInput[] = [];
  for (const card of prior) {
    if (!isRecord(card) || typeof card['series'] !== 'number')
      return 'existing KPI configuration is incompatible; supply "kpis" explicitly.';
    const source: unknown = series[card['series']];
    const name = isRecord(source) ? source['name'] : undefined;
    if (
      typeof name !== 'string' ||
      names.filter((entry) => fold(entry) === fold(name)).length !== 1
    )
      return 'existing KPI source columns changed or are ambiguous; supply "kpis" explicitly.';
    if (!sameUnit && (card['target'] !== undefined || card['comparisonValue'] !== undefined))
      return 'KPI units changed; supply "kpis" with targets and comparisons in the new unit.';
    const parsed = kpiOf(
      {
        column: name,
        ...Object.fromEntries(
          KPI_KEYS.filter((key) => key !== 'column' && card[key] !== undefined).map((key) => [
            key,
            card[key],
          ]),
        ),
      },
      cards.length,
    );
    if (!parsed.ok) return parsed.error;
    cards.push(parsed.value);
  }
  return cards;
}

function run(input: ReportBuildInput, context: AgentToolContext): AgentToolRun {
  const { kernel } = context;
  const type = blockTypeWith(kernel, 'report', ['kpis', 'categories', 'series']);
  if (type === undefined)
    return {
      ok: false,
      error: 'this site has no report block; use data.show for a chart or a table.',
    };
  const existing = input.id === undefined ? undefined : kernel.getDocument().nodes[input.id];
  if (input.id !== undefined && existing?.type !== type)
    return { ok: false, error: '"id" must identify an existing report block on this page.' };
  const units = new Set(
    input.grid.header.flatMap((_, column) =>
      column > 0 && isNumericColumn(input.grid, column)
        ? [columnUnit(input.grid, column) ?? 'mixed']
        : [],
    ),
  );
  if (units.size > 1 || units.has('mixed'))
    return {
      ok: false,
      error:
        'a compact report uses one value unit; use report.page for measures with different units.',
    };
  const priorType = existing?.props['chartType'];
  const as =
    input.as === 'auto' &&
    typeof priorType === 'string' &&
    (CHART_TYPES as readonly string[]).includes(priorType)
      ? (priorType as ReportAs)
      : input.as;
  const base = as === 'auto' ? chartData(input.grid) : undefined;
  if (typeof base === 'string')
    return { ok: false, error: base.replace('send as "table"', 'use data.show with "as":"table"') };
  const words = [input.title, input.summary, input.grid.header[0]].join(' ');
  const chartType =
    as === 'auto' ? (base === undefined ? 'bar' : autoChart(input.grid, base, words)) : as;
  const data = chartDataFor(input.grid, chartType);
  if (typeof data === 'string') return { ok: false, error: data };
  const names = data.series.map((entry) => entry.name);
  const retained =
    input.kpis === undefined && existing !== undefined
      ? retainedKpis(existing.props, names, data)
      : undefined;
  if (typeof retained === 'string') return { ok: false, error: retained };
  const kpis = kpiCards(
    names,
    input.kpis ??
      retained ??
      (chartType === 'histogram'
        ? [{ column: 'Count', label: 'Observations', measure: 'total' }]
        : undefined),
  );
  if (typeof kpis === 'string') return { ok: false, error: kpis };
  const index = placeIndex(context, input.after);
  if (typeof index === 'string') return { ok: false, error: index };
  const title = (
    input.title ??
    (typeof existing?.props['title'] === 'string' ? existing.props['title'] : undefined) ??
    data.series.map((entry) => entry.name).join(' · ')
  ).slice(0, 90);
  const props = {
    ...chartPropsOf(data, chartType),
    ...(existing?.props['valuePrefix'] !== undefined && data.prefix === undefined
      ? { valuePrefix: ' ' }
      : {}),
    ...(existing?.props['valueSuffix'] !== undefined && data.suffix === undefined
      ? { valueSuffix: ' ' }
      : {}),
    title,
    kpis,
    ...(chartType === 'histogram'
      ? { dataNote: data.notes.join(' · ').slice(0, 320) }
      : existing?.props['dataNote'] === undefined
        ? {}
        : { dataNote: ' ' }),
    ...(input.summary === undefined ? {} : { summary: input.summary }),
    ...(input.comparisonLabel === undefined ? {} : { comparisonLabel: input.comparisonLabel }),
    ...(input.showTrends === undefined ? {} : { showTrends: input.showTrends }),
    ...(input.showTable === undefined ? {} : { showTable: input.showTable }),
    ...(input.stacked === undefined ? {} : { stacked: input.stacked }),
  };
  if (existing !== undefined)
    return {
      ok: true,
      steps: Object.entries(props).map(([key, value]) => setProp(existing.id, key, value)),
      note: `updated report ${existing.id} · ${String(kpis.length)} KPIs · ${chartType}`,
    };
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
        title: `Report · ${title}`.slice(0, 160),
      },
    ],
    note: [
      `report · ${String(kpis.length)} KPIs · ${chartType} chart · ${String(data.categories.length)} rows`,
      ...data.notes,
    ].join(' · '),
  };
}

export const reportBuildTool = defineAgentTool<ReportBuildInput>({
  name: 'report.build',
  lanes: ['edit', 'build'],
  summary: 'Rows as KPI cards, chart and table',
  signature: '{data,title?,summary?,kpis?,as?,id?,after?,showTrends?,showTable?,stacked?}',
  parse,
  run,
});
