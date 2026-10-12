import { describe, expect, it, vi } from 'vitest';

import { createGameAiLibrary } from '../gameai-entry';
import { createGameAi } from './agents';
import { createFsm } from './fsm';
import { AI_LIMITS, createNavGrid } from './grid';

/* A wall splits the room; the only way round is the gap in the bottom row. */
const ROWS = ['##########', '#....#...#', '#....#...#', '#....#...#', '#........#', '##########'];
const TILE = 32;
const solid = (col: number, row: number): boolean => ROWS[row]?.[col] === '#';
const room = { cols: 10, rows: ROWS.length, tileSize: TILE, solid };
const at = (col: number, row: number) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE });

function sprite(x = 0, y = 0) {
  return { x, y, rotation: 0, scale: { x: 1 } };
}

function run(ai: { update(dt: number): void }, seconds: number, each?: () => void): void {
  for (let i = 0; i < Math.round(seconds * 60); i += 1) {
    ai.update(1 / 60);
    each?.();
  }
}

describe('gameai grid', () => {
  it('finds the way round a wall without cutting corners', () => {
    const grid = createNavGrid(room);
    const path = grid.path(at(1, 1), at(8, 1));
    expect(path[0]).toEqual(at(1, 1));
    expect(path.at(-1)).toEqual(at(8, 1));
    const cells = path.map(({ x, y }) => grid.cellOf(x, y));
    expect(cells.every(({ col, row }) => !solid(col, row))).toBe(true);
    expect(cells.some(({ row }) => row === 4)).toBe(true);
    for (let i = 1; i < cells.length; i += 1) {
      const a = cells[i - 1] ?? { col: 0, row: 0 };
      const b = cells[i] ?? { col: 0, row: 0 };
      if (a.col !== b.col && a.row !== b.row) {
        expect(solid(b.col, a.row) || solid(a.col, b.row)).toBe(false);
      }
    }
    expect(createNavGrid(room).path(at(1, 1), at(8, 1))).toEqual(path);
  });

  it('reads solidity live, reports unreachable goals and bounds its input', () => {
    const rows = ['#####', '#.#.#', '#####'];
    const cells = rows.map((row) => Array.from(row));
    const grid = createNavGrid({
      cols: 5,
      rows: 3,
      tileSize: 10,
      solid: (col, row) => cells[row]?.[col] === '#',
    });
    expect(grid.path({ x: 15, y: 15 }, { x: 35, y: 15 })).toEqual([]);
    expect(grid.path({ x: 15, y: 15 }, { x: 25, y: 15 })).toEqual([]);
    const middle = cells[1];
    if (middle !== undefined) middle[2] = '.';
    expect(grid.path({ x: 15, y: 15 }, { x: 35, y: 15 })).toHaveLength(3);
    expect(grid.path({ x: 15, y: 15 }, { x: 16, y: 16 })).toEqual([{ x: 15, y: 15 }]);
    expect(() => createNavGrid({ cols: 0, rows: 1, tileSize: 8, solid })).toThrow(RangeError);
    expect(() => createNavGrid({ cols: 300, rows: 300, tileSize: 8, solid })).toThrow(RangeError);
    expect(() => createNavGrid({ cols: 2, rows: 2, tileSize: 8 })).toThrow(TypeError);
    expect(() => createNavGrid(null)).toThrow(TypeError);
  });

  it('reads a tilemap world through solidAt and moves boxes without entering walls', () => {
    const world = {
      cols: 10,
      rows: ROWS.length,
      tileSize: TILE,
      solidAt: (x: number, y: number) => solid(Math.floor(x / TILE), Math.floor(y / TILE)),
    };
    const grid = createNavGrid(world);
    expect(grid.free(at(1, 1).x, at(1, 1).y)).toBe(!solid(1, 1));
    const moved = grid.move({ x: 40, y: 40, w: 20, h: 20 }, 10_000, 0);
    expect(moved.hitX).toBe(true);
    expect(moved.x + 20).toBeLessThanOrEqual(5 * TILE);
    const around = grid.path(at(1, 1), at(8, 3)).map(({ x, y }) => grid.cellOf(x, y).row);
    expect(around).toContain(4);
  });

  it('gives up beyond the search budget instead of freezing', () => {
    const grid = createNavGrid({ cols: 256, rows: 256, tileSize: 4, solid: () => false });
    const far = grid.path({ x: 2, y: 2 }, { x: 1022, y: 1022 });
    expect(far.length).toBeLessThanOrEqual(AI_LIMITS.pathCells);
    expect(far.length).toBeGreaterThan(0);
  });
});

