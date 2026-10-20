import { normalizeIntentText } from '../../intent/normalize-arabic';
import { readNumber, type DataGrid } from '../data-text';
import { isAdditive } from './measures';
import type { GridProfile } from './profile';
import { mean, sum } from './stats';

/**
 * A long table read by its categories (2026-10-14): each measure summed and averaged per value of
 * each repeated category column (region, product), ranked, with each group's share of the total;
 * and, when the table also has a period, a pivot of the first category against the periods — the
 * largest groups as series, the rest folded into one "other" — small enough to chart.
 */

export interface Group {
  readonly key: string;
  readonly sum: number;
  readonly mean: number;
  readonly count: number;
  /** The group's share of the column's total, in percent (additive, non-negative measures). */
  readonly share: number | undefined;
}

export interface Breakdown {
  /** The category column grouped by, and the measure. */
  readonly by: number;
  readonly measure: number;
  /** Largest first (by sum, or by mean for a percent). */
  readonly groups: readonly Group[];
  readonly total: number;
}

export interface Pivot {
  readonly by: number;
  readonly measure: number;
  /** The periods, in first-seen order. */
  readonly periods: readonly string[];
  /** The largest groups, then "other" when more were folded; one value per period (0 when none). */
  readonly series: readonly { readonly name: string; readonly values: readonly number[] }[];
  /** How many groups were folded into the last series. */
  readonly folded: number;
  /** A group/period cell has no observed number; never draw it as an observed zero. */
  readonly incomplete?: true;
}

export const GROUP_LIMITS = {
  /** A category column with more values than this is a label, not a group. */
  distinct: 200,
  /** Category columns grouped, and measures per column. */
  columns: 3,
  measures: 6,
  /** Series a pivot keeps before folding the rest. */
  pivotSeries: 5,
  pivotPeriods: 24,
} as const;

function fold(text: string): string {
  return normalizeIntentText(text).trim();
}

/** Each measure by each repeated category, largest first. */
export function breakdowns(grid: DataGrid, profile: GridProfile): Breakdown[] {
  const out: Breakdown[] = [];
  const columns = profile.groups
    .filter((column) => (profile.columns[column]?.distinct ?? 0) <= GROUP_LIMITS.distinct)
    .slice(0, GROUP_LIMITS.columns);
  for (const by of columns) {
    for (const measure of profile.measures.slice(0, GROUP_LIMITS.measures)) {
      const additive = isAdditive(profile.columns[measure]?.kind ?? 'number');
      const shown = new Map<string, string>();
      const cells = new Map<string, number[]>();
      for (const row of grid.rows) {
        const text = (row[by] ?? '').trim();
        const value = readNumber(row[measure] ?? '')?.value;
        if (text === '' || value === undefined) continue;
        const key = fold(text);
        if (!shown.has(key)) shown.set(key, text);
        cells.set(key, [...(cells.get(key) ?? []), value]);
      }
      const all = [...cells.values()].flat();
      const total = sum(all);
      const shareable = additive && total > 0 && all.every((value) => value >= 0);
      const groups = [...cells.entries()]
        .map(([key, values]) => ({
          key: shown.get(key) ?? key,
          sum: sum(values),
          mean: mean(values) ?? 0,
          count: values.length,
          share: shareable ? (sum(values) / total) * 100 : undefined,
        }))
        .sort((a, b) => (additive ? b.sum - a.sum : b.mean - a.mean));
      if (groups.length > 1) out.push({ by, measure, groups, total });
    }
  }
  return out;
}

/** The first category against the periods for one measure, or undefined when it would not chart. */
export function pivotOf(grid: DataGrid, profile: GridProfile, measure: number): Pivot | undefined {
  const period = profile.period;
  const by = profile.groups.find((column) => column !== period);
  if (period === undefined || by === undefined) return undefined;
  const additive = isAdditive(profile.columns[measure]?.kind ?? 'number');
  const periods: string[] = [];
  const periodKeys: string[] = [];
  const names = new Map<string, string>();
  const cells = new Map<string, Map<string, number[]>>();
  for (const row of grid.rows) {
    const time = (row[period] ?? '').trim();
    const group = (row[by] ?? '').trim();
    const value = readNumber(row[measure] ?? '')?.value;
    if (time === '' || group === '' || value === undefined) continue;
    const timeKey = fold(time);
    if (!periodKeys.includes(timeKey)) {
      periodKeys.push(timeKey);
      periods.push(time);
    }
    const groupKey = fold(group);
    if (!names.has(groupKey)) names.set(groupKey, group);
    const byTime = cells.get(groupKey) ?? new Map<string, number[]>();
    byTime.set(timeKey, [...(byTime.get(timeKey) ?? []), value]);
    cells.set(groupKey, byTime);
  }
  if (periods.length < 2 || periods.length > GROUP_LIMITS.pivotPeriods || cells.size < 2)
    return undefined;
  const incomplete = [...cells.values()].some((byTime) =>
    periodKeys.some((key) => !byTime.has(key)),
  )
    ? { incomplete: true as const }
    : {};
  const line = (byTime: ReadonlyMap<string, number[]>) =>
    periodKeys.map((key) => {
      const values = byTime.get(key) ?? [];
      return values.length === 0 ? 0 : additive ? sum(values) : (mean(values) ?? 0);
    });
  const ranked = [...cells.entries()]
    .map(([key, byTime]) => ({ name: names.get(key) ?? key, values: line(byTime) }))
    .sort((a, b) => sum(b.values) - sum(a.values));
  const kept = ranked.slice(0, GROUP_LIMITS.pivotSeries);
  const rest = ranked.slice(GROUP_LIMITS.pivotSeries);
  if (rest.length === 0 || !additive)
    return { by, measure, periods, series: kept, folded: 0, ...incomplete };
  const other = periodKeys.map((_, index) => sum(rest.map((entry) => entry.values[index] ?? 0)));
  return {
    by,
    measure,
    periods,
    series: [...kept, { name: '', values: other }],
    folded: rest.length,
    ...incomplete,
  };
}
