import { describe, expect, it } from 'vitest';

import { fakePixi } from '../shared/fake-pixi.test-util';
import { createCamera } from './camera';
import { ensureTilemapPipe, type TilemapClasses } from './pipe';
import { createWorld, TILE_STYLES } from './world';

class FakeComposite {
  static last: FakeComposite | undefined;
  tiles: [unknown, number, number][] = [];
  x = 0;
  y = 0;
  parent = null;

  constructor() {
    FakeComposite.last = this;
  }

  clear(): this {
    this.tiles = [];
    return this;
  }

  tile(texture: unknown, x: number, y: number): this {
    this.tiles.push([texture, x, y]);
    return this;
  }

  destroy(): void {
    /* nothing to free */
  }

  removeFromParent(): void {
    /* not attached */
  }
}

class FakePipe {
  constructor(
    readonly renderer: unknown,
    readonly adaptor: unknown,
  ) {}
}

const classes = {
  CompositeTilemap: FakeComposite,
  TilemapPipe: FakePipe,
} as unknown as TilemapClasses;

const LEVEL = ['##########', '#..c...c.#', '#........#', '#p..==...#', '##########'];

const LEGEND = {
  '#': { style: 'stone' as const, solid: true },
  '=': { style: 'wood' as const, oneWay: true },
  c: { kind: 'coin', marker: true },
  p: { kind: 'player', marker: true },
  '.': null,
};

function world() {
  const { PIXI, app } = fakePixi();
  return {
    app,
    world: createWorld(PIXI, classes, app, { tileSize: 10, rows: LEVEL, legend: LEGEND }),
  };
}

describe('tilemap pipe registration', () => {
  it('adds the pipe to a live renderer once and registers its teardown', () => {
    const { app } = fakePixi();
    const renderer = app.renderer as unknown as {
      renderPipes: Record<string, unknown>;
      runners: { destroy: { items: unknown[] } };
    };
    expect(ensureTilemapPipe(classes, app.renderer)).toBe(true);
    const pipe = renderer.renderPipes['tilemap'];
    expect(pipe).toBeInstanceOf(FakePipe);
    expect(ensureTilemapPipe(classes, app.renderer)).toBe(true);
    expect(renderer.renderPipes['tilemap']).toBe(pipe);
    expect(renderer.runners.destroy.items).toEqual([pipe]);
  });

  it('reports a renderer without the registered adaptor', () => {
    const { app } = fakePixi();
    (
      app.renderer as unknown as { config: { renderPipeAdaptors: unknown[] } }
    ).config.renderPipeAdaptors = [];
    expect(ensureTilemapPipe(classes, app.renderer)).toBe(false);
  });
});

