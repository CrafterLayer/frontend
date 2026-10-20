import { normalizeDigits, type DataGrid } from '../data-text';
import { normalizeIntentText } from '../../intent/normalize-arabic';
import { AR_MONTHS, EN_MONTHS } from './periods';

interface Period {
  readonly family: string;
  readonly value: number;
}

function fold(text: string): string {
  return normalizeDigits(text).trim().toLowerCase().replace(/[أإآ]/gu, 'ا').replace(/ة/gu, 'ه');
}

/** Strict comparable periods; vague or mixed calendars never acquire a numeric trend. */
function periodOf(label: string): Period | undefined {
  const text = fold(label);
  if (/^(?:19|20)\d{2}$/u.test(text)) return { family: 'year', value: Number(text) };
  const iso = /^((?:19|20)\d{2})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/u.exec(text);
  if (iso !== null) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3] ?? 1);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0)) return undefined;
    return iso[3] === undefined
      ? { family: 'month-year', value: year * 12 + month - 1 }
      : { family: 'date', value: Date.UTC(year, month - 1, day) / 86_400_000 };
  }
  const quarter = /^q([1-4])(?:[\s-]+((?:19|20)\d{2}))?$/u.exec(text);
  if (quarter !== null)
    return {
      family: quarter[2] === undefined ? 'quarter' : 'quarter-year',
      value: Number(quarter[2] ?? 0) * 4 + Number(quarter[1]) - 1,
    };
  const counter = /^(week|wk|w|day)\s?(\d{1,3})$/u.exec(text);
  if (counter !== null)
    return { family: counter[1] === 'day' ? 'day' : 'week', value: Number(counter[2]) };
  const month = /^(.+?)(?:[\s-]+((?:19|20)\d{2}))?$/u.exec(text);
  const word = month?.[1]?.replace(/\.$/u, '') ?? '';
  let at = EN_MONTHS.findIndex((name) => name === word || name.slice(0, 3) === word);
  if (at < 0) {
    for (const calendar of AR_MONTHS) {
      at = calendar.findIndex((name) => fold(name) === word);
      if (at >= 0) break;
    }
  }
  if (at >= 0)
    return {
      family: month?.[2] === undefined ? 'month' : 'month-year',
      value: Number(month?.[2] ?? 0) * 12 + at,
    };
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const arabicDays = ['الاثنين', 'الثلاثاء', 'الاربعاء', 'الخميس', 'الجمعه', 'السبت', 'الاحد'];
  const day = days.findIndex(
    (name, index) => name === text || name.slice(0, 3) === text || arabicDays[index] === text,
  );
  return day < 0 ? undefined : { family: 'weekday', value: day };
}

export interface Timeline {
  readonly grid: DataGrid;
  readonly comparable: boolean;
  readonly regular: boolean;
}

/** Sort an analysis copy; the report's source table retains the supplied row order. */
export function timelineOf(grid: DataGrid, column: number | undefined): Timeline {
  if (column === undefined) return { grid, comparable: false, regular: false };
  const rows = grid.rows.map((row) => ({ row, period: periodOf(row[column] ?? '') }));
  const known = rows.filter(({ row }) => (row[column] ?? '').trim() !== '');
  const family = known[0]?.period?.family;
  // Weekday names identify categories, but no date tells us where their week starts.
  if (
    known.length !== rows.length ||
    family === undefined ||
    family === 'weekday' ||
    known.some(({ period }) => period?.family !== family)
  )
    return { grid, comparable: false, regular: false };
  // seriesView groups text labels, not calendar values. Aliases such as Jan/January
  // would otherwise become separate "consecutive" periods for growth and forecasting.
  const labelsByPeriod = new Map<number, string>();
  for (const { row, period } of known) {
    if (period === undefined) continue;
    const label = normalizeIntentText(row[column] ?? '').trim();
    const previous = labelsByPeriod.get(period.value);
    if (previous !== undefined && previous !== label)
      return { grid, comparable: false, regular: false };
    labelsByPeriod.set(period.value, label);
  }
  const ordered = [...rows].sort(
    (a, b) => (a.period?.value ?? Infinity) - (b.period?.value ?? Infinity),
  );
  const values = [
    ...new Set(ordered.flatMap(({ period }) => (period === undefined ? [] : [period.value]))),
  ];
  // A sparse yearless Dec→Jan (or Q4→Q1) could span two years; never guess its direction.
  if (
    (family === 'month' && values.length < 12 && (values.at(-1) ?? 0) - (values[0] ?? 0) > 6) ||
    (family === 'quarter' && values.length < 4 && values.includes(0) && values.includes(3))
  )
    return { grid, comparable: false, regular: false };
  return {
    grid: { ...grid, rows: ordered.map(({ row }) => row) },
    comparable: true,
    regular: values.every(
      (value, index) => index === 0 || value - (values[index - 1] ?? value) === 1,
    ),
  };
}
