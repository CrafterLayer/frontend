/**
 * data.show's reading (2026-10-12): the rows-and-columns a model or a person pastes — CSV, TSV,
 * a semicolon list or a markdown pipe table — as a header and rows of text, and each cell as a
 * number when it reads as one. Numbers are read the way people write them: Arabic-Indic digits,
 * thousands separators, a currency before (`$`, `€`, `SAR `), a unit after (`%`, ` kg`), `k`/`M`/
 * `B` multipliers, and a minus or accounting brackets. Pure functions, no kernel.
 *
 * 2026-10-14: JSON too — an array of objects or of arrays (data-json.ts).
 */
import { jsonRows, parseJsonText } from './data-json';

export type DataAlign = 'start' | 'center' | 'end';

export interface DataGrid {
  /** The first row: the column headings. */
  readonly header: readonly string[];
  /** Every other row, each as long as the header (short rows padded with ''). */
  readonly rows: readonly (readonly string[])[];
  /** A markdown table's alignment row, column by column, when it had one. */
  readonly aligns?: readonly (DataAlign | undefined)[] | undefined;
}

export type DataGridRead =
  { readonly ok: true; readonly grid: DataGrid } | { readonly ok: false; readonly error: string };

export interface DataNumber {
  readonly value: number;
  /** What stood before the number: a currency sign or code, as typed (`$`, `SAR `). */
  readonly prefix: string;
  /** What stood after it: a unit (`%`, ` kg`, ` ر.س`). */
  readonly suffix: string;
}

const DIGIT_BASES = [0x0660, 0x06f0] as const;
const MULTIPLIERS: Readonly<Record<string, number>> = { k: 1e3, K: 1e3, M: 1e6, B: 1e9, bn: 1e9 };

/** Arabic-Indic and Persian digits as ASCII, Arabic separators and signs as their Latin twins. */
export function normalizeDigits(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const base = DIGIT_BASES.find((start) => code >= start && code <= start + 9);
    out += base === undefined ? char : String(code - base);
  }
  return out
    .replace(/٫/gu, '.')
    .replace(/٬/gu, ',')
    .replace(/٪/gu, '%')
    .replace(/−/gu, '-')
    .replace(/[   ]/gu, ' ');
}

