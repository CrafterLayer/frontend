/*
  `s.lib.procgen` maps (procedural maps, 2026-10-13): what a generator made, wrapped as one
  object a scene can draw, walk and light.

    const map = s.lib.procgen.dungeon(s, { width: 48, height: 30 });
    map.start / map.exit          // reachable floor cells: start near the inline-start side
    map.rows()                    // ['#####', '#p..#', …] → s.lib.tilemap.world(s.app, { rows, legend })
    map.draw(s, { tile: 16 })     // one Graphics on s.world, coloured from s.palette
    map.path(a, b) / map.fov(x, y, 8) / map.scatter(6, { spacing: 4 })

  The seed comes from the scene's seeded random (or `seed`), so the same scene seed draws the same
  map in the editor, the preview and the published page. Every map is connected: whatever a
  generator leaves cut off is filled in, so the exit is always reachable from the start.
*/

import { drawMap, type DrawOptions } from './draw';
import {
  PROCGEN_LIMITS,
  fieldOfView,
  generateCave,
  generateDungeon,
  generateMaze,
  type DungeonStyle,
  type Generated,
  type MazeStyle,
  type Room,
} from './generate';
import {
  cellOf,
  distancesFrom,
  farthestFrom,
  inside,
  isFloor,
  keepLargestRegion,
  nearestFloor,
  pathBetween,
  toRows,
  type Cell,
  type RowLegend,
} from './grid';

export type MapKind = 'dungeon' | 'cave' | 'maze';

interface SceneLike {
  random?(): number;
  readonly dir?: number;
}

export interface CommonOptions {
  width?: number;
  height?: number;
  /** A whole number; default: drawn from the scene's seeded random. */
  seed?: number;
}

export interface DungeonOptions extends CommonOptions {
  style?: DungeonStyle;
  roomWidth?: readonly [number, number];
  roomHeight?: readonly [number, number];
  corridorLength?: readonly [number, number];
  /** Share of the map dug out, 0.1..0.6 (default 0.3). */
  fill?: number;
}

export interface CaveOptions extends CommonOptions {
  /** Starting wall density, 0.3..0.6 (default 0.46); higher gives tighter caves. */
  fill?: number;
  /** Smoothing generations, 1..8 (default 4). */
  steps?: number;
}

export interface MazeOptions extends CommonOptions {
  style?: MazeStyle;
  /** 'icey' only: 0 (twisty) .. 10 (long straight runs); default 2. */
  regularity?: number;
}

export interface Visibility {
  readonly count: number;
  readonly cells: readonly Cell[];
  has(x: number, y: number): boolean;
}

export interface ProcMap {
  readonly kind: MapKind;
  readonly style: string;
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  /** Rooms of a dungeon ({ x, y, w, h, cx, cy }); [] for caves and mazes. */
  readonly rooms: readonly Room[];
  readonly start: Cell;
  readonly exit: Cell;
  /** Floor cells, all reachable from start. */
  readonly floors: number;
  wall(x: number, y: number): boolean;
  floor(x: number, y: number): boolean;
  /** Pixel centre of a cell at `tile` px per cell. */
  centre(cell: Cell, tile?: number): { x: number; y: number };
  rows(legend?: RowLegend): string[];
  /** Steps from `from` to `to` walking the floor (-1 when unreachable). */
  distance(from: Cell, to: Cell): number;
  path(from: Cell, to: Cell, options?: { diagonal?: boolean }): Cell[];
  fov(x: number, y: number, radius?: number): Visibility;
  scatter(count: number, options?: { spacing?: number; avoid?: readonly Cell[] }): Cell[];
  draw(scene: unknown, options?: DrawOptions): unknown;
}

function clampInt(value: unknown, low: number, high: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(high, Math.max(low, number));
}

function clampNumber(value: unknown, low: number, high: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(high, Math.max(low, number));
}

function range(
  value: unknown,
  low: number,
  high: number,
  fallback: [number, number],
): [number, number] {
  const given: readonly unknown[] = Array.isArray(value) ? value : fallback;
  const a = clampInt(given[0], low, high, fallback[0]);
  const b = clampInt(given[1], low, high, fallback[1]);
  return a <= b ? [a, b] : [b, a];
}

