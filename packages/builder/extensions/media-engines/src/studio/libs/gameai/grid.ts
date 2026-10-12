/*
  Grid navigation for `s.lib.gameai` (game libraries, 2026-10-12): A* over a tile grid and a
  box mover that never enters a solid cell.

    const grid = ai.grid(world);            // a s.lib.tilemap world …
    const grid = ai.grid({ cols, rows, tileSize, solid: (col, row) => … });   // … or any grid
    grid.path({ x, y }, { x, y })            // → [{ x, y }, …] cell centres in world pixels

  Solidity is read LIVE from the source (a door opened with world.set is walkable at once).
  Diagonal steps never cut a solid corner. Bounded: AI_LIMITS.searchNodes expansions per search
  and AI_LIMITS.pathCells cells per path; an unreachable or too-distant goal returns []. Ties
  break in insertion order, so the same grid and endpoints always give the same path.
*/

export const AI_LIMITS = Object.freeze({
  agents: 64,
  maxAgents: 256,
  obstacles: 128,
  pathCells: 512,
  searchNodes: 20_000,
  gridCells: 256 * 256,
  states: 32,
  waypoints: 256,
});

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What a grid can be built from: a tilemap world, or explicit size and solidity. */
export interface GridSource {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  /** Solid by cell (explicit grids). */
  solid?(col: number, row: number): boolean;
  /** Solid by world pixel (tilemap worlds). */
  solidAt?(x: number, y: number): boolean;
}

export interface NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  blocked(col: number, row: number): boolean;
  free(x: number, y: number): boolean;
  cellOf(x: number, y: number): { col: number; row: number };
  centre(col: number, row: number): Point;
  /** Cell centres from the start's cell to the goal's, both included; [] when unreachable. */
  path(from: Point, to: Point): Point[];
  /** Move a box by (dx, dy), stopping at solid cells, sub-stepped against tunnelling. */
  move(box: Box, dx: number, dy: number): { x: number; y: number; hitX: boolean; hitY: boolean };
}

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/** A binary min-heap of cell indices keyed by f-score; ties keep insertion order. */
class Heap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];
  private readonly order: number[] = [];
  private counter = 0;

  get size(): number {
    return this.items.length;
  }

  private less(a: number, b: number): boolean {
    const ka = this.keys[a] ?? 0;
    const kb = this.keys[b] ?? 0;
    return ka < kb || (ka === kb && (this.order[a] ?? 0) < (this.order[b] ?? 0));
  }

  private swap(a: number, b: number): void {
    for (const list of [this.items, this.keys, this.order]) {
      const held = list[a] ?? 0;
      list[a] = list[b] ?? 0;
      list[b] = held;
    }
  }

  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    this.order.push((this.counter += 1));
    let at = this.items.length - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (!this.less(at, parent)) break;
      this.swap(at, parent);
      at = parent;
    }
  }

  pop(): number | undefined {
    const top = this.items[0];
    const last = this.items.length - 1;
    this.swap(0, last);
    this.items.pop();
    this.keys.pop();
    this.order.pop();
    let at = 0;
    for (;;) {
      const left = at * 2 + 1;
      const right = left + 1;
      let best = at;
      if (left < this.items.length && this.less(left, best)) best = left;
      if (right < this.items.length && this.less(right, best)) best = right;
      if (best === at) break;
      this.swap(at, best);
      at = best;
    }
    return top;
  }
}

