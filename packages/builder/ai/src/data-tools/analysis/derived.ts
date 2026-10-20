import { normalizeIntentText } from '../../intent/normalize-arabic';
import { readNumber, type DataGrid } from '../data-text';
import { PERCENT_UNIT, type Unit } from './format';
import { analyseMeasure, seriesView, type MeasureAnalysis } from './measures';
import type { GridProfile } from './profile';
import { sum, type Cells } from './stats';

/**
 * The figures a table's headings imply (2026-10-14): revenue beside cost is a profit and a margin,
 * actual beside target is an attainment, budget beside spend is what remains. Found by an English
 * and Arabic vocabulary (folded, like report.build's cost words), computed row by row where both
 * cells are given, and overall from the sums — never a figure the person's cells do not hold.
 */

export type DerivedKind = 'profit' | 'attainment' | 'remaining';

export interface Bilingual {
  readonly en: string;
  readonly ar: string;
}

export interface DerivedMetric {
  readonly kind: DerivedKind;
  /** The two given measures it comes from: revenue & cost, actual & target, budget & spend. */
  readonly from: readonly [MeasureAnalysis, MeasureAnalysis];
  /** The rows' derived values as measures: profit and margin %, attainment %, remaining. */
  readonly measures: readonly MeasureAnalysis[];
  /** Overall: the margin %, the attainment %, or the remaining amount. */
  readonly overall: number;
  /** The sums over the rows where both are given (revenue & cost, actual & target, budget & spend). */
  readonly totals: readonly [number, number];
}

const REVENUE = /\b(?:revenues?|sales|income|turnover)\b|ايراد|مبيعات|دخل/u;
const COST = /\b(?:costs?|expenses?|cogs|expenditures?)\b|تكلف|تكاليف|مصروف|مصاريف|نفقات/u;
const ACTUAL = /\b(?:actuals?|achieved|results?)\b|فعلي|محقق|منجز/u;
const TARGET = /\b(?:targets?|goals?|plan(?:ned)?|quotas?|objectives?)\b|مستهدف|هدف|المخطط/u;
const BUDGET = /\b(?:budgets?|allocated|allocations?)\b|ميزانيه|موازنه|مخصص/u;
const SPEND = /\b(?:spend|spent|spending|used|expenditures?)\b|صرف|مصروف|منفق|انفاق/u;

export const DERIVED_NAMES: Readonly<Record<string, Bilingual>> = {
  profit: { en: 'Profit', ar: 'الربح' },
  margin: { en: 'Margin', ar: 'هامش الربح' },
  attainment: { en: 'Attainment', ar: 'نسبة التحقق' },
  remaining: { en: 'Remaining', ar: 'المتبقي' },
};

const PAIRS: readonly (readonly [DerivedKind, RegExp, RegExp])[] = [
  ['remaining', BUDGET, SPEND],
  ['attainment', ACTUAL, TARGET],
  ['profit', REVENUE, COST],
];

function fold(text: string): string {
  return normalizeIntentText(text).trim();
}

function both(a: Cells, b: Cells, each: (x: number, y: number) => number | undefined): Cells {
  return a.map((x, index) => {
    const y = b[index];
    return x === undefined || y === undefined ? undefined : each(x, y);
  });
}

function sums(a: Cells, b: Cells): readonly [number, number] {
  const pairs = a.flatMap((x, index) => {
    const y = b[index];
    return x === undefined || y === undefined ? [] : [[x, y] as const];
  });
  return [sum(pairs.map(([x]) => x)), sum(pairs.map(([, y]) => y))];
}

function sameUnit(a: Unit, b: Unit): boolean {
  return a.prefix.trim() === b.prefix.trim() && a.suffix.trim() === b.suffix.trim();
}

interface DerivedSource {
  readonly grid: DataGrid;
  readonly profile: GridProfile;
  readonly regularPeriods: boolean;
}

/** Match both cells on the original row before any long-table totals can hide a missing cell. */
function paired(
  a: MeasureAnalysis,
  b: MeasureAnalysis,
  source: DerivedSource | undefined,
): readonly [Cells, Cells] {
  if (source?.profile.long !== true) return [a.values, b.values];
  const rows = source.grid.rows.map((row) => {
    if (
      readNumber(row[a.column] ?? '') !== undefined &&
      readNumber(row[b.column] ?? '') !== undefined
    )
      return row;
    return row.map((value, index) => (index === a.column || index === b.column ? '' : value));
  });
  const view = seriesView(
    { ...source.grid, rows },
    { ...source.profile, measures: [a.column, b.column] },
  );
  return [view.values.get(a.column) ?? [], view.values.get(b.column) ?? []];
}