describe('tile worlds', () => {
  it('draws one tile per drawable cell with procedural textures shared per symbol', () => {
    const { app, world: w } = world();
    expect(w).toMatchObject({ cols: 10, rows: 5, width: 100, height: 50 });
    const tiles = FakeComposite.last?.tiles ?? [];
    // 26 stone border cells + 2 one-way planks; markers and '.' draw nothing.
    expect(tiles).toHaveLength(28);
    expect((app as unknown as { textures: unknown[] }).textures).toHaveLength(2);
  });

  it('finds markers and kinds, reads cells and treats edges as walls', () => {
    const { world: w } = world();
    expect(w.find('coin').map((cell) => [cell.col, cell.row])).toEqual([
      [3, 1],
      [7, 1],
    ]);
    expect(w.find('p')[0]).toMatchObject({ col: 1, row: 3, x: 10, y: 30, kind: 'player' });
    expect(w.solidAt(5, 5)).toBe(true);
    expect(w.solidAt(25, 25)).toBe(false);
    expect(w.solidAt(-1, 25)).toBe(true);
    expect(w.tileAt(99, 0)).toBeUndefined();
  });

  it('moves boxes against walls and floors and reports grounding', () => {
    const { world: w } = world();
    const fall = w.move({ x: 12, y: 12, w: 6, h: 6 }, 0, 100);
    expect(fall).toMatchObject({ y: 34, hitY: true, onGround: true });
    const wall = w.move({ x: 80, y: 12, w: 6, h: 6 }, 50, 0);
    expect(wall).toMatchObject({ x: 84, hitX: true });
    const still = w.move({ x: 12, y: 34, w: 6, h: 6 }, 0, 0);
    expect(still.onGround).toBe(true);
    const ceiling = w.move({ x: 12, y: 20, w: 6, h: 6 }, 0, -50);
    expect(ceiling).toMatchObject({ y: 10, onCeiling: true });
  });

  it('lands on one-way planks from above but passes through from below and sideways', () => {
    const { world: w } = world();
    const land = w.move({ x: 42, y: 20, w: 6, h: 6 }, 0, 20);
    expect(land).toMatchObject({ y: 24, onGround: true });
    const jump = w.move({ x: 42, y: 34, w: 6, h: 4 }, 0, -10);
    expect(jump.hitY).toBe(false);
    const walk = w.move({ x: 30, y: 31, w: 6, h: 6 }, 10, 0);
    expect(walk.hitX).toBe(false);
  });

  it('does not tunnel through a wall at high speed', () => {
    const { world: w } = world();
    const fast = w.move({ x: 12, y: 12, w: 6, h: 6 }, 10_000, 0);
    expect(fast.x).toBe(84);
    expect(fast.hitX).toBe(true);
  });

  it('collects pickups by changing cells and lists overlaps', () => {
    const { world: w } = world();
    const hits = w.overlaps({ x: 31, y: 11, w: 6, h: 6 }).filter((cell) => cell.kind === 'coin');
    expect(hits).toHaveLength(1);
    expect(w.set(3, 1, '.')).toBe(true);
    expect(w.find('coin')).toHaveLength(1);
    expect(w.set(3, 1, 'too long')).toBe(false);
  });

  it('validates its input', () => {
    const { PIXI, app } = fakePixi();
    expect(() => createWorld(PIXI, classes, app, { rows: [], legend: {} })).toThrow(RangeError);
    expect(() => createWorld(PIXI, classes, app, { rows: ['#'], legend: {}, tileSize: 1 })).toThrow(
      RangeError,
    );
    expect(() => createWorld(PIXI, classes, app, { rows: ['x'.repeat(300)], legend: {} })).toThrow(
      RangeError,
    );
    expect(() =>
      createWorld(PIXI, classes, app, { rows: ['#'], legend: { ab: { solid: true } } }),
    ).toThrow(TypeError);
    expect(() =>
      createWorld(PIXI, classes, app, { rows: ['#'], legend: { '#': { style: 'neon' as never } } }),
    ).toThrow(RangeError);
    expect(TILE_STYLES).toContain('grass');
  });
});

describe('follow camera', () => {
  function view() {
    return { x: 0, y: 0, scale: { x: 1, y: 1 } };
  }

  it('centres the target and clamps to the world edges', () => {
    const v = view();
    const cam = createCamera(v, {
      world: { width: 1000, height: 600 },
      screen: () => ({ width: 200, height: 100 }),
      lerp: 0,
    });
    cam.follow(500, 300, 1 / 60);
    expect(v).toMatchObject({ x: -400, y: -250 });
    cam.follow(0, 0, 1 / 60);
    expect(v).toMatchObject({ x: 0, y: 0 });
    cam.follow(5000, 5000, 1 / 60);
    expect(v).toMatchObject({ x: -800, y: -500 });
    expect(cam.toWorld(100, 50)).toEqual({ x: 900, y: 550 });
  });

  it('centres a world smaller than the screen and eases when lerp is set', () => {
    const v = view();
    const cam = createCamera(v, {
      world: { width: 100, height: 50 },
      screen: () => ({ width: 200, height: 100 }),
      lerp: 8,
    });
    cam.snap(10, 10);
    expect(v).toMatchObject({ x: 50, y: 25 });
    const eased = view();
    const follow = createCamera(eased, {
      world: { width: 1000, height: 1000 },
      screen: () => ({ width: 100, height: 100 }),
      lerp: 8,
    });
    follow.snap(50, 50);
    follow.follow(500, 500, 1 / 60);
    expect(follow.x).toBeGreaterThan(50);
    expect(follow.x).toBeLessThan(500);
    follow.zoom = 2;
    expect(eased.scale.x).toBe(2);
  });
});
