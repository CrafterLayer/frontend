import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createRandom } from '../../kit/random';
import { createProcgenLibrary, PROCGEN_VERSION } from '../procgen-entry';
import { fakePixi } from '../shared/fake-pixi.test-util';
import { distancesFrom, keepLargestRegion, pathBetween, toRows } from './grid';
import { cave, dungeon, maze, type ProcMap } from './map';

/* A scene stand-in: the seeded random, the inline direction and (for drawing) Pixi + palette. */
function scene(seed: number | string = 7, dir: 1 | -1 = 1) {
  const random = createRandom(seed);
  const { PIXI, app } = fakePixi();
  const world = new PIXI.Container();
  return {
    random: () => random.random(),
    dir,
    PIXI,
    stage: app.stage,
    world,
    palette: { surface: 0x101525, muted: 0x94a3b8, text: 0xf1f5f9, mix: () => 0x334455 },
  };
}

function floorCells(map: ProcMap): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < map.height; y += 1)
    for (let x = 0; x < map.width; x += 1) if (map.floor(x, y)) out.push({ x, y });
  return out;
}

/* Every floor cell is reachable from the start (one BFS over the map's rows), and the border is wall. */
function expectConnectedAndClosed(map: ProcMap): void {
  const floors = floorCells(map);
  expect(floors.length).toBe(map.floors);
  expect(floors.length).toBeGreaterThan(0);
  const cells = Uint8Array.from(map.rows({ start: '.', exit: '.' }).join(''), (char) =>
    char === '#' ? 1 : 0,
  );
  const reach = distancesFrom({ width: map.width, height: map.height, cells }, map.start);
  for (const cell of floors) expect(reach[cell.y * map.width + cell.x]).toBeGreaterThanOrEqual(0);
  for (let x = 0; x < map.width; x += 1) {
    expect(map.wall(x, 0)).toBe(true);
    expect(map.wall(x, map.height - 1)).toBe(true);
  }
  for (let y = 0; y < map.height; y += 1) {
    expect(map.wall(0, y)).toBe(true);
    expect(map.wall(map.width - 1, y)).toBe(true);
  }
  expect(map.floor(map.start.x, map.start.y)).toBe(true);
  expect(map.floor(map.exit.x, map.exit.y)).toBe(true);
  expect(map.distance(map.start, map.exit)).toBeGreaterThan(0);
}

