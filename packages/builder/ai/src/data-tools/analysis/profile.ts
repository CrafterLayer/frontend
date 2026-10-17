import { normalizeIntentText } from '../../intent/normalize-arabic';
import { isNumericColumn, isTimeLabel, isTimeline, readNumber, type DataGrid } from '../data-text';
import type { Unit } from './format';

/**
 * What each column of a grid is (2026-10-14), for report.page: a measure (a plain number, a
 * percent or a currency, with the unit the person typed), a period (months, quarters, years,
 * dates), a category (labels, repeated or not) or free text. It also names the label column
 * (the period when there is one, else the first non-numeric column), whether the rows are a time
 * series, and whether the table is LONG — a category that repeats (region × month × value), whose
 * rows are grouped before they are charted. Pure functions, no kernel.
 */

export type ColumnKind =
  'number' | 'percent' | 'currency' | 'period' | 'category' | 'text' | 'empty';

export interface ColumnProfile {
  readonly index: number;
  readonly name: string;
  readonly kind: ColumnKind;
  /** A measure's shared unit; '' parts when the cells carry none or differ. */
  readonly unit: Unit;
  readonly filled: number;
  readonly distinct: number;
  /** A label column whose values repeat: the table is long and is grouped by it. */
  readonly repeated: boolean;
}

export interface GridProfile {
  readonly columns: readonly ColumnProfile[];
  /** The column that labels the rows, or undefined (rows are then numbered). */
  readonly label: number | undefined;
  /** The period column, when one column names times. */
  readonly period: number | undefined;
  /** The category columns that repeat (a long table's dimensions), the label's first. */
  readonly groups: readonly number[];
  /** The numeric columns that are measures, in the grid's order. */
  readonly measures: readonly number[];
  /** Whether the label column (after grouping) is a time axis. */
  readonly timeSeries: boolean;
  /** Whether a dimension repeats, so the rows are aggregated before they are read in order. */
  readonly long: boolean;
}

/** A currency after the number: a sign or a code, Arabic or Latin (folded). */
const CURRENCY_SUFFIX =
  /^(?:\p{Sc}|[A-Z]{3}|ر\.?\s?س|ريال|ر\.?\s?ق|د\.?\s?ا|د\.?\s?ك|درهم|دينار|جنيه|ليره|دولار|يورو)$/u;