/** A currency before the number: one currency sign, or a 2-3 letter code with its space. */
const PREFIX = /^(?:\p{Sc}|[A-Z]{2,3}\s?)$/u;
/** A unit after it: no digits, at most twelve characters. */
const SUFFIX = /^[^\d]{1,12}$/u;
const NUMBER = /^(?:\d{1,3}(?:[,' ]\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?|\.\d+)/u;

/** A cell as a number, or undefined when it is text (or empty). */
export function readNumber(cell: string): DataNumber | undefined {
  let rest = normalizeDigits(cell).trim();
  if (rest === '') return undefined;
  let negative = false;
  if (/^\(.*\)$/u.test(rest)) {
    negative = true;
    rest = rest.slice(1, -1).trim();
  }
  const sign = (): void => {
    if (rest.startsWith('-') || rest.startsWith('+')) {
      negative = negative || rest.startsWith('-');
      rest = rest.slice(1).trimStart();
    }
  };
  sign();
  const prefixMatch = /^[^\d.+-]*/u.exec(rest)?.[0] ?? '';
  if (prefixMatch !== '' && !PREFIX.test(prefixMatch)) return undefined;
  rest = rest.slice(prefixMatch.length);
  sign();
  const digits = NUMBER.exec(rest)?.[0];
  if (digits === undefined) return undefined;
  rest = rest.slice(digits.length);
  // "1,5" is a decimal comma; "1,500" and "1 500" group thousands.
  const grouped = /^\d{1,3}(?:[,' ]\d{3})+(?:\.\d+)?$/u.test(digits);
  let value = Number(grouped ? digits.replace(/[,' ]/gu, '') : digits.replace(',', '.'));
  const multiplier = /^(?:bn|[kKMB])(?![\p{L}])/u.exec(rest)?.[0];
  if (multiplier !== undefined) {
    value *= MULTIPLIERS[multiplier] ?? 1;
    rest = rest.slice(multiplier.length);
  }
  if (rest !== '' && !SUFFIX.test(rest)) return undefined;
  if (!Number.isFinite(value)) return undefined;
  return { value: negative ? -value : value, prefix: prefixMatch, suffix: rest };
}

/** One CSV line, honouring double quotes ("a, b" stays one cell; "" is a quote). */
function splitQuoted(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? '';
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (char === delimiter) {
      cells.push(cell.trim());
      cell = '';
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

const ALIGN_ROW = /^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?$/u;

function alignOf(cell: string): DataAlign | undefined {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'end';
  return left ? 'start' : undefined;
}

function pipeCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => cell.trim());
}

function delimiterOf(lines: readonly string[]): string {
  if (lines.some((line) => line.includes('\t'))) return '\t';
  if (lines.some((line) => line.includes(';')) && !lines.some((line) => line.includes(',')))
    return ';';
  return ',';
}

/** A grid from its text; the first line is the header. */
export function readDataText(text: string): DataGridRead {
  const json = parseJsonText(text);
  if (json !== undefined) {
    const rows = jsonRows(json);
    return Array.isArray(rows) ? readDataRows(rows) : rows;
  }
  const lines = text
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '');
  if (lines.length < 2)
    return {
      ok: false,
      error: '"data" needs a header line and at least one row, e.g. "Month,Sales\\nJan,120".',
    };
  const pipe = lines.every((line) => line.includes('|'));
  let aligns: (DataAlign | undefined)[] | undefined;
  const cells: string[][] = [];
  for (const line of lines) {
    if (pipe && ALIGN_ROW.test(line.trim())) {
      aligns ??= pipeCells(line).map(alignOf);
      continue;
    }
    cells.push(pipe ? pipeCells(line) : splitQuoted(line, delimiterOf(lines)));
  }
  const [header] = cells;
  if (!pipe && header !== undefined && delimiterOf(lines) === ',') {
    for (const [index, row] of cells.entries())
      if (index > 0) cells[index] = rejoinThousands(row, header.length);
  }
  return gridOf(cells, aligns);
}

/**
 * An unquoted "$1,200" in CSV splits into "$1" and "200": while a row is longer than the header,
 * a cell ending in a digit and a next cell of exactly three digits (plus decimals or a unit)
 * are one number again.
 */
function rejoinThousands(row: readonly string[], width: number): string[] {
  const cells = [...row];
  for (let index = 0; cells.length > width && index < cells.length - 1;) {
    const here = cells[index] ?? '';
    const next = cells[index + 1] ?? '';
    if (/\d$/u.test(here) && /^\d{3}(?:\.\d+)?[^\d,]{0,12}$/u.test(next)) {
      cells.splice(index, 2, `${here},${next}`);
    } else index += 1;
  }
  return cells;
}

/** A grid from rows of cells (numbers kept as typed); the first row is the header. */
export function readDataRows(rows: readonly (readonly unknown[])[]): DataGridRead {
  const cells: string[][] = [];
  for (const [index, row] of rows.entries()) {
    const out: string[] = [];
    for (const cell of row) {
      if (typeof cell === 'number' && Number.isFinite(cell)) out.push(String(cell));
      else if (typeof cell === 'string') out.push(cell.trim());
      else if (cell === null || cell === undefined) out.push('');
      else
        return {
          ok: false,
          error: `"data" row ${String(index + 1)}: every cell is a string or a number.`,
        };
    }
    cells.push(out);
  }
  if (cells.length < 2)
    return { ok: false, error: '"data" needs a header row and at least one row of values.' };
  return gridOf(cells, undefined);
}

function gridOf(
  cells: readonly string[][],
  aligns: readonly (DataAlign | undefined)[] | undefined,
): DataGridRead {
  const [header = [], ...rows] = cells;
  const width = header.length;
  if (width < 2 && rows.every((row) => row.length < 2)) {
    return { ok: false, error: '"data" needs at least two columns: labels, then values.' };
  }
  for (const [index, row] of rows.entries()) {
    if (row.length > width) {
      return {
        ok: false,
        error: `"data" row ${String(index + 2)} has ${String(row.length)} cells but the header has ${String(width)}; quote a cell that holds the separator.`,
      };
    }
  }
  return {
    ok: true,
    grid: {
      header,
      rows: rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => '')]),
      ...(aligns === undefined ? {} : { aligns }),
    },
  };
}

/** Whether every non-empty cell of a column is a number (and one is). */
/** The unit a column's numbers share (`$`, `%`, ` min`), or undefined when they differ. */
export function columnUnit(grid: DataGrid, column: number): string | undefined {
  const units = new Set(
    grid.rows.flatMap((row) => {
      const number = readNumber(row[column] ?? '');
      return number === undefined ? [] : [`${number.prefix.trim()}|${number.suffix.trim()}`];
    }),
  );
  return units.size === 1 ? [...units][0] : undefined;
}

export function isNumericColumn(grid: DataGrid, column: number): boolean {
  const cells = grid.rows.map((row) => row[column] ?? '').filter((cell) => cell.trim() !== '');
  return cells.length > 0 && cells.every((cell) => readNumber(cell) !== undefined);
}

const EN_MONTH =
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/u;
const EN_DAY =
  /^(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs?(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)$/u;
/** Arabic months (both calendars) and days, folded (hamza, taa marbuta, alef maqsura). */
const AR_TIME = new Set([
  'يناير',
  'فبراير',
  'مارس',
  'ابريل',
  'مايو',
  'يونيو',
  'يوليو',
  'اغسطس',
  'سبتمبر',
  'اكتوبر',
  'نوفمبر',
  'ديسمبر',
  'كانون',
  'شباط',
  'اذار',
  'نيسان',
  'ايار',
  'حزيران',
  'تموز',
  'اب',
  'ايلول',
  'تشرين',
  'الاثنين',
  'الثلاثاء',
  'الاربعاء',
  'الخميس',
  'الجمعه',
  'السبت',
  'الاحد',
]);
const TIME_WORDS =
  /^(?:q[1-4]|h[12]|w(?:eek)?\s?\d{1,2}|day\s?\d{1,3}|الربع|الاسبوع|الشهر|اليوم|السنه|عام)/u;
const TIME_NUMBER =
  /^(?:(?:19|20)\d{2}(?:[-/.](?:0?[1-9]|1[0-2])(?:[-/.]\d{1,2})?)?|fy\s?'?\d{2}|'\d{2})$/u;

function fold(text: string): string {
  return normalizeDigits(text)
    .trim()
    .toLocaleLowerCase()
    .replace(/[أإآ]/gu, 'ا')
    .replace(/ة/gu, 'ه')
    .replace(/ى/gu, 'ي');
}

/** Whether a label names a time: a month, day, quarter, week or year. */
export function isTimeLabel(label: string): boolean {
  const folded = fold(label);
  if (folded === '') return false;
  if (TIME_NUMBER.test(folded) || TIME_WORDS.test(folded)) return true;
  const first = folded.split(/[\s,./-]+/u)[0] ?? '';
  return EN_MONTH.test(first) || EN_DAY.test(first) || AR_TIME.has(first);
}

/** Whether every label of a list names a time (and there are at least two). */
export function isTimeline(labels: readonly string[]): boolean {
  return labels.length >= 2 && labels.every(isTimeLabel);
}
