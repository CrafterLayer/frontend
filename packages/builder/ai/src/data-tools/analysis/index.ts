/**
 * The report analysis engine (2026-10-14): pure, deterministic, bounded. report.page prints only
 * what these return; see analyze.ts for the entry.
 */
export { ANALYSIS_LIMITS, analyzeGrid, type Analysis, type AnalysisOptions } from './analyze';
export { DERIVED_NAMES, deriveMetrics, type DerivedKind, type DerivedMetric } from './derived';
export {
  NO_UNIT,
  PERCENT_UNIT,
  formatCompact,
  formatCount,
  formatNumber,
  formatPercent,
  formatPoints,
  formatRatio,
  formatValue,
  type ReportLang,
  type Unit,
} from './format';
export {
  GROUP_LIMITS,
  breakdowns,
  pivotOf,
  type Breakdown,
  type Group,
  type Pivot,
} from './groups';
export {
  MAX_INSIGHTS,
  insightsOf,
  type Correlation,
  type Insight,
  type InsightKind,
} from './insights';
export {
  analyseMeasure,
  isAdditive,
  seriesView,
  type Extreme,
  type MeasureAnalysis,
  type SeriesView,
} from './measures';
export { nextPeriodLabel } from './periods';
export {
  columnNamed,
  profileGrid,
  upright,
  type ColumnKind,
  type ColumnProfile,
  type GridProfile,
} from './profile';
export * from './stats';
