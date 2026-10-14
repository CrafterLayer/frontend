import { jsonRows } from './data-json';
import { readDataRows, readDataText, type DataGridRead } from './data-text';

/**
 * A tool's `data` (2026-10-14), as report.page reads it: text (CSV, TSV, a markdown table or
 * JSON), rows of cells (the first the headings), or an array of row objects.
 */
export function readDataInput(data: unknown): DataGridRead {
  if (typeof data === 'string') return readDataText(data);
  if (Array.isArray(data)) {
    const rows = jsonRows(data);
    return Array.isArray(rows) ? readDataRows(rows) : rows;
  }
  return {
    ok: false,
    error:
      '"data" is CSV/TSV/markdown/JSON text, rows of cells or row objects, the first row the headings.',
  };
}
