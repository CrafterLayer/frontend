import {
  formatCompact,
  formatPoints,
  formatValue,
  PERCENT_UNIT,
  type Analysis,
  type MeasureAnalysis,
  type ReportLang,
  type Unit,
} from './analysis';
import { LIMITS } from './data-chart';
import { isNumericColumn } from './data-text';
import { clip } from './report-page-charts';
import type { PageWords } from './report-page-words';

/**
 * report.page's words-and-numbers sections (2026-10-14), every figure from the analysis: the
 * header with its KPI cards (a stats block: the period, the title, the headline finding and up to
 * six cards — each main measure's total or latest value with its change, the derived margin,
 * attainment or remainder, the compound growth), the findings (a rich-text list of the computed
 * sentences), the summary table (per measure: total, average, min, max, change, CAGR) and the
 * data table (the first 50 rows, eight columns) whose caption is the method note.
 */

export interface Kpi {
  readonly value: string;
  readonly label: string;
  readonly detail?: string | undefined;
}

export const MAX_KPIS = 4;
/** The stats block's limits: a card's value, label and detail, and the header's eyebrow and body. */
const CARD = { value: 24, label: 56, detail: 100, eyebrow: 40, heading: 90, body: 200 } as const;

/** A value that fits a card: every digit, else shortened — never cut. */
function cardValue(value: number, unit: Unit, lang: ReportLang, signed = false): string {
  const full = formatValue(value, unit, lang, signed);
  return full.length <= CARD.value ? full : clip(formatCompact(value, unit, lang), CARD.value);
}

function changeOf(m: MeasureAnalysis, words: PageWords, lang: ReportLang): string | undefined {
  if (m.count < 2) return undefined;
  if (m.kind === 'percent') return `${formatPoints(m.change.absolute, lang, true)} ${words.points}`;
  const percent = m.change.percent;
  return percent === undefined
    ? formatValue(m.change.absolute, m.unit, lang, true)
    : formatValue(percent, PERCENT_UNIT, lang, true);
}

/** The last row against the one before it: a percent change (points for a percent column). */
function lastStep(m: MeasureAnalysis, words: PageWords, lang: ReportLang): string | undefined {
  const last = m.values.at(-1);
  const before = m.values.at(-2);
  if (last === undefined || before === undefined) return undefined;
  if (m.kind === 'percent') return `${formatPoints(last - before, lang, true)} ${words.points}`;
  const growth = m.growth.at(-1);
  return growth === undefined
    ? formatValue(last - before, m.unit, lang, true)
    : formatValue(growth, PERCENT_UNIT, lang, true);
}

/**
 * The header's key stats, at most four, all of the main measure, in its unit: on a timeline the
 * total (a percent column has none), the average, the latest with its change against the
 * previous period and the compound growth, and the highest with its period; across categories
 * the total, the average, the highest and the lowest with their categories.
 */
export function kpiCards(a: Analysis, words: PageWords, lang: ReportLang): Kpi[] {
  const m = a.measures[0];
  if (m === undefined) return [];
  const card = (word: string, value: number, detail?: string): Kpi => ({
    value: cardValue(value, m.unit, lang),
    label: clip(`${m.name} · ${word}`, CARD.label),
    ...(detail === undefined ? {} : { detail: clip(detail, CARD.detail) }),
  });
  const cards: Kpi[] = [];
  if (m.additive) cards.push(card(words.total, m.sum, words.rows(m.count)));
  if (m.count >= 2)
    cards.push(
      card(
        words.average,
        m.mean,
        words.spread(formatValue(m.median, m.unit, lang), formatValue(m.stdev, m.unit, lang)),
      ),
    );
  if (a.timeSeries) {
    const step = lastStep(m, words, lang);
    const parts = [
      ...(step === undefined ? [] : [words.vsPrevious(step)]),
      ...(m.cagr === undefined || m.count < 3
        ? []
        : [words.cagrShort(formatValue(m.cagr, PERCENT_UNIT, lang, true))]),
    ];
    cards.push(card(words.latest, m.last.value, [m.last.label, ...parts].join(' · ')));
    if (m.count >= 2) cards.push(card(words.highest, m.max.value, m.max.label));
  } else if (m.count >= 2) {
    cards.push(card(words.highest, m.max.value, m.max.label));
    cards.push(card(words.lowest, m.min.value, m.min.label));
  } else {
    cards.push(card(words.latest, m.last.value, m.last.label));
  }
  return cards.slice(0, MAX_KPIS);
}

export interface Header {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  /** The model's summary when it did not fit beside the headline: the findings open with it. */
  readonly leftover: string | undefined;
}

export function headerOf(
  a: Analysis,
  words: PageWords,
  lang: ReportLang,
  title: string | undefined,
  summary: string | undefined,
): Header {
  const main = a.measures[0];
  const eyebrow = a.timeSeries
    ? words.span(a.labels[0] ?? '', a.labels.at(-1) ?? '')
    : words.rows(a.rows);
  const headline = a.insights[0]?.text[lang] ?? '';
  const both = summary === undefined ? headline : `${headline} ${summary}`.trim();
  const fits = both.length <= CARD.body;
  return {
    eyebrow: clip(eyebrow, CARD.eyebrow),
    heading: clip(title ?? words.report(main?.name ?? ''), CARD.heading),
    body: clip(fits ? both : headline === '' ? (summary ?? '') : headline, CARD.body),
    leftover: fits || headline === '' ? undefined : summary,
  };
}

