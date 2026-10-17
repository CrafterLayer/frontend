/*
  Grid arithmetic for `s.lib.procgen` (procedural maps, 2026-10-13): plain code over a
  Uint8Array of cells (1 = wall, 0 = floor), shared by every generator. Breadth-first search
  gives distances and shortest paths (every step costs one, so BFS is exact and needs no heap),
  connectivity is enforced by keeping the largest floor region, and a map becomes ASCII rows for
  `s.lib.tilemap.world`. No rot.js here: generators make the cells, this file reads them.
*/

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export interface GridData {
  readonly width: number;
  readonly height: number;
  /** Row-major, `y * width + x`: 1 = wall, 0 = floor. */
  readonly cells: Uint8Array;
}

const ORTHOGONAL = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const DIAGONAL = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

export function inside(grid: GridData, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < grid.width &&
    y < grid.height
  );
}

/** A floor cell; anything outside the map is not. */
export function isFloor(grid: GridData, x: number, y: number): boolean {
  return inside(grid, x, y) && grid.cells[y * grid.width + x] === 0;
}

/** Whole-number cell coordinates from a `{ x, y }` (or `[x, y]`), or undefined. */
export function cellOf(value: unknown): Cell | undefined {
  const point = Array.isArray(value)
    ? { x: value[0] as unknown, y: value[1] as unknown }
    : (value as { x?: unknown; y?: unknown } | null);
  if (point === null || typeof point !== 'object') return undefined;
  const { x, y } = point;
  if (typeof x !== 'number' || typeof y !== 'number') return undefined;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x: Math.round(x), y: Math.round(y) };
}

/** Neighbour steps from (x, y); a diagonal never cuts a wall corner. */
function steps(grid: GridData, x: number, y: number, diagonal: boolean): [number, number][] {
  const out: [number, number][] = [];
  for (const [dx, dy] of ORTHOGONAL) {
    if (isFloor(grid, x + dx, y + dy)) out.push([x + dx, y + dy]);
  }
  if (diagonal) {
    for (const [dx, dy] of DIAGONAL) {
      if (isFloor(grid, x + dx, y + dy) && isFloor(grid, x + dx, y) && isFloor(grid, x, y + dy)) {
        out.push([x + dx, y + dy]);
      }
    }
  }
  return out;
}

interface Search {
  readonly distance: Int32Array;
  readonly previous: Int32Array;
}

function search(grid: GridData, from: Cell, diagonal: boolean, stopAt = -1): Search {
  const size = grid.width * grid.height;
  const distance = new Int32Array(size).fill(-1);
  const previous = new Int32Array(size).fill(-1);
  if (!isFloor(grid, from.x, from.y)) return { distance, previous };
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  const start = from.y * grid.width + from.x;
  distance[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const index = queue[head++] ?? 0;
    if (index === stopAt) break;
    const x = index % grid.width;
    const y = (index - x) / grid.width;
    const next = (distance[index] ?? 0) + 1;
    for (const [nx, ny] of steps(grid, x, y, diagonal)) {
      const other = ny * grid.width + nx;
      if (distance[other] !== -1) continue;
      distance[other] = next;
      previous[other] = index;
      queue[tail++] = other;
    }
  }
  return { distance, previous };
}

/** Steps from `from` to every cell (-1: a wall, or not reachable). */
export function distancesFrom(grid: GridData, from: Cell, diagonal = false): Int32Array {
  return search(grid, from, diagonal).distance;
}

/** The shortest walk from `from` to `to`, both included; [] when either is a wall or unreachable. */
export function pathBetween(grid: GridData, from: Cell, to: Cell, diagonal = false): Cell[] {
  if (!isFloor(grid, from.x, from.y) || !isFloor(grid, to.x, to.y)) return [];
  const goal = to.y * grid.width + to.x;
  const { distance, previous } = search(grid, from, diagonal, goal);
  if (distance[goal] === -1) return [];
  const path: Cell[] = [];
  for (let index = goal; index !== -1; index = previous[index] ?? -1) {
    const x = index % grid.width;
    path.push({ x, y: (index - x) / grid.width });
  }
  return path.reverse();
}

