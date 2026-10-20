import {
  formatPoints,
  formatRatio,
  formatValue,
  mean,
  present,
  sum,
  type Analysis,
  type MeasureAnalysis,
  type ReportLang,
  type Unit,
} from './analysis';
import { normalizeIntentText } from '../intent/normalize-arabic';
import { timelineOf } from './analysis/timeline';
import { LIMITS, chartDataFor, chartPropsOf, type ChartType } from './data-chart';
import type { DataGrid } from './data-text';
import type { ReportPageChart } from './report-page-options';
import type { PageWords } from './report-page-words';

/**
 * report.page's charts (2026-10-14), every value from the analysis: the trend (a line or area over
 * the periods, bars across categories), the breakdown (a donut of shares for five groups or
 * fewer, horizontal bars of the top ten otherwise), the pivot (the largest groups over the
 * periods) and the comparison (actual against target, budget against spend or revenue against
 * cost as a combo; else a scatter of the two measures that move together). Kept within the chart
 * block's limits: more than 24 periods are grouped into consecutive runs, more than 24
 * categories keep the largest 23 and fold the rest into "other".
 */

export interface ChartSection {
  readonly key: 'trend' | 'ranking' | 'share' | 'pivot' | 'comparison' | 'selected';
  readonly props: Record<string, unknown>;
}

interface Plot {
  readonly categories: readonly string[];
  readonly series: readonly { readonly name: string; readonly values: readonly number[] }[];
  readonly notes: readonly string[];
}

/** A donut of shares holds this many parts at most; a ranking this many bars before folding. */
export const DONUT_MAX = 6;
export const TOP_BARS = 10;
const LONG_LABEL = 16;

