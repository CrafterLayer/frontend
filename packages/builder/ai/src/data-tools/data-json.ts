import type { DataGridRead } from './data-text';

/**
 * JSON rows (2026-10-14), read by readDataText beside CSV and markdown: an array of objects (the
 * keys, in first-seen order, are the headings) or an array of arrays (the first is the headings),
 * bare or under one key (`{"rows":[…]}`). Numbers stay as typed, booleans become words, null is
 * an empty cell; a nested object or array in a cell is refused with its row and key.
 */

/** Columns a JSON object list may spread over before it is refused. */
const MAX_KEYS = 40;

type Cell = string | number;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cellOf(value: unknown): Cell | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  return undefined;
}

function nested(row: number, key: string): DataGridRead {
  return {
    ok: false,
    error: `"data" row ${String(row)}${key === '' ? '' : ` "${key}"`} holds a list or an object; send one value per cell.`,
  };
}

/** The rows of a JSON value as cells, the first row the headings; or the refusal. */
export function jsonRows(value: unknown): (readonly Cell[])[] | DataGridRead {
  let list: unknown = value;
  if (isPlainObject(value)) {
    const arrays = Object.values(value).filter(Array.isArray);
    if (arrays.length !== 1)
      return { ok: false, error: '"data" JSON is an array of rows (objects or arrays).' };
    [list] = arrays;
  }
  if (!Array.isArray(list) || list.length === 0)
    return { ok: false, error: '"data" JSON is an array of rows (objects or arrays).' };
  const rows = list as unknown[];
  if (rows.every(Array.isArray)) {
    const out: Cell[][] = [];
    for (const [index, row] of (rows as unknown[][]).entries()) {
      const cells: Cell[] = [];
      for (const value of row) {
        const cell = cellOf(value);
        if (cell === undefined) return nested(index + 1, '');
        cells.push(cell);
      }
      out.push(cells);
    }
    return out;
  }
  if (!rows.every(isPlainObject))
    return { ok: false, error: '"data" JSON rows are all objects or all arrays.' };
  const keys: string[] = [];
  for (const row of rows)
    for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key);
  if (keys.length > MAX_KEYS)
    return {
      ok: false,
      error: `"data" JSON rows have ${String(keys.length)} keys; send at most ${String(MAX_KEYS)}.`,
    };
  const out: Cell[][] = [keys];
  for (const [index, row] of rows.entries()) {
    const cells: Cell[] = [];
    for (const key of keys) {
      const cell = cellOf(row[key]);
      if (cell === undefined) return nested(index + 1, key);
      cells.push(cell);
    }
    out.push(cells);
  }
  return out;
}

/** Text that is JSON, parsed; undefined when it is not JSON (it is read as a table then). */
export function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  if (!/^[[{]/u.test(trimmed)) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}
