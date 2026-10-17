/**
 * An Excel workbook dropped on the agent panel, read as rows (2026-10-14).
 *
 * The owner asked for reports from a FILE: a spreadsheet is what most people have. An .xlsx is a
 * zip of XML parts, so this reads it with fflate's unzip (MIT) and the browser's own XML parser —
 * no spreadsheet library — and keeps only what a report needs: the FIRST sheet's cells as text,
 * shared and inline strings, booleans, numbers without float noise, percentages as "12.5%"
 * (what the data reader takes as a percent), and dates as ISO "2026-01-15" — or "2026-01" for a
 * month format — which the data reader reads as a timeline. Formulas give their cached values.
 *
 * Bounded against a hostile or huge file: only the parts read are inflated, each one capped,
 * and the sheet is cut at `maxRows` × `maxColumns` (`truncated` says so). Anything unreadable
 * throws `XlsxReadError` with a plain sentence; the caller shows the refusal.
 */
import { strFromU8, unzipSync } from 'fflate';

export interface XlsxLimits {
  readonly maxRows?: number;
  readonly maxColumns?: number;
  /** The most bytes one inflated XML part may have. */
  readonly maxPartBytes?: number;
}

export interface XlsxRows {
  readonly sheet: string;
  readonly rows: readonly (readonly string[])[];
  readonly truncated: boolean;
}

export class XlsxReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XlsxReadError';
  }
}

const DEFAULT_LIMITS = { maxRows: 5_000, maxColumns: 40, maxPartBytes: 24 * 1024 * 1024 } as const;
const WORKBOOK = 'xl/workbook.xml';
const WORKBOOK_RELS = 'xl/_rels/workbook.xml.rels';
const SHARED = 'xl/sharedStrings.xml';
const STYLES = 'xl/styles.xml';
const DAY_MS = 86_400_000;
/** Excel's day 0 (the 1900 system, 1899-12-30 once its leap-year bug is accounted for). */
const EPOCH_1900 = Date.UTC(1899, 11, 30);
const EPOCH_1904 = Date.UTC(1904, 0, 1);
/** Built-in number formats that are dates (14–22, 45–47) and percentages (9, 10). */
const DATE_FORMATS: ReadonlySet<number> = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const MONTH_FORMATS: ReadonlySet<number> = new Set([17]);
const PERCENT_FORMATS: ReadonlySet<number> = new Set([9, 10]);

type CellStyle = 'date' | 'month' | 'percent' | 'number';

function parse(xml: string, part: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0)
    throw new XlsxReadError(`The workbook's ${part} is not valid XML.`);
  return doc;
}

function all(node: Document | Element, local: string): Element[] {
  return [...node.getElementsByTagNameNS('*', local)];
}

/** The text of an `<si>` / `<is>`: every `<t>`, rich runs joined, phonetic hints left out. */
function stringItem(item: Element): string {
  return all(item, 't')
    .filter((t) => t.closest('rPh') === null)
    .map((t) => t.textContent)
    .join('');
}

/** A format code that writes a date: d, m with y, or y, outside quotes and [colour] tags. */
function formatStyle(code: string): CellStyle {
  const bare = code.replace(/"[^"]*"|\[[^\]]*\]|\\./gu, '').toLowerCase();
  if (bare.includes('%')) return 'percent';
  if (/[dy]/u.test(bare)) return bare.includes('d') ? 'date' : 'month';
  return 'number';
}

function styles(xml: string | undefined): CellStyle[] {
  if (xml === undefined) return [];
  const doc = parse(xml, 'styles');
  const custom = new Map<number, CellStyle>();
  for (const format of all(doc, 'numFmt'))
    custom.set(
      Number(format.getAttribute('numFmtId')),
      formatStyle(format.getAttribute('formatCode') ?? ''),
    );
  const xfs = all(doc, 'cellXfs')[0];
  if (xfs === undefined) return [];
  return [...xfs.children]
    .filter((xf) => xf.localName === 'xf')
    .map((xf) => {
      const id = Number(xf.getAttribute('numFmtId') ?? 0);
      if (custom.has(id)) return custom.get(id) ?? 'number';
      if (MONTH_FORMATS.has(id)) return 'month';
      if (DATE_FORMATS.has(id)) return 'date';
      return PERCENT_FORMATS.has(id) ? 'percent' : 'number';
    });
}

/** A number as people read it: at most 15 significant digits, no binary noise. */
function cleanNumber(value: number): string {
  return String(Number.parseFloat(value.toPrecision(15)));
}

function dateText(serial: number, epoch: number, month: boolean): string {
  const iso = new Date(epoch + Math.round(serial * DAY_MS)).toISOString();
  return month ? iso.slice(0, 7) : iso.slice(0, 10);
}