function size(value: unknown, fallback: number, odd = false): number {
  const n = clampInt(value, PROCGEN_LIMITS.minSize, PROCGEN_LIMITS.maxSize, fallback);
  return odd && n % 2 === 0 ? n - 1 : n;
}

function sceneOf(value: unknown): SceneLike {
  return value !== null && typeof value === 'object' ? value : {};
}

/** The map's seed: options.seed, else one draw from the scene's seeded random, else 1. */
function seedFor(scene: SceneLike, options: CommonOptions): number {
  if (typeof options.seed === 'number' && Number.isFinite(options.seed)) {
    return (Math.abs(Math.round(options.seed)) % 0x7ffffffe) + 1;
  }
  if (typeof scene.random === 'function') {
    const value = scene.random();
    if (Number.isFinite(value)) return Math.floor(Math.abs(value) * 0x7ffffffe) + 1;
  }
  return 1;
}

/** mulberry32: the map's own stream for scatter, so it never disturbs the scene's. */
function stream(seed: number): () => number {
  let state = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const held = items[index] as T;
    items[index] = items[other] as T;
    items[other] = held;
  }
  return items;
}

function cellArgument(value: unknown, name: string): Cell {
  const cell = cellOf(value);
  if (cell === undefined) throw new TypeError(`procgen: ${name} must be a cell { x, y }`);
  return cell;
}

function createMap(
  kind: MapKind,
  style: string,
  seed: number,
  made: Generated,
  rtl: boolean,
): ProcMap {
  const grid = { width: made.width, height: made.height, cells: made.cells };
  const floors = keepLargestRegion(grid);
  const rooms = Object.freeze(
    made.rooms
      .filter((room) => isFloor(grid, room.cx, room.cy))
      .map((room) => Object.freeze({ ...room })),
  );
  // Start on the inline-start side (left in LTR, right in RTL); exit as far as the floor goes.
  let start: Cell | undefined;
  if (rooms.length > 0) {
    const first = rooms.reduce((best, room) =>
      (rtl ? room.cx > best.cx : room.cx < best.cx) || (room.cx === best.cx && room.cy < best.cy)
        ? room
        : best,
    );
    start = { x: first.cx, y: first.cy };
  } else {
    start = nearestFloor(grid, rtl ? grid.width - 1 : 0, 0);
  }
  start = Object.freeze(start ?? { x: 1, y: 1 });
  let exit: Cell;
  if (rooms.length > 1) {
    const distance = distancesFrom(grid, start);
    const far = rooms.reduce((best, room) =>
      (distance[room.cy * grid.width + room.cx] ?? -1) >
      (distance[best.cy * grid.width + best.cx] ?? -1)
        ? room
        : best,
    );
    exit = { x: far.cx, y: far.cy };
  } else {
    exit = farthestFrom(grid, start);
  }
  exit = Object.freeze(exit);
  const random = stream(seed);

  const map: ProcMap = {
    kind,
    style,
    seed,
    width: grid.width,
    height: grid.height,
    rooms,
    start,
    exit,
    floors,
    wall: (x, y) => !isFloor(grid, x, y),
    floor: (x, y) => isFloor(grid, x, y),
    centre(cell, tile = 16) {
      const at = cellArgument(cell, 'centre(cell)');
      const step = Number.isFinite(tile) && tile > 0 ? tile : 16;
      return { x: (at.x + 0.5) * step, y: (at.y + 0.5) * step };
    },
    rows: (legend) => toRows(grid, legend, { start, exit }),
    distance(from, to) {
      const a = cellArgument(from, 'distance(from)');
      const b = cellArgument(to, 'distance(to)');
      if (!isFloor(grid, b.x, b.y)) return -1;
      return distancesFrom(grid, a)[b.y * grid.width + b.x] ?? -1;
    },
    path(from, to, options) {
      return pathBetween(
        grid,
        cellArgument(from, 'path(from)'),
        cellArgument(to, 'path(to)'),
        options?.diagonal === true,
      );
    },
    fov(x, y, radius = 8) {
      const origin = cellArgument({ x, y }, 'fov(x, y)');
      const r = clampInt(radius, 1, PROCGEN_LIMITS.fovRadius, 8);
      const seen = fieldOfView(grid, origin, r);
      const cells = [...seen]
        .sort((a, b) => a - b)
        .map((index) => {
          const cx = index % grid.width;
          return Object.freeze({ x: cx, y: (index - cx) / grid.width });
        });
      return Object.freeze({
        count: cells.length,
        cells: Object.freeze(cells),
        has: (cx: number, cy: number) => inside(grid, cx, cy) && seen.has(cy * grid.width + cx),
      });
    },
    scatter(count, options) {
      const wanted = clampInt(count, 0, PROCGEN_LIMITS.scatter, 0);
      const spacing = clampNumber(options?.spacing, 0, 64, 3);
      const avoid = [start, exit, ...(options?.avoid ?? []).map((cell) => cellOf(cell))].filter(
        (cell): cell is Cell => cell !== undefined,
      );
      const candidates: Cell[] = [];
      for (let y = 0; y < grid.height; y += 1)
        for (let x = 0; x < grid.width; x += 1)
          if (grid.cells[y * grid.width + x] === 0) candidates.push({ x, y });
      const picked: Cell[] = [];
      const far = (a: Cell, b: Cell): boolean =>
        Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) >= Math.max(1, spacing);
      for (const cell of shuffled(candidates, random)) {
        if (picked.length >= wanted) break;
        if (avoid.every((other) => far(cell, other)) && picked.every((other) => far(cell, other)))
          picked.push(Object.freeze(cell));
      }
      return picked;
    },
    draw: (scene, options) => drawMap(scene, grid, options),
  };
  return Object.freeze(map);
}

