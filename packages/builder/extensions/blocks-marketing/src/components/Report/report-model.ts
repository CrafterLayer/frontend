/**
 * What a report computes from its one dataset: each KPI card's number and its
 * change against the previous row, which element shows the in-place editor
 * for a label printed in several places, and the props its chart is drawn
 * with. Pure and React-free (types only), like the chart's models.
 */
import type { ReactNode } from 'react';

import { committed, type Drawing, type Part } from '../Chart/chart-drawing';
import { formatValue } from '../Chart/chart-format';
import { chartSchema, type ChartProps } from '../Chart/schema';
import type { ReportProps } from './schema';

export type KpiDirection = 'up' | 'down' | 'flat';

export interface KpiChange {
  readonly direction: KpiDirection;
  /** Whether the change goes the KPI's `better` way; undefined when flat. */
  readonly good: boolean | undefined;
  /** The signed share, isolated left to right so its sign stays in front on an RTL page: `+12.5%`. */
  readonly text: string;
}

export interface KpiModel {
  readonly index: number;
  /** Undefined when the KPI's column has no value. */
  readonly value: number | undefined;
  /** The number as printed, without the prefix and suffix (they render as parts around it). */
  readonly digits: string;
  /** The explicit baseline, or the previous row for a `last` KPI. */
  readonly change: KpiChange | undefined;
  readonly comparisonValue: number | undefined;
  readonly unitless: boolean;
  readonly trend: readonly number[];
  readonly target:
    | { readonly value: number; readonly met: boolean; readonly percent: number | undefined }
    | undefined;
}

/* Past this, a card's number shortens ("1.2M"): a card is read at a glance. */
const COMPACT_FROM = 100_000;

type ReportData = Pick<ReportProps, 'categories' | 'series'>;

/** A column's values, cut to the categories: a value with no row is not part of the report. */
export function columnValues(props: ReportData, series: number): number[] {
  return (props.series[series]?.values ?? []).slice(0, props.categories.length);
}

function measured(values: readonly number[], measure: ReportProps['kpis'][number]['measure']) {
  if (values.length === 0) return measure === 'count' ? 0 : undefined;
  const total = values.reduce((sum, value) => sum + value, 0);
  switch (measure) {
    case 'total':
      return total;
    case 'average':
      return Number.isFinite(total)
        ? total / values.length
        : values.reduce((sum, value) => sum + value / values.length, 0);
    case 'count':
      return values.length;
    case 'median': {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const upper = sorted[middle];
      const lower = sorted[middle - 1];
      if (sorted.length % 2 === 1) return upper;
      if (lower === undefined || upper === undefined) return undefined;
      const pair = lower + upper;
      // Divide after addition when possible: dividing subnormal values first loses them.
      return Number.isFinite(pair) ? pair / 2 : lower / 2 + upper / 2;
    }
    case 'max':
      return Math.max(...values);
    case 'min':
      return Math.min(...values);
    default:
      return values.at(-1);
  }
}

/** The last value against the one before it, or undefined when there is no earlier non-zero value. */
export function changeOf(
  values: readonly number[],
  better: ReportProps['kpis'][number]['better'],
): KpiChange | undefined {
  const last = values.at(-1);
  const previous = values.at(-2);
  if (last === undefined || previous === undefined || previous === 0) return undefined;
  const ratio = last / Math.abs(previous) - previous / Math.abs(previous);
  const tenths = Math.round(ratio * 1000) / 10;
  if (!Number.isFinite(tenths)) return undefined;
  if (tenths === 0) return { direction: 'flat', good: undefined, text: '0%' };
  const direction: KpiDirection = tenths > 0 ? 'up' : 'down';
  const sign = direction === 'up' ? '+' : '−';
  return {
    direction,
    good: direction === better,
    text: `⁦${sign}${String(Math.abs(tenths))}%⁩`,
  };
}

/** Every KPI card's number and change, from the column it names. */
export function kpiModels(props: Pick<ReportProps, 'categories' | 'series' | 'kpis'>): KpiModel[] {
  return props.kpis.map((kpi, index) => {
    const values = columnValues(props, kpi.series);
    const measuredValue = measured(values, kpi.measure);
    const value =
      measuredValue !== undefined && Number.isFinite(measuredValue) ? measuredValue : undefined;
    const ratio =
      kpi.target !== undefined && kpi.target > 0 && value !== undefined && value >= 0
        ? (value / kpi.target) * 100
        : undefined;
    return {
      index,
      value,
      digits:
        value === undefined
          ? ''
          : formatValue(value, {}, Math.abs(value) >= COMPACT_FROM ? 'compact' : 'plain'),
      change:
        kpi.comparisonValue !== undefined && value !== undefined
          ? changeOf([kpi.comparisonValue, value], kpi.better)
          : kpi.measure === 'last'
            ? changeOf(values, kpi.better)
            : undefined,
      comparisonValue: kpi.comparisonValue,
      unitless: kpi.measure === 'count',
      trend: kpi.measure === 'count' ? [] : values,
      target:
        kpi.target === undefined || value === undefined
          ? undefined
          : {
              value: kpi.target,
              met: kpi.better === 'down' ? value <= kpi.target : value >= kpi.target,
              percent: ratio !== undefined && Number.isFinite(ratio) ? ratio : undefined,
            },
    };
  });
}