/** The findings as rich text: a heading, the leftover summary, the sentences as a list. */
export function findingsDoc(
  a: Analysis,
  words: PageWords,
  lang: ReportLang,
  leftover: string | undefined,
): unknown {
  const text = (value: string) => [{ type: 'text', text: value }];
  const items = a.insights.map((insight) => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content: text(insight.text[lang]) }],
  }));
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: text(words.findings) },
      ...(leftover === undefined ? [] : [{ type: 'paragraph', content: text(leftover) }]),
      ...(items.length === 0 ? [] : [{ type: 'bulletList', content: items }]),
    ],
  };
}

export interface TableShape {
  readonly title: string;
  readonly caption?: string | undefined;
  readonly columns: readonly {
    readonly label: string;
    readonly align: 'start' | 'end';
    /** How the Table block sorts the column: 'number', 'date' (ISO dates) or 'auto'. */
    readonly sortAs: 'auto' | 'number' | 'date';
  }[];
  readonly rows: readonly { readonly cells: readonly string[] }[];
}

const cell = (text: string) => clip(text, LIMITS.cell);

/** Per measure — the given ones, then the derived — its total, average, min, max, change, CAGR. */
export function summaryTable(a: Analysis, words: PageWords, lang: ReportLang): TableShape {
  const c = words.columns;
  const growth = a.timeSeries && a.measures.some((m) => m.cagr !== undefined);
  const headings = [
    c.measure,
    c.total,
    c.average,
    c.min,
    c.max,
    ...(a.timeSeries ? [c.change] : []),
    ...(growth ? [c.cagr] : []),
  ];
  const measures = [...a.measures, ...a.derived.flatMap((d) => d.measures)].slice(0, LIMITS.rows);
  const f = (value: number, unit: Unit) => formatValue(value, unit, lang);
  return {
    title: words.summaryTitle,
    /* Min and max carry their label ("120 (Jan)"): sorted as read; the other figures as numbers. */
    columns: headings.map((label, index) => ({
      label: clip(label, LIMITS.heading),
      align: index === 0 ? 'start' : 'end',
      sortAs: index === 0 || label === c.min || label === c.max ? 'auto' : 'number',
    })),
    rows: measures.map((m) => ({
      cells: [
        cell(m.name),
        m.additive ? f(m.sum, m.unit) : '—',
        f(m.mean, m.unit),
        cell(`${f(m.min.value, m.unit)} (${m.min.label})`),
        cell(`${f(m.max.value, m.unit)} (${m.max.label})`),
        ...(a.timeSeries ? [changeOf(m, words, lang) ?? '—'] : []),
        ...(growth
          ? [m.cagr === undefined ? '—' : formatValue(m.cagr, PERCENT_UNIT, lang, true)]
          : []),
      ],
    })),
  };
}

const ISO_DATE = /^\d{4}-\d{2}(?:-\d{2})?(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/u;

/** A numeric column sorts as numbers, a column of ISO dates as dates, anything else as read. */
function sortAsOf(a: Analysis, column: number): 'auto' | 'number' | 'date' {
  const cells = a.grid.rows.map((row) => (row[column] ?? '').trim()).filter((cell) => cell !== '');
  if (cells.length > 0 && cells.every((cell) => ISO_DATE.test(cell))) return 'date';
  return isNumericColumn(a.grid, column) ? 'number' : 'auto';
}

/** The data as given: the first 50 rows and 8 columns, numbers aligned to the end. */
export function dataTable(a: Analysis, words: PageWords, lang: ReportLang): TableShape {
  const columns = a.grid.header.slice(0, LIMITS.columns);
  const rows = a.grid.rows.slice(0, LIMITS.rows);
  return {
    title: words.dataTitle,
    caption: clip(words.method(a.totalRows, a.columns, rows.length, a.totalRows, lang), 160),
    columns: columns.map((label, index) => ({
      label: clip(label === '' ? `#${String(index + 1)}` : label, LIMITS.heading),
      align: index > 0 && isNumericColumn(a.grid, index) ? 'end' : 'start',
      sortAs: sortAsOf(a, index),
    })),
    rows: rows.map((row) => ({ cells: row.slice(0, LIMITS.columns).map(cell) })),
  };
}

/** KPI cards as a table, for a site with no stats block. */
export function kpiTable(cards: readonly Kpi[], header: Header, words: PageWords): TableShape {
  return {
    title: header.heading,
    caption: clip(`${header.eyebrow} · ${header.body}`, 160),
    columns: [
      { label: words.figure, align: 'start', sortAs: 'auto' },
      { label: words.value, align: 'end', sortAs: 'number' },
      { label: words.detail, align: 'start', sortAs: 'auto' },
    ],
    rows: cards.map((card) => ({ cells: [cell(card.label), card.value, cell(card.detail ?? '')] })),
  };
}

/** The findings as a one-column table, for a site with no rich-text block. */
export function findingsTable(a: Analysis, words: PageWords, lang: ReportLang): TableShape {
  return {
    title: words.findings,
    columns: [{ label: words.finding, align: 'start', sortAs: 'auto' }],
    rows: a.insights.map((insight) => ({ cells: [cell(insight.text[lang])] })),
  };
}