export function dungeon(sceneValue: unknown, options?: DungeonOptions | null): ProcMap {
  const scene = sceneOf(sceneValue);
  // Authored scene code is plain JavaScript: the options may be missing or null.
  const opts = options ?? {};
  const width = size(opts.width, 48);
  const height = size(opts.height, 30);
  const style: DungeonStyle = opts.style === 'rooms' ? 'rooms' : 'digger';
  const seed = seedFor(scene, opts);
  // rot places the first room around the centre unchecked: a room may span at most half the map.
  const maxRoomWidth = Math.max(2, Math.floor((width - 3) / 2));
  const maxRoomHeight = Math.max(2, Math.floor((height - 3) / 2));
  const made = generateDungeon(
    width,
    height,
    {
      style,
      roomWidth: range(opts.roomWidth, 2, maxRoomWidth, [3, 9]),
      roomHeight: range(opts.roomHeight, 2, maxRoomHeight, [3, 6]),
      corridorLength: range(opts.corridorLength, 1, 30, [3, 10]),
      fill: clampNumber(opts.fill, 0.1, 0.6, 0.3),
    },
    seed,
  );
  return createMap('dungeon', style, seed, made, scene.dir === -1);
}

export function cave(sceneValue: unknown, options?: CaveOptions | null): ProcMap {
  const scene = sceneOf(sceneValue);
  // Authored scene code is plain JavaScript: the options may be missing or null.
  const opts = options ?? {};
  const seed = seedFor(scene, opts);
  const made = generateCave(
    size(opts.width, 48),
    size(opts.height, 30),
    { fill: clampNumber(opts.fill, 0.3, 0.6, 0.46), steps: clampInt(opts.steps, 1, 8, 4) },
    seed,
  );
  return createMap('cave', 'cellular', seed, made, scene.dir === -1);
}

export function maze(sceneValue: unknown, options?: MazeOptions | null): ProcMap {
  const scene = sceneOf(sceneValue);
  // Authored scene code is plain JavaScript: the options may be missing or null.
  const opts = options ?? {};
  const style: MazeStyle = opts.style === 'icey' || opts.style === 'eller' ? opts.style : 'divided';
  const seed = seedFor(scene, opts);
  const made = generateMaze(
    size(opts.width, 31, true),
    size(opts.height, 21, true),
    { style, regularity: clampInt(opts.regularity, 0, 10, 2) },
    seed,
  );
  return createMap('maze', style, seed, made, scene.dir === -1);
}

export { PROCGEN_LIMITS };
export type { Cell, Room, RowLegend, DrawOptions };