export function createNavGrid(
  // Authored scene code is plain JavaScript: the source may be anything.
  input: Partial<GridSource> | null | undefined,
  options: { diagonal?: boolean } = {},
): NavGrid {
  if (typeof input !== 'object' || input === null) throw new TypeError('gameai.grid needs a world');
  const source = input;
  const cols = Math.floor(Number(source.cols));
  const rows = Math.floor(Number(source.rows));
  const tileSize = Number(source.tileSize);
  if (!(cols >= 1 && rows >= 1 && cols * rows <= AI_LIMITS.gridCells))
    throw new RangeError(`gameai.grid: 1..${String(AI_LIMITS.gridCells)} cells`);
  if (!(tileSize >= 1 && tileSize <= 1024)) throw new RangeError('gameai.grid: tileSize 1..1024');
  // Authored grids may answer with any value: only `true` is solid.
  const solidFn = source.solid as ((col: number, row: number) => unknown) | undefined;
  const solidAtFn = source.solidAt as ((x: number, y: number) => unknown) | undefined;
  if (typeof solidFn !== 'function' && typeof solidAtFn !== 'function')
    throw new TypeError('gameai.grid needs solid(col, row) or a tilemap world');
  const diagonal = options.diagonal !== false;

  const blocked = (col: number, row: number): boolean => {
    if (col < 0 || row < 0 || col >= cols || row >= rows) return true;
    if (typeof solidFn === 'function') return solidFn.call(source, col, row) === true;
    return solidAtFn?.call(source, (col + 0.5) * tileSize, (row + 0.5) * tileSize) === true;
  };
  const cellOf = (x: number, y: number) => ({
    col: Math.floor(x / tileSize),
    row: Math.floor(y / tileSize),
  });
  const centre = (col: number, row: number): Point => ({
    x: (col + 0.5) * tileSize,
    y: (row + 0.5) * tileSize,
  });

  // Search state, allocated once per grid; a generation stamp replaces clearing it per search.
  const total = cols * rows;
  const cost = new Float64Array(total);
  const came = new Int32Array(total);
  const seen = new Uint32Array(total);
  const done = new Uint32Array(total);
  let generation = 0;

  const estimate = (col: number, row: number, goalCol: number, goalRow: number): number => {
    const dx = Math.abs(col - goalCol);
    const dy = Math.abs(row - goalRow);
    return diagonal ? Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy) : dx + dy;
  };

  function path(from: Point, to: Point): Point[] {
    const start = cellOf(from.x, from.y);
    const goal = cellOf(to.x, to.y);
    if (blocked(goal.col, goal.row)) return [];
    if (start.col === goal.col && start.row === goal.row) return [centre(goal.col, goal.row)];
    generation += 1;
    const startIndex = start.row * cols + start.col;
    const goalIndex = goal.row * cols + goal.col;
    if (startIndex < 0 || startIndex >= total) return [];
    const open = new Heap();
    cost[startIndex] = 0;
    came[startIndex] = -1;
    seen[startIndex] = generation;
    open.push(startIndex, estimate(start.col, start.row, goal.col, goal.row));
    let expanded = 0;
    while (open.size > 0) {
      const current = open.pop() ?? -1;
      if (current === goalIndex) break;
      if (done[current] === generation) continue;
      done[current] = generation;
      expanded += 1;
      if (expanded > AI_LIMITS.searchNodes) return [];
      const col = current % cols;
      const row = (current - col) / cols;
      for (const [dc, dr] of diagonal ? DIRECTIONS : DIRECTIONS.slice(0, 4)) {
        const nc = col + dc;
        const nr = row + dr;
        if (blocked(nc, nr)) continue;
        if (dc !== 0 && dr !== 0 && (blocked(col + dc, row) || blocked(col, row + dr))) continue;
        const next = nr * cols + nc;
        if (done[next] === generation) continue;
        const step = (cost[current] ?? 0) + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
        if (seen[next] === generation && step >= (cost[next] ?? Infinity)) continue;
        seen[next] = generation;
        cost[next] = step;
        came[next] = current;
        open.push(next, step + estimate(nc, nr, goal.col, goal.row));
      }
    }
    if (seen[goalIndex] !== generation) return [];
    const cells: Point[] = [];
    for (let at = goalIndex; at !== -1; at = came[at] ?? -1) {
      const col = at % cols;
      cells.push(centre(col, (at - col) / cols));
      if (cells.length > AI_LIMITS.searchNodes) return [];
    }
    cells.reverse();
    return cells.slice(0, AI_LIMITS.pathCells);
  }

  function boxBlocked(x: number, y: number, w: number, h: number): boolean {
    const left = Math.floor(x / tileSize);
    const right = Math.floor((x + w - 0.001) / tileSize);
    const top = Math.floor(y / tileSize);
    const bottom = Math.floor((y + h - 0.001) / tileSize);
    for (let row = top; row <= bottom; row += 1)
      for (let col = left; col <= right; col += 1) if (blocked(col, row)) return true;
    return false;
  }

  function move(box: Box, dx: number, dy: number) {
    const finite = (value: number): number =>
      Number.isFinite(value) ? Math.max(-tileSize * 16, Math.min(tileSize * 16, value)) : 0;
    const w = Math.max(1, box.w);
    const h = Math.max(1, box.h);
    const mx = finite(dx);
    const my = finite(dy);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / (tileSize / 4)));
    let { x, y } = box;
    let hitX = false;
    let hitY = false;
    for (let i = 0; i < steps; i += 1) {
      if (!hitX && mx !== 0) {
        if (boxBlocked(x + mx / steps, y, w, h)) hitX = true;
        else x += mx / steps;
      }
      if (!hitY && my !== 0) {
        if (boxBlocked(x, y + my / steps, w, h)) hitY = true;
        else y += my / steps;
      }
    }
    return { x, y, hitX, hitY };
  }

  return {
    cols,
    rows,
    tileSize,
    blocked,
    free: (x, y) => {
      const cell = cellOf(x, y);
      return !blocked(cell.col, cell.row);
    },
    cellOf,
    centre,
    path,
    move,
  };
}