export function clip(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function label(text: string, index: number): string {
  return clip(text === '' ? String(index + 1) : text, LIMITS.label);
}

function sameUnit(a: Unit, b: Unit): boolean {
  return a.prefix === b.prefix && a.suffix === b.suffix;
}

function unitProps(unit: Unit): { prefix?: string; suffix?: string } {
  return {
    ...(unit.prefix.trim() === '' ? {} : { prefix: unit.prefix }),
    ...(unit.suffix.trim() === '' ? {} : { suffix: unit.suffix }),
  };
}

function chart(
  key: ChartSection['key'],
  type: ChartType,
  plot: Plot,
  unit: Unit,
  title: string,
  description: string,
  words: PageWords,
): ChartSection {
  const props = chartPropsOf({ ...plot, ...unitProps(unit) }, type);
  const note = plot.notes.length === 0 ? '' : ` (${plot.notes.join('; ')})`;
  return {
    key,
    props: {
      ...props,
      title: clip(title, 90),
      ...(`${description}${note}`.trim() === ''
        ? {}
        : { description: clip(`${description}${note}`, 240) }),
      otherLabel: clip(words.other, 24),
    },
  };
}

/** Rows as a plot: up to 24 categories — runs of periods grouped, or the largest kept. */
function fitRows(
  labels: readonly string[],
  measures: readonly MeasureAnalysis[],
  timeSeries: boolean,
  words: PageWords,
): Plot {
  const gaps = measures.some((measure) => measure.missing > 0) ? [words.emptyAsZero] : [];
  const max = LIMITS.categories;
  if (labels.length <= max) {
    return {
      categories: labels.map(label),
      series: measures.map((measure) => ({
        name: clip(measure.name, LIMITS.label),
        values: measure.values.map((value) => value ?? 0),
      })),
      notes: gaps,
    };
  }
  if (timeSeries) {
    const size = Math.ceil(labels.length / max);
    const runs = Array.from({ length: Math.ceil(labels.length / size) }, (_, run) => run * size);
    return {
      categories: runs.map((start, index) => {
        const first = labels[start] ?? '';
        const last = labels[Math.min(start + size, labels.length) - 1] ?? '';
        return label(first === last ? first : `${first}–${last}`, index);
      }),
      series: measures.map((measure) => ({
        name: clip(measure.name, LIMITS.label),
        values: runs.map((start) => {
          const cells = present(measure.values.slice(start, start + size));
          return measure.additive ? sum(cells) : (mean(cells) ?? 0);
        }),
      })),
      notes: [words.bucketed, ...gaps],
    };
  }
  const main = measures[0];
  const order = labels
    .map((_, index) => index)
    .sort((a, b) => (main?.values[b] ?? -Infinity) - (main?.values[a] ?? -Infinity));
  const kept = order.slice(0, max - 1);
  const rest = order.slice(max - 1);
  return {
    categories: [
      ...kept.map((index) => label(labels[index] ?? '', index)),
      clip(words.other, LIMITS.label),
    ],
    series: measures.map((measure) => {
      const rows = kept.map((index) => measure.values[index] ?? 0);
      const others = present(rest.map((index) => measure.values[index]));
      return {
        name: clip(measure.name, LIMITS.label),
        values: [...rows, measure.additive ? sum(others) : (mean(others) ?? 0)],
      };
    }),
    notes: gaps,
  };
}

function changeText(measure: MeasureAnalysis, lang: ReportLang, words: PageWords): string {
  if (measure.kind === 'percent')
    return `${formatPoints(measure.change.absolute, lang, true)} ${words.points}`;
  const percent = measure.change.percent;
  return percent === undefined
    ? formatValue(measure.change.absolute, measure.unit, lang, true)
    : formatValue(percent, { prefix: '', suffix: '%' }, lang, true);
}

function trendChart(a: Analysis, words: PageWords, lang: ReportLang): ChartSection | undefined {
  const main = a.measures.find((measure) => measure.missing === 0);
  if (main === undefined) return undefined;
  const same = a.measures
    .filter((measure) => measure.missing === 0 && sameUnit(measure.unit, main.unit))
    .slice(0, LIMITS.series);
  const plot = fitRows(a.labels, same, a.timeSeries, words);
  const heading = a.profile.label === undefined ? '#' : (a.grid.header[a.profile.label] ?? '');
  if (a.timeSeries) {
    const type: ChartType =
      same.length === 1 && main.additive && main.min.value >= 0 ? 'area' : 'line';
    return chart(
      'trend',
      type,
      plot,
      main.unit,
      words.trendTitle(main.name, changeText(main, lang, words), main.first.label, main.last.label),
      main.trend === undefined ? '' : words.fit(formatRatio(main.trend.r2, lang)),
      words,
    );
  }
  const ranked = rankRows(a.labels, same, words);
  const type: ChartType = ranked.categories.some((each) => each.length >= LONG_LABEL)
    ? 'hbar'
    : 'bar';
  return chart(
    'ranking',
    type,
    ranked,
    main.unit,
    words.byTitle(main.name, heading),
    words.highestIs(main.max.label, formatValue(main.max.value, main.unit, lang)),
    words,
  );
}

/** Categories largest first by the main measure: the top ten, the rest folded into "other". */
function rankRows(
  labels: readonly string[],
  measures: readonly MeasureAnalysis[],
  words: PageWords,
): Plot {
  const main = measures[0];
  const order = labels
    .map((_, index) => index)
    .filter((index) => main?.values[index] !== undefined)
    .sort((x, y) => (main?.values[y] ?? 0) - (main?.values[x] ?? 0));
  const kept = order.slice(0, TOP_BARS);
  const rest = order.slice(TOP_BARS);
  const fold = rest.length > 0 && measures.every((measure) => measure.additive);
  return {
    categories: [
      ...kept.map((index) => label(labels[index] ?? '', index)),
      ...(fold ? [clip(words.other, LIMITS.label)] : []),
    ],
    series: measures.map((measure) => ({
      name: clip(measure.name, LIMITS.label),
      values: [
        ...kept.map((index) => measure.values[index] ?? 0),
        ...(fold ? [sum(present(rest.map((index) => measure.values[index])))] : []),
      ],
    })),
    notes: measures.some((measure) => measure.missing > 0) ? [words.emptyAsZero] : [],
  };
}

function sharesChart(
  main: MeasureAnalysis,
  groups: readonly {
    readonly key: string;
    readonly value: number;
    readonly share: number | undefined;
  }[],
  by: string,
  words: PageWords,
  lang: ReportLang,
  donutOnly: boolean,
): ChartSection | undefined {
  if (groups.length < 2) return undefined;
  const sorted = [...groups].sort((a, b) => b.value - a.value);
  const donut = sorted.length <= DONUT_MAX && sorted.every((group) => group.share !== undefined);
  if (!donut && donutOnly) return undefined;
  const kept = donut ? sorted : sorted.slice(0, TOP_BARS);
  const rest = donut ? [] : sorted.slice(TOP_BARS);
  const categories = kept.map((group, index) => label(group.key, index));
  const values = kept.map((group) => group.value);
  if (rest.length > 0 && main.additive) {
    categories.push(clip(words.other, LIMITS.label));
    values.push(sum(rest.map((group) => group.value)));
  }
  const top = sorted[0];
  return chart(
    donut ? 'share' : 'ranking',
    donut ? 'donut' : 'hbar',
    { categories, series: [{ name: clip(main.name, LIMITS.label), values }], notes: [] },
    main.unit,
    words.shareTitle(main.name, by),
    top === undefined ? '' : words.highestIs(top.key, formatValue(top.value, main.unit, lang)),
    words,
  );
}

function breakdownChart(a: Analysis, words: PageWords, lang: ReportLang): ChartSection | undefined {
  const main = a.measures[0];
  if (main === undefined) return undefined;
  if (a.profile.long) {
    const own = a.breakdowns.filter((each) => each.measure === main.column);
    const b = own.find((each) => each.by !== a.profile.label) ?? own[0];
    if (b === undefined) return undefined;
    const groups = b.groups.map((group) => ({
      key: group.key,
      value: main.additive ? group.sum : group.mean,
      share: group.share,
    }));
    /* Grouped by the label itself, the ranking already shows it: only the shares are new. */
    return sharesChart(
      main,
      groups,
      a.grid.header[b.by] ?? '',
      words,
      lang,
      b.by === a.profile.label,
    );
  }
  if (a.timeSeries || main.shares === undefined) return undefined;
  const groups = a.labels.flatMap((key, index) => {
    const value = main.values[index];
    return value === undefined ? [] : [{ key, value, share: main.shares?.[index] }];
  });
  const by = a.profile.label === undefined ? '#' : (a.grid.header[a.profile.label] ?? '');
  return sharesChart(main, groups, by, words, lang, true);
}

function pivotChart(a: Analysis, words: PageWords): ChartSection | undefined {
  const pivot = a.pivot;
  const main = a.measures.find((measure) => measure.column === pivot?.measure);
  if (pivot === undefined || pivot.incomplete === true || main === undefined || main.missing > 0)
    return undefined;
  return chart(
    'pivot',
    'line',
    {
      categories: pivot.periods.map(label),
      series: pivot.series.map((entry) => ({
        name: clip(entry.name === '' ? words.other : entry.name, LIMITS.label),
        values: entry.values,
      })),
      notes: [],
    },
    main.unit,
    words.overTime(main.name, a.grid.header[pivot.by] ?? ''),
    '',
    words,
  );
}

function comparisonChart(
  a: Analysis,
  words: PageWords,
  lang: ReportLang,
): ChartSection | undefined {
  const derived = a.derived[0];
  if (derived !== undefined) {
    const [first, second] = derived.from;
    if (sameUnit(first.unit, second.unit)) {
      const profit = derived.kind === 'profit' ? derived.measures[0] : undefined;
      const measures = profit === undefined ? [first, second] : [first, second, profit];
      const insight = a.insights.find((each) => each.kind === derived.kind);
      if (measures.some((measure) => measure.missing > 0)) return undefined;
      return chart(
        'comparison',
        'combo',
        fitRows(a.labels, measures, a.timeSeries, words),
        first.unit,
        words.versus(first.name, second.name),
        insight?.text[lang] ?? '',
        words,
      );
    }
  }
  const strongest = [...a.correlations].sort((x, y) => Math.abs(y.r) - Math.abs(x.r))[0];
  if (strongest === undefined) return undefined;
  const points = strongest.a.values.flatMap((x, index) => {
    const y = strongest.b.values[index];
    return x === undefined || y === undefined ? [] : [[x, y] as const];
  });
  if (points.length > LIMITS.categories) return undefined;
  return chart(
    'comparison',
    'scatter',
    {
      categories: points.map(([x]) => String(x)),
      series: [{ name: clip(strongest.b.name, LIMITS.label), values: points.map(([, y]) => y) }],
      notes: [],
    },
    strongest.b.unit,
    words.versus(strongest.b.name, strongest.a.name),
    words.correlation(formatRatio(strongest.r, lang)),
    words,
  );
}

/** The page's charts, in reading order; each one only when the data has it to show. */
export function pageCharts(a: Analysis, words: PageWords, lang: ReportLang): ChartSection[] {
  return [
    trendChart(a, words, lang),
    breakdownChart(a, words, lang),
    pivotChart(a, words),
    comparisonChart(a, words, lang),
  ].filter((section): section is ChartSection => section !== undefined);
}

/** Source headings identify chart roles exactly; ambiguous or duplicate headings are rejected. */
function selectColumns(grid: DataGrid, names: readonly string[] | undefined): DataGrid | string {
  if (names === undefined) return grid;
  const fold = (value: string) => normalizeIntentText(value).trim();
  const indices: number[] = [];
  for (const name of names) {
    const found = grid.header.flatMap((heading, index) =>
      fold(heading) === fold(name) ? [index] : [],
    );
    if (found.length !== 1)
      return found.length === 0
        ? `no source column "${name}"; use one of ${grid.header.join(', ')}.`
        : `source column "${name}" is ambiguous; give each column a unique heading.`;
    const index = found[0];
    if (index === undefined) continue;
    if (indices.includes(index))
      return `source column "${name}" is selected twice; select each role once.`;
    indices.push(index);
  }
  return {
    header: indices.map((index) => grid.header[index] ?? ''),
    rows: grid.rows.map((row) => indices.map((index) => row[index] ?? '')),
  };
}

/** Explicit chart selections are fully prepared before the tool emits any document writes. */
export function selectedPageCharts(
  grid: DataGrid,
  selections: readonly ReportPageChart[],
  words: PageWords,
): ChartSection[] | string {
  const charts: ChartSection[] = [];
  for (const [index, selection] of selections.entries()) {
    const prefix = `charts[${String(index)}] (${selection.as}): `;
    const selected = selectColumns(grid, selection.columns);
    if (typeof selected === 'string') return `${prefix}${selected}`;
    const temporal = ['line', 'area', 'combo', 'sparkline', 'candlestick'].includes(selection.as);
    const source = temporal ? timelineOf(selected, 0).grid : selected;
    const data = chartDataFor(source, selection.as);
    if (typeof data === 'string') return `${prefix}${data}`;
    charts.push({
      key: 'selected',
      props: {
        ...chartPropsOf(data, selection.as),
        title: selection.title ?? clip(selected.header.join(' · '), 90),
        ...(data.notes.length === 0 ? {} : { description: clip(data.notes.join('; '), 240) }),
        otherLabel: clip(words.other, 24),
      },
    });
  }
  return charts;
}
