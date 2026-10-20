import type { DataGrid } from '../data-text';
import { deriveMetrics, type Bilingual, type DerivedMetric } from './derived';
import type { ReportLang } from './format';
import { breakdowns, pivotOf, type Breakdown, type Pivot } from './groups';
import { insightsOf, type Correlation, type Insight } from './insights';
import { analyseMeasure, seriesView, type MeasureAnalysis, type SeriesView } from './measures';
import { nextPeriodLabel } from './periods';
import { profileGrid, upright, type GridProfile } from './profile';
import { qualityNotes } from './quality';
import { pearson } from './stats';
import { timelineOf } from './timeline';

/**
 * The analysis engine's one entry (2026-10-14): a grid → its profile, every measure's statistics,
 * the derived metrics its headings imply, a long table's breakdowns and pivot, the correlations
 * and the ranked findings. Deterministic and bounded: at most ANALYSIS_LIMITS rows and columns
 * are read, so a pasted spreadsheet cannot stall the page. report.page prints only what this
 * returns.
 */

export const ANALYSIS_LIMITS = {
  rows: 5_000,
  columns: 24,
  /** Measures read through (the page charts the first six). */
  measures: 12,
  /** Measures paired for correlation. */
  correlated: 6,
  /** |r| from which two measures are said to move together. */
  correlation: 0.7,
} as const;

export interface AnalysisOptions {
  readonly measures?: readonly string[] | undefined;
  readonly period?: string | undefined;
  /** The language of derived measure names (profit, margin); default English. */
  readonly lang?: ReportLang | undefined;
}

export interface Analysis {
  /** The grid read: upright (times down the rows) and cut to ANALYSIS_LIMITS.rows. */
  readonly grid: DataGrid;
  readonly profile: GridProfile;
  readonly view: SeriesView;
  readonly labels: readonly string[];
  readonly timeSeries: boolean;
  /** The given measures, in order (the first is the main one). */
  readonly measures: readonly MeasureAnalysis[];
  readonly derived: readonly DerivedMetric[];
  readonly breakdowns: readonly Breakdown[];
  readonly pivot: Pivot | undefined;
  readonly correlations: readonly Correlation[];
  readonly insights: readonly Insight[];
  /** Source coverage and calculation caveats, shown beside the findings. */
  readonly quality: readonly Bilingual[];
  /** The label after the last period, for the projection. */
  readonly nextLabel: string | undefined;
  /** Rows given and rows read (they differ past the limit). */
  readonly totalRows: number;
  readonly rows: number;
  readonly columns: number;
}

/** The analysis of a grid, or the refusal that says how to send it. */
export function analyzeGrid(input: DataGrid, options: AnalysisOptions = {}): Analysis | string {
  if (input.header.length > ANALYSIS_LIMITS.columns)
    return `"data" has ${String(input.header.length)} columns; send at most ${String(ANALYSIS_LIMITS.columns)} (the label column and the measures that matter).`;
  const turned = upright(input);
  if (turned.header.length > ANALYSIS_LIMITS.columns)
    return `Transposed "data" has ${String(turned.header.length)} columns; send at most ${String(ANALYSIS_LIMITS.columns)} measures and labels.`;
  const grid: DataGrid =
    turned.rows.length > ANALYSIS_LIMITS.rows
      ? { ...turned, rows: turned.rows.slice(0, ANALYSIS_LIMITS.rows) }
      : turned;
  const profile = profileGrid(grid, options);
  if (typeof profile === 'string') return profile;
  if (profile.measures.length === 0)
    return 'no column holds numbers to analyse; use data.show with "as":"table" for text.';
  const kept: GridProfile = {
    ...profile,
    measures: profile.measures.slice(0, ANALYSIS_LIMITS.measures),
  };
  const timeline = timelineOf(grid, kept.period);
  const ordered = timeline.grid;
  const view = seriesView(ordered, kept);
  const { labels } = view;
  const timeSeries = kept.timeSeries && timeline.comparable;
  const measures = kept.measures.flatMap((column) => {
    const own = kept.columns[column];
    const values = view.values.get(column);
    if (own === undefined || values === undefined) return [];
    const measure = analyseMeasure(
      { column, name: own.name, kind: own.kind, unit: own.unit, values },
      labels,
      timeSeries,
      timeline.regular,
    );
    return measure === undefined ? [] : [measure];
  });
  if (measures.length === 0) return 'every numeric cell is empty; send the rows with their values.';
  const derived = deriveMetrics(measures, labels, timeSeries, options.lang ?? 'en', {
    grid: ordered,
    profile: kept,
    regularPeriods: timeline.regular,
  });
  const groups = kept.long ? breakdowns(ordered, kept) : [];
  const main = measures[0];
  const pivot = !timeSeries || main === undefined ? undefined : pivotOf(ordered, kept, main.column);
  const correlations: Correlation[] = [];
  const paired = measures.slice(0, ANALYSIS_LIMITS.correlated);
  for (const [index, a] of paired.entries()) {
    for (const b of paired.slice(index + 1)) {
      const r = pearson(a.values, b.values);
      if (r !== undefined && Math.abs(r) >= ANALYSIS_LIMITS.correlation)
        correlations.push({ a, b, r });
    }
  }
  const nextLabel = timeSeries ? nextPeriodLabel(labels) : undefined;
  const insights = insightsOf({
    labels,
    timeSeries,
    measures,
    derived,
    breakdowns: groups,
    correlations,
    headings: grid.header,
    nextLabel,
  });
  return {
    grid,
    profile: kept,
    view,
    labels,
    timeSeries,
    measures,
    derived,
    breakdowns: groups,
    pivot,
    correlations,
    insights,
    quality: qualityNotes(grid, kept, turned.rows.length, timeline, pivot?.incomplete),
    nextLabel,
    totalRows: turned.rows.length,
    rows: grid.rows.length,
    columns: grid.header.length,
  };
}