/** "AB12" → column 27 (0-based); undefined without letters. */
function columnOf(ref: string | null): number | undefined {
  const letters = /^[A-Z]+/u.exec(ref ?? '')?.[0];
  if (letters === undefined) return undefined;
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function firstSheet(files: Readonly<Record<string, Uint8Array>>): {
  name: string;
  path: string;
  workbook: Document;
} {
  const workbook = files[WORKBOOK];
  if (workbook === undefined) throw new XlsxReadError('This is not an Excel workbook (.xlsx).');
  const doc = parse(strFromU8(workbook), 'workbook');
  const sheet = all(doc, 'sheet')[0];
  if (sheet === undefined) throw new XlsxReadError('The workbook has no sheets.');
  const id =
    sheet.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'id',
    ) ?? sheet.getAttribute('r:id');
  const rels = files[WORKBOOK_RELS];
  const target =
    rels === undefined
      ? undefined
      : all(parse(strFromU8(rels), 'relationships'), 'Relationship')
          .find((rel) => rel.getAttribute('Id') === id)
          ?.getAttribute('Target');
  const path =
    target === undefined || target === null
      ? 'xl/worksheets/sheet1.xml'
      : target.startsWith('/')
        ? target.slice(1)
        : `xl/${target.replace(/^\.\//u, '')}`;
  return { name: sheet.getAttribute('name') ?? 'Sheet1', path, workbook: doc };
}

/** The first sheet of an .xlsx, as rows of text (see the file comment). */
export function readXlsx(bytes: Uint8Array, limits: XlsxLimits = {}): XlsxRows {
  const maxRows = limits.maxRows ?? DEFAULT_LIMITS.maxRows;
  const maxColumns = limits.maxColumns ?? DEFAULT_LIMITS.maxColumns;
  const maxPartBytes = limits.maxPartBytes ?? DEFAULT_LIMITS.maxPartBytes;
  let files: Record<string, Uint8Array>;
  const oversized: string[] = [];
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        const wanted =
          file.name === WORKBOOK ||
          file.name === WORKBOOK_RELS ||
          file.name === SHARED ||
          file.name === STYLES ||
          file.name.startsWith('xl/worksheets/');
        if (wanted && file.originalSize > maxPartBytes) oversized.push(file.name);
        return wanted && file.originalSize <= maxPartBytes;
      },
    });
  } catch {
    throw new XlsxReadError('This file is not a readable Excel workbook (.xlsx).');
  }
  if (oversized.length > 0) throw new XlsxReadError('This workbook is too large to read here.');
  const sheet = firstSheet(files);
  const sheetXml = files[sheet.path];
  if (sheetXml === undefined)
    throw new XlsxReadError(`The workbook's sheet "${sheet.name}" is missing.`);
  const shared =
    files[SHARED] === undefined
      ? []
      : all(parse(strFromU8(files[SHARED]), 'shared strings'), 'si').map(stringItem);
  const cellStyles = styles(files[STYLES] === undefined ? undefined : strFromU8(files[STYLES]));
  const workbookPr = all(sheet.workbook, 'workbookPr')[0];
  const epoch = ['1', 'true'].includes(workbookPr?.getAttribute('date1904') ?? '')
    ? EPOCH_1904
    : EPOCH_1900;

  const rows: string[][] = [];
  let truncated = false;
  for (const row of all(parse(strFromU8(sheetXml), 'sheet'), 'row')) {
    if (rows.length >= maxRows) {
      truncated = true;
      break;
    }
    const out: string[] = [];
    let next = 0;
    for (const cell of [...row.children].filter((child) => child.localName === 'c')) {
      const column = columnOf(cell.getAttribute('r')) ?? next;
      next = column + 1;
      if (column >= maxColumns) {
        truncated = true;
        continue;
      }
      while (out.length < column) out.push('');
      out[column] = cellText(cell, shared, cellStyles, epoch);
    }
    rows.push(out);
  }
  // Trailing empty rows and columns are layout, not data.
  while (rows.length > 0 && (rows.at(-1) ?? []).every((cell) => cell.trim() === '')) rows.pop();
  const width = rows.reduce(
    (max, row) => Math.max(max, row.findLastIndex((cell) => cell.trim() !== '') + 1),
    0,
  );
  return {
    sheet: sheet.name,
    rows: rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? '')),
    truncated,
  };
}

function cellText(
  cell: Element,
  shared: readonly string[],
  cellStyles: readonly CellStyle[],
  epoch: number,
): string {
  const type = cell.getAttribute('t') ?? 'n';
  const value = all(cell, 'v')[0]?.textContent ?? '';
  switch (type) {
    case 's':
      return shared[Number(value)] ?? '';
    case 'inlineStr':
      return all(cell, 'is').map(stringItem).join('');
    case 'str':
    case 'd':
      return value;
    case 'b':
      return value === '1' ? 'TRUE' : 'FALSE';
    case 'e':
      return '';
    default: {
      if (value.trim() === '') return '';
      const number = Number(value);
      if (!Number.isFinite(number)) return value;
      const style = cellStyles[Number(cell.getAttribute('s') ?? 0)] ?? 'number';
      if (style === 'date' || style === 'month') return dateText(number, epoch, style === 'month');
      if (style === 'percent') return `${cleanNumber(number * 100)}%`;
      return cleanNumber(number);
    }
  }
}

/** Rows as CSV: a cell with a comma, quote or line break quoted, its quotes doubled. */
export function rowsToCsv(rows: readonly (readonly string[])[]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => (/[",\r\n]/u.test(cell) ? `"${cell.replace(/"/gu, '""')}"` : cell))
        .join(','),
    )
    .join('\n');
}
