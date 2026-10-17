import Matter from 'matter-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPhysicsLibrary } from '../physics-entry';
import { WALL_CATEGORY, wallRects, type PhysicsWorld, type WorldOptions } from './world';

/*
  particles and physics (2026-10-13): s.lib.physics.world(s) on the real matter-js 0.20 with a
  stand-in scene (jsdom has no WebGL). The generated runtime runs it for real in apps/evals
  (particles.browser.test.ts: settle, drag, dispose).
*/

const M = Matter as unknown as {
  Bodies: {
    rectangle(x: number, y: number, w: number, h: number, o?: object): Body;
    circle(x: number, y: number, r: number, o?: object): Body;
  };
  Composite: { allBodies(c: unknown): Body[] };
};
interface Body {
  position: { x: number; y: number };
  angle: number;
  isStatic: boolean;
  speed: number;
}

class FakeView {
  x = 0;
  y = 0;
  rotation = 0;
  parent: unknown = null;
  destroyed = false;
  readonly position = {
    set: (x: number, y: number): void => {
      this.x = x;
      this.y = y;
    },
  };
  destroy(): void {
    this.destroyed = true;
  }
}

interface SceneOptions {
  reducedMotion?: boolean;
  editor?: boolean;
  design?: {
    width: number;
    height: number;
    view: { x: number; y: number; width: number; height: number };
  };
  /** The layer's scale (design units per region px is 1 / scale). */
  scale?: number;
}

function fakeScene(options: SceneOptions = {}) {
  const root = document.createElement('div');
  const canvas = document.createElement('canvas');
  const button = document.createElement('button');
  root.append(canvas, button);
  document.body.append(root);
  const scale = options.scale ?? 1;
  const steps: ((dt: number) => void)[] = [];
  const resizes: (() => void)[] = [];
  const disposers: (() => void)[] = [];
  const unsubscribed = vi.fn();
  const children: unknown[] = [];
  const size = { width: 800, height: 600 };
  const scene = {
    app: { render: vi.fn() },
    canvas,
    world: {
      children,
      addChild(child: FakeView) {
        child.parent = this;
        children.push(child);
      },
      toLocal: (p: { x: number; y: number }) => ({ x: p.x / scale, y: p.y / scale }),
    },
    get width() {
      return size.width;
    },
    get height() {
      return size.height;
    },
    design: options.design ?? null,
    pointer: { nx: 0.5, ny: 0.5, down: false },
    editor: options.editor === true,
    reducedMotion: options.reducedMotion === true,
    fixedTick(fn: (dt: number) => void) {
      steps.push(fn);
      return unsubscribed;
    },
    onResize: (fn: () => void) => resizes.push(fn),
    dispose: (fn: () => void) => disposers.push(fn),
  };
  return {
    scene,
    root,
    canvas,
    button,
    steps,
    unsubscribed,
    children,
    run(count: number) {
      for (let i = 0; i < count; i += 1) for (const fn of steps) fn(1 / 60);
    },
    resize(width: number, height: number) {
      size.width = width;
      size.height = height;
      for (const fn of resizes) fn();
    },
    dispose() {
      for (const fn of disposers) fn();
    },
  };
}