/** A derived measure: its bilingual name in the page's language, computed values, `given: false`. */
function measureOf(
  column: number,
  key: string,
  lang: 'en' | 'ar',
  unit: Unit,
  values: Cells,
  labels: readonly string[],
  timeSeries: boolean,
  kind: 'number' | 'percent' | 'currency',
): MeasureAnalysis | undefined {
  return analyseMeasure(
    { column, name: DERIVED_NAMES[key]?.[lang] ?? key, kind, unit, values, given: false },
    labels,
    timeSeries,
  );
}

/** The derived metrics the headings imply; each given measure feeds one pair at most. */
export function deriveMetrics(
  measures: readonly MeasureAnalysis[],
  labels: readonly string[],
  timeSeries: boolean,
  lang: 'en' | 'ar',
  source?: DerivedSource,
): DerivedMetric[] {
  const used = new Set<number>();
  /* Derived measures take negative columns: -1, -2 … in the order they are made. */
  let next = 0;
  const out: DerivedMetric[] = [];
  const find = (words: RegExp) =>
    measures.find(
      (measure) => measure.additive && !used.has(measure.column) && words.test(fold(measure.name)),
    );
  for (const [kind, firstWords, secondWords] of PAIRS) {
    const first = find(firstWords);
    if (first === undefined) continue;
    used.add(first.column);
    const second = find(secondWords);
    if (second === undefined || !sameUnit(first.unit, second.unit)) {
      used.delete(first.column);
      continue;
    }
    const [aValues, bValues] = paired(first, second, source);
    const a = analyseMeasure(
      { ...first, values: aValues },
      labels,
      timeSeries,
      source?.regularPeriods,
    );
    const b = analyseMeasure(
      { ...second, values: bValues },
      labels,
      timeSeries,
      source?.regularPeriods,
    );
    if (a === undefined || b === undefined) {
      used.delete(first.column);
      continue;
    }
    used.add(b.column);
    const totals = sums(a.values, b.values);
    const derived: (MeasureAnalysis | undefined)[] = [];
    let overall: number | undefined;
    if (kind === 'profit') {
      const profit = both(a.values, b.values, (x, y) => x - y);
      const unit = a.unit;
      derived.push(
        measureOf(
          --next,
          'profit',
          lang,
          unit,
          profit,
          labels,
          timeSeries && (source?.regularPeriods ?? true),
          a.kind === 'currency' ? 'currency' : 'number',
        ),
      );
      derived.push(
        measureOf(
          --next,
          'margin',
          lang,
          PERCENT_UNIT,
          both(a.values, b.values, (x, y) => (x === 0 ? undefined : ((x - y) / x) * 100)),
          labels,
          timeSeries && (source?.regularPeriods ?? true),
          'percent',
        ),
      );
      overall = totals[0] === 0 ? undefined : ((totals[0] - totals[1]) / totals[0]) * 100;
    } else if (kind === 'attainment') {
      derived.push(
        measureOf(
          --next,
          'attainment',
          lang,
          PERCENT_UNIT,
          both(a.values, b.values, (x, y) => (y === 0 ? undefined : (x / y) * 100)),
          labels,
          timeSeries && (source?.regularPeriods ?? true),
          'percent',
        ),
      );
      overall = totals[1] === 0 ? undefined : (totals[0] / totals[1]) * 100;
    } else {
      derived.push(
        measureOf(
          --next,
          'remaining',
          lang,
          a.unit,
          both(a.values, b.values, (x, y) => x - y),
          labels,
          timeSeries && (source?.regularPeriods ?? true),
          a.kind === 'currency' ? 'currency' : 'number',
        ),
      );
      overall = totals[0] - totals[1];
    }
    const kept = derived.filter((measure): measure is MeasureAnalysis => measure !== undefined);
    if (overall === undefined || kept.length === 0) continue;
    out.push({ kind, from: [a, b], measures: kept, overall, totals });
  }
  return out;
}