describe('gameai state machines', () => {
  it('enters, exits, times and queues transitions asked for inside enter', () => {
    const log: string[] = [];
    const brain = createFsm(
      {
        idle: {
          enter: (from) => log.push(`enter idle from ${String(from)}`),
          exit: () => log.push('exit idle'),
        },
        alert: {
          enter: () => {
            log.push('enter alert');
            brain.go('chase');
          },
          exit: (to) => log.push(`exit alert to ${to}`),
        },
        chase: {
          enter: () => log.push('enter chase'),
          update: (dt, t) => log.push(`chase ${t.toFixed(2)}`),
        },
      },
      'idle',
    );
    expect(brain.go('alert')).toBe(true);
    expect(brain.state).toBe('chase');
    brain.update(0.5);
    expect(brain.elapsed).toBe(0.5);
    expect(brain.go('missing')).toBe(false);
    expect(log).toEqual([
      'enter idle from null',
      'exit idle',
      'enter alert',
      'exit alert to chase',
      'enter chase',
      'chase 0.50',
    ]);
  });

  it('bounds ping-pong transitions and validates its states', () => {
    let entries = 0;
    const loop = createFsm(
      {
        idle: {},
        a: {
          enter: () => {
            entries += 1;
            loop.go('b');
          },
        },
        b: {
          enter: () => {
            entries += 1;
            loop.go('a');
          },
        },
      },
      'idle',
    );
    expect(loop.go('a')).toBe(true);
    expect(entries).toBe(16);
    expect(() => createFsm({}, 'a')).toThrow(RangeError);
    expect(() => createFsm({ 'bad name': {} }, 'bad name')).toThrow(TypeError);
    expect(() => createFsm({ a: {} }, 'b')).toThrow(RangeError);
  });
});