const physics = createPhysicsLibrary();
function world(scene: unknown, options?: WorldOptions): PhysicsWorld {
  return physics.world(scene, options);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('s.lib.physics', () => {
  it('keeps every Matter module unchanged and adds world()', () => {
    for (const key of Object.keys(Matter)) {
      expect((physics as Record<string, unknown>)[key]).toBe(
        (Matter as Record<string, unknown>)[key],
      );
    }
    expect(typeof physics.world).toBe('function');
  });
});

describe('wallRects', () => {
  it('puts a floor below and two tall sides beside the bounds, and a lid on a box', () => {
    const b = { x: 0, y: 0, width: 800, height: 450 };
    const [floor, start, end] = wallRects(b, false);
    const [fx, fy, fw, fh] = floor!;
    const [sx, sy, sw, sh] = start!;
    const [ex, , ew] = end!;
    expect(fx).toBe(400);
    expect(fy - fh / 2).toBe(450);
    expect(fw).toBeGreaterThan(800);
    expect(sx + sw / 2).toBe(0);
    expect(ex - ew / 2).toBe(800);
    // The sides reach far above the top, so bodies dropped in from above stay inside.
    expect(sy - sh / 2).toBeLessThan(-450);
    expect(wallRects(b, false)).toHaveLength(3);
    const [, ly, , lh] = wallRects(b, true)[3]!;
    expect(ly + lh / 2).toBe(0);
  });
});

describe('world(s)', () => {
  it('fits walls to the region, steps in s.fixedTick and syncs linked displays', () => {
    const fake = fakeScene();
    const w = world(fake.scene);
    expect(w.bounds).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect(w.walls).toHaveLength(3);
    expect(fake.steps).toHaveLength(1);
    const view = new FakeView();
    const crate = w.add(M.Bodies.rectangle(400, 100, 40, 40), view);
    expect(fake.children).toContain(view);
    expect(view.y).toBe(100);
    fake.run(240);
    // At rest on the floor (y = 600), its centre half a crate above it.
    expect(crate.position.y).toBeCloseTo(580, 0);
    expect(crate.speed).toBeLessThan(0.05);
    expect(view.y).toBe(crate.position.y);
    expect(view.rotation).toBe(crate.angle);
  });

  it('fits the design in design mode, or its visible view on request', () => {
    const design = { width: 1280, height: 720, view: { x: -100, y: 0, width: 1480, height: 720 } };
    expect(world(fakeScene({ design }).scene).bounds).toEqual({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });
    expect(world(fakeScene({ design }).scene, { bounds: 'view' }).bounds).toEqual(design.view);
    const box = world(fakeScene().scene, {
      bounds: { x: 10, y: 20, width: 100, height: 50 },
      walls: 'box',
    });
    expect(box.bounds).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    expect(box.walls).toHaveLength(4);
    expect(world(fakeScene().scene, { walls: false }).walls).toHaveLength(0);
  });

  it('refits the walls on resize and keeps bodies inside them', () => {
    const fake = fakeScene();
    const w = world(fake.scene);
    const ball = w.add(M.Bodies.circle(700, 500, 20));
    fake.resize(390, 600);
    expect(w.bounds.width).toBe(390);
    expect(ball.position.x).toBeLessThanOrEqual(390);
    fake.run(200);
    expect(ball.position.x).toBeLessThan(390);
    expect(ball.position.y).toBeLessThan(600);
  });

  it('honours gravity and Matter engine options', () => {
    const w = world(fakeScene().scene, { gravity: 0.5, engine: { enableSleeping: true } });
    expect(w.engine.gravity.y).toBe(0.5);
    expect((w.engine as unknown as { enableSleeping: boolean }).enableSleeping).toBe(true);
  });

  it('reduced motion runs no loop: the world settles after the script turn and renders once', async () => {
    const fake = fakeScene({ reducedMotion: true });
    const w = world(fake.scene);
    expect(fake.steps).toHaveLength(0);
    expect(w.drag).toBeNull();
    const view = new FakeView();
    const crate = w.add(M.Bodies.rectangle(400, -40, 40, 40), view);
    expect(crate.position.y).toBe(-40);
    await Promise.resolve();
    expect(crate.position.y).toBeCloseTo(580, 0);
    expect(view.y).toBe(crate.position.y);
    expect(fake.scene.app.render).toHaveBeenCalledTimes(1);
    // A later change settles again.
    w.add(M.Bodies.rectangle(400, -40, 40, 40));
    await Promise.resolve();
    expect(fake.scene.app.render).toHaveBeenCalledTimes(2);
  });

  it('the editor settles too, with no drag and no render call of its own', async () => {
    const fake = fakeScene({ editor: true });
    const w = world(fake.scene);
    const crate = w.add(M.Bodies.rectangle(400, 0, 40, 40));
    await Promise.resolve();
    expect(crate.position.y).toBeCloseTo(580, 0);
    expect(w.drag).toBeNull();
    expect(fake.scene.app.render).not.toHaveBeenCalled();
  });

  it('drags a body with the pointer, mapped into the layer units, only from a press on the scene', () => {
    const fake = fakeScene({ scale: 2 });
    const w = world(fake.scene, { gravity: 0, walls: false });
    // Region px (400, 300) is layer (200, 150).
    const ball = w.add(M.Bodies.circle(200, 150, 20));
    fake.button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fake.scene.pointer.down = true;
    fake.scene.pointer.nx = 0.75;
    fake.run(30);
    expect(ball.position.x).toBeCloseTo(200, 0);
    fake.canvas.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fake.scene.pointer.nx = 0.5;
    fake.run(1);
    fake.scene.pointer.nx = 0.75;
    fake.run(60);
    // Pulled toward region x 600 = layer x 300.
    expect(ball.position.x).toBeGreaterThan(260);
    fake.scene.pointer.down = false;
    fake.run(1);
    expect((w.drag as { body: unknown }).body).toBeNull();
    // Walls are never grabbed.
    expect(WALL_CATEGORY & 1).toBe(0);
  });

  it('on touch, stops the page scrolling only when the finger lands on a body', () => {
    const fake = fakeScene();
    const w = world(fake.scene, { gravity: 0 });
    w.add(M.Bodies.circle(100, 100, 30));
    const touch = (x: number, y: number) => {
      const event = new Event('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: [{ clientX: x, clientY: y }] });
      fake.canvas.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(touch(100, 100)).toBe(true);
    expect(touch(500, 300)).toBe(false);
  });

  it('remove() destroys the display; a destroyed display unlinks its body', () => {
    const fake = fakeScene();
    const w = world(fake.scene);
    const a = new FakeView();
    const b = new FakeView();
    const bodyA = w.add(M.Bodies.circle(100, 100, 10), a);
    const bodyB = w.add(M.Bodies.circle(200, 100, 10), b);
    w.remove(bodyA);
    expect(a.destroyed).toBe(true);
    b.destroyed = true;
    fake.run(1);
    const left = M.Composite.allBodies(w.engine.world).filter((body) => !body.isStatic);
    expect(left).not.toContain(bodyA);
    expect(left).not.toContain(bodyB);
    const kept = new FakeView();
    const bodyC = w.add(M.Bodies.circle(300, 100, 10), kept);
    w.remove(bodyC, true);
    expect(kept.destroyed).toBe(false);
  });

  it('s.dispose ends the loop, the listeners, the constraint and the engine', () => {
    const fake = fakeScene();
    const remove = vi.spyOn(fake.root, 'removeEventListener');
    const w = world(fake.scene);
    w.add(M.Bodies.circle(100, 100, 10), new FakeView());
    fake.dispose();
    expect(fake.unsubscribed).toHaveBeenCalled();
    expect(remove.mock.calls.map(([type]) => type).sort()).toEqual(['pointerdown', 'touchstart']);
    expect(M.Composite.allBodies(w.engine.world)).toEqual([]);
    expect((w.engine.world as { constraints: unknown[] }).constraints).toEqual([]);
    w.dispose();
    w.settle();
    expect(fake.scene.app.render).not.toHaveBeenCalled();
  });
});