describe('procgen library', () => {
  it('exposes the rot.js version it bundles and frozen entry points', () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../../../node_modules/rot-js/package.json'),
        'utf8',
      ),
    ) as { version: string; license: string };
    expect(PROCGEN_VERSION).toBe(manifest.version);
    expect(manifest.license).toBe('BSD-3-Clause');
    const lib = createProcgenLibrary();
    expect(Object.isFrozen(lib)).toBe(true);
    expect(lib.styles.maze).toEqual(['divided', 'icey', 'eller']);
    expect(lib.limits.maxSize).toBe(160);
    expect(lib.dungeon(scene(), { width: 30, height: 20 }).kind).toBe('dungeon');
  });

  it('draws the same dungeon from the same scene seed, and another from another seed', () => {
    const a = dungeon(scene(11), { width: 48, height: 30 });
    const b = dungeon(scene(11), { width: 48, height: 30 });
    const c = dungeon(scene(12), { width: 48, height: 30 });
    expect(a.rows()).toEqual(b.rows());
    expect(a.seed).toBe(b.seed);
    expect(c.rows()).not.toEqual(a.rows());
    // An explicit seed wins over the scene, and needs no scene at all.
    expect(dungeon(null, { seed: 5 }).rows()).toEqual(dungeon(scene(99), { seed: 5 }).rows());
  });

  it.each(['digger', 'rooms'] as const)(
    'makes a connected %s dungeon whose rooms and exit are reachable',
    (style) => {
      const map = dungeon(scene(3), { width: 50, height: 32, style });
      expect(map.style).toBe(style);
      expect(map.rooms.length).toBeGreaterThanOrEqual(2);
      expectConnectedAndClosed(map);
      for (const room of map.rooms) {
        expect(room.x).toBeGreaterThan(0);
        expect(room.y).toBeGreaterThan(0);
        expect(room.x + room.w).toBeLessThan(map.width);
        expect(room.y + room.h).toBeLessThan(map.height);
        expect(map.distance(map.start, { x: room.cx, y: room.cy })).toBeGreaterThanOrEqual(0);
      }
      // The exit is the room centre farthest from the start.
      const far = Math.max(
        ...map.rooms.map((room) => map.distance(map.start, { x: room.cx, y: room.cy })),
      );
      expect(map.distance(map.start, map.exit)).toBe(far);
      expect(map.rooms.some((room) => room.cx === map.start.x && room.cy === map.start.y)).toBe(
        true,
      );
    },
  );

  it('falls back to digging when evenly spread rooms cannot fit', () => {
    const map = dungeon(scene(4), { width: 9, height: 9, style: 'rooms', roomWidth: [6, 8] });
    expect(map.width).toBe(9);
    expectConnectedAndClosed(map);
  });

  it('grows connected caves of a sensible density', () => {
    for (const seed of [1, 2, 3]) {
      const map = cave(scene(seed), { width: 60, height: 36 });
      expect(map.kind).toBe('cave');
      expect(map.rooms).toEqual([]);
      expectConnectedAndClosed(map);
      const interior = (map.width - 2) * (map.height - 2);
      expect(map.floors / interior).toBeGreaterThan(0.25);
      expect(map.floors / interior).toBeLessThan(0.85);
    }
    // A fill so dense that nothing survives still leaves a chamber to stand in.
    expectConnectedAndClosed(cave(scene(5), { width: 9, height: 9, fill: 0.6, steps: 8 }));
  });

  it.each(['divided', 'icey', 'eller'] as const)(
    'builds a perfect %s maze on odd sizes with a walkable way out',
    (style) => {
      const map = maze(scene(8), { width: 30, height: 20, style });
      expect([map.width, map.height]).toEqual([29, 19]);
      expectConnectedAndClosed(map);
      const path = map.path(map.start, map.exit);
      expect(path[0]).toEqual(map.start);
      expect(path.at(-1)).toEqual(map.exit);
      expect(path).toHaveLength(map.distance(map.start, map.exit) + 1);
      for (let i = 1; i < path.length; i += 1) {
        const a = path[i - 1] ?? map.start;
        const b = path[i] ?? map.start;
        expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
        expect(map.floor(b.x, b.y)).toBe(true);
      }
    },
  );

  it('starts on the inline-start side: left in LTR, right in RTL', () => {
    const ltr = maze(scene(9, 1), { width: 41, height: 21 });
    const rtl = maze(scene(9, -1), { width: 41, height: 21 });
    // The same seed carves the same maze; only where it starts follows the direction.
    const plain = { start: '.', exit: '.' };
    expect(rtl.rows(plain)).toEqual(ltr.rows(plain));
    expect(ltr.start.x).toBeLessThan(ltr.width / 2);
    expect(rtl.start.x).toBeGreaterThan(rtl.width / 2);
    const dungeonRtl = dungeon(scene(9, -1), { width: 48, height: 30 });
    const xs = dungeonRtl.rooms.map((room) => room.cx);
    expect(dungeonRtl.start.x).toBe(Math.max(...xs));
  });

  it('clamps sizes and options to the limits', () => {
    const tiny = maze(scene(), { width: 1, height: -4 });
    expect([tiny.width, tiny.height]).toEqual([7, 7]);
    const huge = cave(scene(), { width: 10_000, height: 400, fill: 9, steps: 99 });
    expect([huge.width, huge.height]).toEqual([160, 160]);
    expectConnectedAndClosed(huge);
    const odd = dungeon(scene(), { width: Number.NaN, height: 'x' as unknown as number });
    expect([odd.width, odd.height]).toEqual([48, 30]);
  });

  it('finds BFS paths that never cut a wall corner when walking diagonally', () => {
    // An open 3 × 3 room: the diagonal walk is the short one.
    const room = { width: 5, height: 5, cells: new Uint8Array(25).fill(1) };
    for (let y = 1; y <= 3; y += 1) for (let x = 1; x <= 3; x += 1) room.cells[y * 5 + x] = 0;
    expect(pathBetween(room, { x: 1, y: 1 }, { x: 3, y: 3 }, true)).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
    expect(pathBetween(room, { x: 1, y: 1 }, { x: 3, y: 3 })).toHaveLength(5);
    // A wall at (2, 1) forbids the corner cut from (1, 1) to (2, 2).
    const corner = {
      width: 4,
      height: 4,
      cells: new Uint8Array([1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1]),
    };
    expect(pathBetween(corner, { x: 1, y: 1 }, { x: 2, y: 2 }, true)).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]);
    expect(pathBetween(corner, { x: 1, y: 1 }, { x: 2, y: 1 })).toEqual([]);
    expect(distancesFrom(corner, { x: 0, y: 0 }).every((d) => d === -1)).toBe(true);
  });

  it('keeps only the largest floor region', () => {
    const grid = {
      width: 6,
      height: 3,
      cells: new Uint8Array([1, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1]),
    };
    expect(keepLargestRegion(grid)).toBe(3);
    expect(Array.from(grid.cells.slice(6, 12))).toEqual([1, 1, 0, 0, 0, 1]);
    expect(toRows(grid, { wall: 'W', floor: ' ', start: 'xx' }, { start: { x: 2, y: 1 } })).toEqual(
      ['WWWWWW', 'WWp  W', 'WWWWWW'],
    );
  });

  it('lights what the start can see and nothing behind walls', () => {
    const map = maze(scene(13), { width: 31, height: 21 });
    const view = map.fov(map.start.x, map.start.y, 10);
    expect(view.has(map.start.x, map.start.y)).toBe(true);
    expect(view.count).toBe(view.cells.length);
    expect(view.count).toBeLessThan(map.floors);
    for (const cell of view.cells) {
      expect(Math.hypot(cell.x - map.start.x, cell.y - map.start.y)).toBeLessThanOrEqual(
        10 * Math.SQRT2 + 1,
      );
    }
    expect(view.has(-1, 0)).toBe(false);
    expect(view.has(map.width, map.start.y)).toBe(false);
    // An open room sees itself whole.
    const room = dungeon(scene(14), { width: 40, height: 24 }).rooms[0];
    const map2 = dungeon(scene(14), { width: 40, height: 24 });
    if (room === undefined) throw new Error('no room');
    const lit = map2.fov(room.cx, room.cy, 40);
    for (let y = room.y; y < room.y + room.h; y += 1)
      for (let x = room.x; x < room.x + room.w; x += 1) expect(lit.has(x, y)).toBe(true);
    expect(() => map.fov(Number.NaN, 1)).toThrow(TypeError);
  });

  it('scatters spaced, seeded picks away from the start and exit', () => {
    const make = () => dungeon(scene(21), { width: 48, height: 30 });
    const map = make();
    const picks = map.scatter(8, { spacing: 4 });
    expect(picks).toHaveLength(8);
    expect(make().scatter(8, { spacing: 4 })).toEqual(picks);
    for (const [i, a] of picks.entries()) {
      expect(map.floor(a.x, a.y)).toBe(true);
      for (const other of [map.start, map.exit])
        expect(Math.max(Math.abs(a.x - other.x), Math.abs(a.y - other.y))).toBeGreaterThanOrEqual(
          4,
        );
      for (const b of picks.slice(i + 1))
        expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeGreaterThanOrEqual(4);
    }
    // Asking for more than fits returns what fits; the count is bounded.
    expect(map.scatter(10_000, { spacing: 30 }).length).toBeLessThan(10);
    expect(map.scatter(-3)).toEqual([]);
  });

  it('gives tilemap rows with start and exit marks, and pixel centres', () => {
    const map = maze(scene(31), { width: 15, height: 11 });
    const rows = map.rows();
    expect(rows).toHaveLength(11);
    expect(rows.every((row) => row.length === 15 && /^[#.pe]+$/u.test(row))).toBe(true);
    expect(rows[map.start.y]?.[map.start.x]).toBe('p');
    expect(rows[map.exit.y]?.[map.exit.x]).toBe('e');
    expect(map.centre({ x: 2, y: 3 }, 32)).toEqual({ x: 80, y: 112 });
    expect(map.centre({ x: 0, y: 0 })).toEqual({ x: 8, y: 8 });
    expect(() => map.centre('a' as never)).toThrow(TypeError);
  });

  it('draws one Graphics on s.world: a floor rect and merged wall runs', () => {
    const s = scene(41);
    const map = dungeon(s, { width: 30, height: 20 });
    const g = map.draw(s, { tile: 8 }) as { ops: string[]; parent: unknown; label: string };
    expect(g.parent).toBe(s.world);
    expect(g.label).toBe('procgen-map');
    expect(g.ops[0]).toBe('rect(4)');
    expect(g.ops.filter((op) => op === 'fill(1)')).toHaveLength(2);
    const walls = g.ops.filter((op) => op === 'rect(4)').length - 1;
    expect(walls).toBeGreaterThan(20);
    expect(walls).toBeLessThan(map.width * map.height - map.floors);
    const loose = map.draw(s, { parent: null, floor: null, wall: '#123456' }) as {
      ops: string[];
      parent: unknown;
    };
    expect(loose.parent).toBeNull();
    expect(loose.ops.filter((op) => op === 'fill(1)')).toHaveLength(1);
    expect(() => map.draw({})).toThrow(TypeError);
  });

  it('stays independent of anything else that used rot before', () => {
    const first = cave(scene(51), { width: 40, height: 24 }).rows();
    maze(scene(52), { width: 21, height: 21, style: 'icey' });
    dungeon(null, { seed: 77 });
    expect(cave(scene(51), { width: 40, height: 24 }).rows()).toEqual(first);
  });
});