/*
  A label a report prints in several places — the value prefix and suffix on
  every number, a category in the chart and the table, the change label on
  every card — is ONE part. While it is edited in place its value is the editor
  element, which must render once: the host shows it, the others show
  committed text only.
*/
export interface ReportHosts {
  /** The value prefix and suffix: the first KPI with a number, else the table, else the chart. */
  readonly affixes: 'kpis' | 'table' | 'chart';
  /** The KPI index that shows the value affixes, when `affixes` is `kpis`. */
  readonly affixKpi: number;
  /** The KPI index whose change hosts `changeLabel`; -1 when no card shows a change. */
  readonly changeKpi: number;
  /** The first explicit baseline hosts its separate comparison caption. */
  readonly comparisonKpi: number;
  /** First goal caption hosts its editor; the chart otherwise owns it. */
  readonly targetKpi: number;
  /** Whether the table shows (and so hosts) every category and column name. */
  readonly labelsInTable: boolean;
}

export function reportHosts(
  props: Pick<ReportProps, 'categories' | 'series' | 'showTable'>,
  kpis: readonly KpiModel[],
): ReportHosts {
  const affixKpi = kpis.findIndex(
    (kpi) => (kpi.value !== undefined || kpi.comparisonValue !== undefined) && !kpi.unitless,
  );
  const labelsInTable = props.showTable && props.categories.length > 0 && props.series.length > 0;
  const tableHasValue =
    labelsInTable && props.series.some((_, series) => columnValues(props, series).length > 0);
  return {
    affixes: affixKpi >= 0 ? 'kpis' : tableHasValue ? 'table' : 'chart',
    affixKpi,
    changeKpi: kpis.findIndex(
      (kpi) => kpi.change !== undefined && kpi.comparisonValue === undefined,
    ),
    comparisonKpi: kpis.findIndex((kpi) => kpi.comparisonValue !== undefined),
    targetKpi: kpis.findIndex((kpi) => kpi.target !== undefined),
    labelsInTable,
  };
}

/** What the report's card and table helpers share. */
export interface ReportView {
  readonly props: ReportProps;
  readonly part: Part;
  /** Prints a number between the report's own prefix and suffix parts. */
  readonly values: Drawing;
  readonly hosts: ReportHosts;
  /** Secondary text that stays legible on the ground it sits on. */
  readonly muted: string;
  /* A card's ink sits on its children: a dark section's slab rules revert it on the card itself. */
  readonly ink: string | undefined;
}

/* The chart's settings a report does not expose, read once from the Chart schema's defaults. */
const CHART_DEFAULTS: ChartProps = chartSchema.props.parse({});

function committedText(value: ReactNode | undefined): string | undefined {
  return value === undefined ? undefined : committed(value);
}

/**
 * The props the report's chart is drawn with. `labels` and `affixes` say
 * whether the chart shows the label as it is (it hosts the editor) or only
 * its committed text (another element hosts it).
 */
export function reportChartProps(
  props: ReportProps,
  shown: {
    readonly labels: 'raw' | 'committed';
    readonly affixes: 'raw' | 'committed';
    readonly target?: 'raw' | 'committed';
  },
): ChartProps {
  const labels = shown.labels === 'raw';
  const affixes = shown.affixes === 'raw';
  return {
    ...CHART_DEFAULTS,
    chartType: props.chartType,
    maxValue: props.maxValue,
    targetValue: props.targetValue,
    targetLabel:
      shown.target === 'committed'
        ? committed(props.targetLabel ?? CHART_DEFAULTS.targetLabel)
        : (props.targetLabel ?? CHART_DEFAULTS.targetLabel),
    categories: labels ? props.categories : props.categories.map((category) => committed(category)),
    series: labels
      ? props.series
      : props.series.map((entry) => ({ ...entry, name: committed(entry.name) })),
    stacked: props.stacked,
    otherLabel: props.otherLabel,
    showLegend: props.showLegend,
    showValues: props.showValues,
    showGrid: props.showGrid,
    palette: props.palette,
    height: props.height,
    variant: 'plain',
    tone: props.tone,
    valuePrefix: affixes ? props.valuePrefix : committedText(props.valuePrefix),
    valueSuffix: affixes ? props.valueSuffix : committedText(props.valueSuffix),
  };
}