/** Walls all round the edge: a generated map never leaks into the void. */
export function closeBorder(grid: GridData): void {
  const { width, height, cells } = grid;
  for (let x = 0; x < width; x += 1) {
    cells[x] = 1;
    cells[(height - 1) * width + x] = 1;
  }
  for (let y = 0; y < height; y += 1) {
    cells[y * width] = 1;
    cells[y * width + width - 1] = 1;
  }
}

/** Fill every floor region but the largest (ties: the first in scan order). Returns its size. */
export function keepLargestRegion(grid: GridData): number {
  const { width, cells } = grid;
  const region = new Int32Array(cells.length).fill(-1);
  const sizes: number[] = [];
  const queue = new Int32Array(cells.length);
  for (let start = 0; start < cells.length; start += 1) {
    if (cells[start] !== 0 || region[start] !== -1) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    region[start] = id;
    while (head < tail) {
      const index = queue[head++] ?? 0;
      const x = index % width;
      const y = (index - x) / width;
      for (const [nx, ny] of steps(grid, x, y, false)) {
        const other = ny * width + nx;
        if (region[other] !== -1) continue;
        region[other] = id;
        queue[tail++] = other;
      }
    }
    sizes.push(tail);
  }
  if (sizes.length === 0) return 0;
  let best = 0;
  for (let id = 1; id < sizes.length; id += 1) {
    if ((sizes[id] ?? 0) > (sizes[best] ?? 0)) best = id;
  }
  for (let index = 0; index < cells.length; index += 1) {
    if (cells[index] === 0 && region[index] !== best) cells[index] = 1;
  }
  return sizes[best] ?? 0;
}

export function floorCount(grid: GridData): number {
  let count = 0;
  for (const value of grid.cells) if (value === 0) count += 1;
  return count;
}

/** The floor cell nearest (Manhattan) to (x, y); ties go to the first in scan order. */
export function nearestFloor(grid: GridData, x: number, y: number): Cell | undefined {
  let best: Cell | undefined;
  let bestDistance = Infinity;
  for (let cy = 0; cy < grid.height; cy += 1) {
    for (let cx = 0; cx < grid.width; cx += 1) {
      if (grid.cells[cy * grid.width + cx] !== 0) continue;
      const distance = Math.abs(cx - x) + Math.abs(cy - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x: cx, y: cy };
      }
    }
  }
  return best;
}

/** The reachable cell farthest from `from` (by steps); `from` itself on a one-cell map. */
export function farthestFrom(grid: GridData, from: Cell): Cell {
  const distance = distancesFrom(grid, from);
  let best = from.y * grid.width + from.x;
  for (let index = 0; index < distance.length; index += 1) {
    if ((distance[index] ?? -1) > (distance[best] ?? -1)) best = index;
  }
  const x = best % grid.width;
  return { x, y: (best - x) / grid.width };
}

export interface RowLegend {
  wall?: string;
  floor?: string;
  start?: string;
  exit?: string;
}

function symbol(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length === 1 ? value : fallback;
}

/** ASCII rows ('#' walls, '.' floor, 'p' start, 'e' exit by default) for tilemap.world. */
export function toRows(
  grid: GridData,
  legend: RowLegend | undefined,
  marks: { readonly start?: Cell | undefined; readonly exit?: Cell | undefined },
): string[] {
  const wall = symbol(legend?.wall, '#');
  const floor = symbol(legend?.floor, '.');
  const start = symbol(legend?.start, 'p');
  const exit = symbol(legend?.exit, 'e');
  const rows: string[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    let row = '';
    for (let x = 0; x < grid.width; x += 1) {
      if (marks.start?.x === x && marks.start.y === y) row += start;
      else if (marks.exit?.x === x && marks.exit.y === y) row += exit;
      else row += grid.cells[y * grid.width + x] === 1 ? wall : floor;
    }
    rows.push(row);
  }
  return rows;
}