const CURRENCY_PREFIX = /^(?:\p{Sc}|[A-Z]{2,3})$/u;
/** A heading that numbers rows rather than measuring them. */
const ID_HEADING = /^(?:id|#|no\.?|number|code|zip|postcode|phone|رقم|الرقم|المعرف|الكود|الهاتف)$/u;
/** A heading that names a time axis for a column of plain years. */
const TIME_HEADING =
  /\b(?:year|yr|fy|period|date|month|quarter|week|day)\b|سنه|السنه|عام|العام|الفتره|التاريخ|الشهر|الربع|الاسبوع|اليوم/u;
/** Free text: a column whose cells average longer than this is notes, not a label. */
const TEXT_LENGTH = 40;

function fold(text: string): string {
  return normalizeIntentText(text).trim();
}

function cellsOf(grid: DataGrid, column: number): string[] {
  return grid.rows.map((row) => (row[column] ?? '').trim());
}

/** The unit every number of a column shares, '' for a part they do not share. */
export function sharedUnit(grid: DataGrid, column: number): Unit {
  const read = cellsOf(grid, column).flatMap((cell) => {
    const number = readNumber(cell);
    return number === undefined ? [] : [number];
  });
  const prefixes = new Set(read.map((number) => number.prefix));
  const suffixes = new Set(read.map((number) => number.suffix));
  return {
    prefix: prefixes.size === 1 ? ([...prefixes][0] ?? '') : '',
    suffix: suffixes.size === 1 ? ([...suffixes][0] ?? '') : '',
  };
}

function measureKind(unit: Unit): ColumnKind {
  if (unit.suffix.trim() === '%') return 'percent';
  if (CURRENCY_PREFIX.test(unit.prefix.trim()) || CURRENCY_SUFFIX.test(unit.suffix.trim()))
    return 'currency';
  return 'number';
}

function profileColumn(grid: DataGrid, column: number): ColumnProfile {
  const name = grid.header[column] ?? '';
  const cells = cellsOf(grid, column).filter((cell) => cell !== '');
  const distinct = new Set(cells.map(fold)).size;
  const base = {
    index: column,
    name,
    filled: cells.length,
    distinct,
    unit: { prefix: '', suffix: '' },
  };
  if (cells.length === 0) return { ...base, kind: 'empty', repeated: false };
  if (isNumericColumn(grid, column)) {
    const years =
      cells.every((cell) => isTimeLabel(cell)) &&
      (column === 0 || TIME_HEADING.test(fold(name)) || isTimeLabel(name));
    if (years) return { ...base, kind: 'period', repeated: distinct < cells.length };
    const unit = sharedUnit(grid, column);
    return { ...base, unit, kind: measureKind(unit), repeated: false };
  }
  if (cells.every((cell) => isTimeLabel(cell)))
    return { ...base, kind: 'period', repeated: distinct < cells.length };
  const length = cells.reduce((total, cell) => total + cell.length, 0) / cells.length;
  if (length > TEXT_LENGTH) return { ...base, kind: 'text', repeated: false };
  return { ...base, kind: 'category', repeated: distinct < cells.length };
}

function isMeasure(column: ColumnProfile): boolean {
  return (
    (column.kind === 'number' || column.kind === 'percent' || column.kind === 'currency') &&
    !ID_HEADING.test(fold(column.name))
  );
}

export interface ProfileOptions {
  /** The heading of the column to read as the period or label. */
  readonly period?: string | undefined;
  /** The headings of the measures to read, in this order. */
  readonly measures?: readonly string[] | undefined;
}

/** The column named `name` (folded), or undefined. */
export function columnNamed(grid: DataGrid, name: string): number | undefined {
  const index = grid.header.findIndex((heading) => fold(heading) === fold(name));
  return index < 0 ? undefined : index;
}

/** The grid's profile, or the refusal for an option that names no column. */
export function profileGrid(grid: DataGrid, options: ProfileOptions = {}): GridProfile | string {
  const columns = grid.header.map((_, column) => profileColumn(grid, column));
  const named = options.period === undefined ? undefined : columnNamed(grid, options.period);
  if (options.period !== undefined && named === undefined)
    return `"period": no column "${options.period}"; use one of ${grid.header.join(', ')}.`;
  const period = named ?? columns.find((column) => column.kind === 'period')?.index;
  const dimensions = columns.filter(
    (column) => column.index !== period && (column.kind === 'category' || column.kind === 'period'),
  );
  const label = period ?? dimensions[0]?.index;
  let measures = columns
    .filter((column) => column.index !== label && isMeasure(column))
    .map(({ index }) => index);
  if (options.measures !== undefined) {
    const picked: number[] = [];
    for (const name of options.measures) {
      const index = columnNamed(grid, name);
      if (index === undefined || !measures.includes(index))
        return `"measures": no numeric column "${name}"; use one of ${measures.map((at) => grid.header[at] ?? '').join(', ')}.`;
      if (!picked.includes(index)) picked.push(index);
    }
    measures = picked;
  }
  const groups = dimensions.filter((column) => column.repeated).map(({ index }) => index);
  const periodRepeats = period !== undefined && (columns[period]?.repeated ?? false);
  const labels =
    label === undefined ? [] : [...new Set(cellsOf(grid, label).filter((cell) => cell !== ''))];
  return {
    columns,
    label,
    period,
    groups,
    measures,
    timeSeries: period !== undefined && isTimeline(labels),
    long: groups.length > 0 || periodRepeats,
  };
}

/**
 * A grid whose headings are the times ("Metric,2022,2023" with one row per metric) turned so the
 * times are rows: the analysis reads periods down the label column.
 */
export function upright(grid: DataGrid): DataGrid {
  const across =
    isTimeline(grid.header.slice(1)) && !isTimeline(grid.rows.map((row) => row[0] ?? ''));
  if (!across || grid.rows.length === 0) return grid;
  const names = grid.rows.map((row, index) => (row[0] ?? '').trim() || `#${String(index + 1)}`);
  return {
    header: [grid.header[0]?.trim() === '' ? 'Period' : (grid.header[0] ?? 'Period'), ...names],
    rows: grid.header
      .slice(1)
      .map((time, column) => [time, ...grid.rows.map((row) => row[column + 1] ?? '')]),
  };
}