describe('gameai agents (yuka)', () => {
  it('seeks a live target and writes the position back to its display object', () => {
    const ai = createGameAi(null, { seed: 3 });
    const target = { x: 300, y: 100 };
    const view = sprite();
    const agent = ai.agent(view, { x: 0, y: 100, speed: 120, rotate: true }).seek(target);
    run(ai, 1);
    expect(view.x).toBeGreaterThan(90);
    expect(view.x).toBeLessThan(130);
    expect(view.y).toBeCloseTo(100, 0);
    expect(view.rotation).toBeCloseTo(0, 1);
    target.x = -300;
    run(ai, 2);
    expect(agent.vx).toBeLessThan(0);
    expect(agent.speed).toBeLessThanOrEqual(120.001);
  });

  it('arrives and settles, flees within its panic distance, and mirrors side-view sprites', () => {
    const ai = createGameAi(null);
    const goal = { x: 200, y: 0 };
    const arriving = ai.agent(sprite(), { speed: 150 }).arrive(goal);
    const view = sprite(0, 300);
    const fleeing = ai
      .agent(view, { x: 0, y: 300, speed: 100, flip: true })
      .flee({ x: 40, y: 300 }, { panic: 120 });
    run(ai, 6);
    expect(arriving.distanceTo(goal)).toBeLessThan(4);
    expect(arriving.speed).toBeLessThan(5);
    expect(fleeing.x).toBeLessThan(-70);
    expect(view.scale.x).toBe(-1);
    expect(fleeing.near({ x: 40, y: 300 }, 100)).toBe(false);
  });

  it('pursues a moving point and evades a pursuer', () => {
    const ai = createGameAi(null);
    const prey = { x: 0, y: 0 };
    const hunter = ai.agent(null, { x: -200, y: 0, speed: 160 }).pursue(prey);
    const runner = ai.agent(null, { x: 100, y: 100, speed: 60 }).evade(hunter, { panic: 400 });
    run(ai, 3, () => {
      prey.x += 1;
    });
    expect(hunter.distanceTo(prey)).toBeLessThan(30);
    expect(runner.distanceTo(hunter)).toBeGreaterThan(100);
  });

  it('wanders deterministically from the seed', () => {
    const trace = (seed: number) => {
      const ai = createGameAi(null, { seed });
      const agent = ai.agent(null, { speed: 80 }).wander();
      run(ai, 3);
      return [Math.round(agent.x), Math.round(agent.y)];
    };
    expect(trace(7)).toEqual(trace(7));
    expect(trace(7)).not.toEqual(trace(8));
    const random = vi.fn(() => 0.5);
    const ai = createGameAi({ random }, {});
    ai.agent(null).wander();
    ai.update(1 / 60);
    expect(random).toHaveBeenCalled();
  });

  it('patrols a looping route', () => {
    const ai = createGameAi(null);
    const route = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const guard = ai.agent(null, { speed: 120 }).patrol(route, { reach: 10 });
    const visited = new Set<number>();
    run(ai, 12, () => {
      route.forEach((point, index) => {
        if (guard.near(point, 14)) visited.add(index);
      });
    });
    expect([...visited].sort()).toEqual([0, 1, 2]);
  });

  it('chases a target around a wall on a tile grid without ever entering a solid cell', () => {
    const ai = createGameAi(null);
    const grid = ai.grid(room);
    const hero = { ...at(8, 1) };
    const view = sprite();
    const start = at(1, 1);
    const enemy = ai.agent(view, { ...start, speed: 140, solid: true, size: 18 }).chase(hero);
    let inside = false;
    run(ai, 8, () => {
      const cell = grid.cellOf(enemy.x, enemy.y);
      if (solid(cell.col, cell.row)) inside = true;
    });
    expect(inside).toBe(false);
    expect(enemy.reachable).toBe(true);
    expect(enemy.distanceTo(hero)).toBeLessThan(TILE / 2);
    expect(view).toMatchObject({ x: enemy.x, y: enemy.y });
    hero.x = at(3, 3).x;
    hero.y = at(3, 3).y;
    run(ai, 8);
    expect(enemy.distanceTo(hero)).toBeLessThan(TILE / 2);
  });

  it('reports an unreachable chase target and holds position', () => {
    const ai = createGameAi(null);
    ai.grid(room);
    const enemy = ai.agent(null, { ...at(1, 1), speed: 100 }).chase(at(5, 2));
    run(ai, 1);
    expect(enemy.reachable).toBe(false);
    expect(enemy.distanceTo(at(1, 1))).toBeLessThan(8);
  });

  it('avoids obstacles and separates a crowd', () => {
    const ai = createGameAi(null);
    ai.obstacle(150, 0, 30);
    const walker = ai
      .agent(null, { x: 0, y: 2, speed: 100, radius: 10 })
      .seek({ x: 300, y: 0 })
      .avoid();
    let closest = Infinity;
    run(ai, 4, () => {
      closest = Math.min(closest, walker.distanceTo({ x: 150, y: 0 }));
    });
    expect(closest).toBeGreaterThan(25);
    const crowd = [0, 1, 2].map((i) =>
      ai.agent(null, { x: i * 2, y: 0, radius: 10, speed: 60 }).separate(),
    );
    run(ai, 2);
    expect(crowd[0]?.distanceTo(crowd[2] ?? { x: 0, y: 0 })).toBeGreaterThan(20);
  });

  it('bounds agents, keeps one behaviour per kind and stops on clear/stop/remove', () => {
    const ai = createGameAi(null, { max: 2 });
    const a = ai.agent(null, { speed: 50 }).seek({ x: 100, y: 0 }).seek({ x: -100, y: 0 });
    ai.agent(null);
    expect(() => ai.agent(null)).toThrow(RangeError);
    run(ai, 1);
    expect(a.x).toBeLessThan(0);
    a.stop();
    const x = a.x;
    run(ai, 1);
    expect(a.x).toBe(x);
    a.remove();
    a.remove();
    expect(ai.agents).toBe(1);
    expect(ai.agent(null)).toBeDefined();
  });

  it('disposes with the scene and refuses use afterwards', () => {
    const disposers: (() => void)[] = [];
    const ai = createGameAi({ random: Math.random, dispose: (fn) => disposers.push(fn) });
    const brain = ai.fsm({ idle: {} }, 'idle');
    ai.agent(null).wander();
    expect(disposers).toHaveLength(1);
    disposers[0]?.();
    ai.dispose();
    expect(ai.agents).toBe(0);
    expect(brain.go('idle')).toBe(false);
    expect(() => ai.agent(null)).toThrow(/disposed/u);
    expect(() => {
      ai.update(1 / 60);
    }).not.toThrow();
  });

  it('exposes the library surface the scenes call', () => {
    const lib = createGameAiLibrary();
    expect(lib.version).toBe('0.7.8');
    expect(lib.limits.agents).toBe(64);
    expect(lib.grid(room).path(at(1, 1), at(1, 4))).toHaveLength(4);
    expect(lib.create(null).agents).toBe(0);
  });
});
