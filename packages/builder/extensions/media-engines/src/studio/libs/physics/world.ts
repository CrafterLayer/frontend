/*
  `s.lib.physics.world(s, options)` (particles and physics, 2026-10-13): a Matter world wired to
  the scene in one call. All of Matter stays on s.lib.physics unchanged; this is optional.

    const w = s.lib.physics.world(s);                          // walls fitted to the design/view
    w.add(Bodies.circle(400, 0, 20), new P.Graphics().circle(0, 0, 20).fill(s.palette.accent));

  - An Engine stepped in s.fixedTick (1/60 s); every step copies each linked body's position and
    angle to its display object (`link`, or `add(body, display)`, which also parents it).
  - Walls: static bodies just outside `bounds` — the design rectangle in design mode, else the
    region, refitted (bodies kept inside) on resize; floor and sides, `walls: 'box'` adds a lid.
  - Drag: a Matter MouseConstraint fed from s.pointer, mapped into the layer's units (design
    units in design mode). It grabs only on a press that lands on the scene itself (never through
    a DOM button over it) and, on touch, stops the page scrolling only when the finger lands on a
    body. Never in the editor.
  - Calm: the editor and reduced motion run no loop — the world settles synchronously (300 steps)
    after the bodies are added and after each later change, and one still frame is drawn.
  - Disposal: s.dispose ends the loop, the listeners, the constraint and the engine.
*/

export interface Vec {
  x: number;
  y: number;
}

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MBody {
  readonly position: Vec;
  readonly angle: number;
  readonly isStatic: boolean;
}

interface MEngine {
  readonly world: unknown;
  readonly gravity: Vec;
}

interface MMouse {
  position: Vec;
  button: number;
  sourceEvents: Record<string, unknown>;
}

/** The Matter modules the helper calls (the bundled matter-js 0.20). */
export interface MatterSlice {
  Engine: {
    create(options?: Record<string, unknown>): MEngine;
    update(engine: MEngine, ms: number): void;
    clear(engine: MEngine): void;
  };
  Bodies: { rectangle(x: number, y: number, w: number, h: number, options?: object): MBody };
  Body: { setPosition(body: MBody, position: Vec): void };
  Composite: {
    add(composite: unknown, object: unknown): void;
    remove(composite: unknown, object: unknown): void;
    clear(composite: unknown, keepStatic: boolean, deep?: boolean): void;
    allBodies(composite: unknown): MBody[];
  };
  Events: { off(object: unknown): void };
  MouseConstraint: { create(engine: MEngine, options: object): object };
  Query: { point(bodies: MBody[], point: Vec): MBody[] };
}

interface Display {
  rotation: number;
  readonly position: { set(x: number, y: number): void };
  readonly parent?: unknown;
  readonly destroyed?: boolean;
  destroy(): void;
}

interface Layer {
  addChild(child: unknown): unknown;
  toLocal?(point: Vec): Vec;
}

interface SceneSlice {
  readonly app: { render(): void };
  readonly canvas: HTMLCanvasElement;
  readonly world: unknown;
  readonly width: number;
  readonly height: number;
  readonly design: {
    readonly width: number;
    readonly height: number;
    readonly view: WorldRect;
  } | null;
  readonly pointer: { readonly nx: number; readonly ny: number; readonly down: boolean };
  readonly editor: boolean;
  readonly reducedMotion: boolean;
  fixedTick(fn: (dt: number) => void, options?: { step?: number }): () => void;
  onResize(fn: () => void): void;
  dispose(fn: () => void): void;
}

export interface WorldOptions {
  /** Downward gravity (Matter's 1 by default, about 1000 units/s²). */
  gravity?: number;
  /** Walls just outside `bounds`: floor and sides (true, the default), 'box' adds a lid, false none. */
  walls?: boolean | 'box';
  /** What the walls fit: the design (design mode) or the region by default; 'view' the visible part. */
  bounds?: WorldRect | 'view';
  /** Pointer drag (default true; never in the editor or under reduced motion). */
  drag?: boolean;
  /** Where add() parents display objects that have none (default s.world). */
  layer?: unknown;
  /** Fixed step in seconds (default 1/60). */
  step?: number;
  /** Steps a calm world runs to settle (default 300). */
  settle?: number;
  /** Matter.Engine.create options, e.g. { enableSleeping: true }. */
  engine?: Record<string, unknown>;
}

export interface PhysicsWorld {
  readonly engine: MEngine;
  /** What the walls fit now, in the layer's units. */
  readonly bounds: WorldRect;
  readonly walls: readonly MBody[];
  /** The MouseConstraint, or null without drag. */
  readonly drag: object | null;
  /** Adds a body; with a display object, links it (and parents it in the layer if it has no parent). */
  add<T extends MBody>(body: T, display?: unknown): T;
  /** Sync display.position/rotation to the body every step (unlinks once the display is destroyed). */
  link(body: MBody, display: unknown): void;
  /** Removes a body and destroys its linked display (keepDisplay: leave it). */
  remove(body: MBody, keepDisplay?: boolean): void;
  /** Steps synchronously until at rest and syncs (a still frame renders). */
  settle(steps?: number): void;
  dispose(): void;
}

/** The walls' collision category: dragging ignores it. */
export const WALL_CATEGORY = 0x40000000;
const THICK = 400;

/** Centre-x, centre-y, width, height of each wall around `b` (floor, start side, end side, lid). */
export function wallRects(b: WorldRect, lid: boolean): [number, number, number, number][] {
  const tall = b.height * 4 + THICK;
  const sideY = b.y + b.height - tall / 2 + THICK / 2;
  const walls: [number, number, number, number][] = [
    [b.x + b.width / 2, b.y + b.height + THICK / 2, b.width + THICK * 2, THICK],
    [b.x - THICK / 2, sideY, THICK, tall],
    [b.x + b.width + THICK / 2, sideY, THICK, tall],
  ];
  if (lid) walls.push([b.x + b.width / 2, b.y - THICK / 2, b.width + THICK * 2, THICK]);
  return walls;
}

export function createWorld(M: MatterSlice) {
  return function world(scene: unknown, options: WorldOptions = {}): PhysicsWorld {
    const s = scene as SceneSlice;
    const calm = s.editor || s.reducedMotion;
    const engine = M.Engine.create(options.engine);
    if (typeof options.gravity === 'number') engine.gravity.y = options.gravity;
    const layer = (options.layer ?? s.world) as Layer;
    const links = new Map<MBody, Display>();
    const bounds: WorldRect = { x: 0, y: 0, width: 0, height: 0 };
    const given = options.bounds;
    const follows = given === 'view' || (given === undefined && s.design === null);
    let walls: MBody[] = [];
    let disposed = false;
    let queued = false;
    let armed = false;

    function measure(): WorldRect {
      if (typeof given === 'object') return { ...given };
      const design = s.design;
      if (design === null) return { x: 0, y: 0, width: s.width, height: s.height };
      return given === 'view'
        ? { ...design.view }
        : { x: 0, y: 0, width: design.width, height: design.height };
    }

    function fit(): void {
      Object.assign(bounds, measure());
      if (options.walls === false) return;
      if (walls.length > 0) M.Composite.remove(engine.world, walls);
      walls = wallRects(bounds, options.walls === 'box').map(([x, y, w, h]) =>
        M.Bodies.rectangle(x, y, w, h, {
          isStatic: true,
          label: 'wall',
          collisionFilter: { category: WALL_CATEGORY },
        }),
      );
      M.Composite.add(engine.world, walls);
      // A smaller region keeps every body inside its new walls.
      for (const body of M.Composite.allBodies(engine.world)) {
        if (body.isStatic) continue;
        const { x, y } = body.position;
        const nx = Math.min(Math.max(x, bounds.x), bounds.x + bounds.width);
        const ny = Math.min(y, bounds.y + bounds.height);
        if (nx !== x || ny !== y) M.Body.setPosition(body, { x: nx, y: ny });
      }
    }

    function sync(): void {
      for (const [body, view] of links) {
        if (view.destroyed === true) {
          links.delete(body);
          M.Composite.remove(engine.world, body);
          continue;
        }
        view.position.set(body.position.x, body.position.y);
        view.rotation = body.angle;
      }
    }

    function settle(steps = options.settle ?? 300): void {
      if (disposed) return;
      for (let i = 0; i < steps; i += 1) M.Engine.update(engine, 1000 / 60);
      sync();
      if (s.reducedMotion) s.app.render();
    }

    /** Calm worlds settle once the current script turn has added its bodies. */
    function later(): void {
      if (!calm || queued || disposed) return;
      queued = true;
      void Promise.resolve().then(() => {
        queued = false;
        settle();
      });
    }

    function local(x: number, y: number): Vec {
      return typeof layer.toLocal === 'function' ? layer.toLocal({ x, y }) : { x, y };
    }

    // ── drag ──────────────────────────────────────────────────────────
    const root = s.canvas.parentElement;
    const mouse: MMouse = { position: { x: 0, y: 0 }, button: -1, sourceEvents: {} };
    const drag =
      options.drag !== false && !calm && root !== null
        ? M.MouseConstraint.create(engine, {
            mouse,
            collisionFilter: { mask: ~WALL_CATEGORY },
            constraint: { stiffness: 0.2, damping: 0.1, angularStiffness: 0 },
          })
        : null;
    const onScene = (target: EventTarget | null): boolean => target === s.canvas || target === root;
    function onDown(event: Event): void {
      armed = onScene(event.target);
    }
    function onTouch(event: Event): void {
      const touch = (event as TouchEvent).touches[0];
      if (touch === undefined || root === null || !onScene(event.target)) return;
      const box = root.getBoundingClientRect();
      const point = local(touch.clientX - box.left, touch.clientY - box.top);
      const bodies = M.Composite.allBodies(engine.world).filter((body) => !body.isStatic);
      if (M.Query.point(bodies, point).length > 0) event.preventDefault();
    }
    if (drag !== null && root !== null) {
      M.Composite.add(engine.world, drag);
      root.addEventListener('pointerdown', onDown);
      root.addEventListener('touchstart', onTouch, { passive: false });
    }
    function feed(): void {
      if (drag === null) return;
      const p = s.pointer;
      const at = local(p.nx * s.width, p.ny * s.height);
      mouse.position.x = at.x;
      mouse.position.y = at.y;
      mouse.button = armed && p.down ? 0 : -1;
    }

    // ── loop, resize, disposal ────────────────────────────────────────
    fit();
    const stop = calm
      ? undefined
      : s.fixedTick(
          (dt) => {
            feed();
            M.Engine.update(engine, dt * 1000);
            sync();
          },
          { step: options.step ?? 1 / 60 },
        );
    if (follows) {
      s.onResize(() => {
        if (disposed) return;
        fit();
        later();
      });
    }

    function dispose(): void {
      if (disposed) return;
      disposed = true;
      stop?.();
      root?.removeEventListener('pointerdown', onDown);
      root?.removeEventListener('touchstart', onTouch);
      M.Events.off(engine);
      M.Composite.clear(engine.world, false, true);
      M.Engine.clear(engine);
      links.clear();
      walls = [];
    }
    s.dispose(dispose);

    function link(body: MBody, display: unknown): void {
      const view = display as Display;
      links.set(body, view);
      view.position.set(body.position.x, body.position.y);
      view.rotation = body.angle;
    }

    return {
      engine,
      bounds,
      get walls(): readonly MBody[] {
        return walls;
      },
      drag,
      add<T extends MBody>(body: T, display?: unknown): T {
        M.Composite.add(engine.world, body);
        if (display !== undefined && display !== null) {
          link(body, display);
          if ((display as Display).parent == null) layer.addChild(display);
        }
        later();
        return body;
      },
      link,
      remove(body: MBody, keepDisplay = false): void {
        M.Composite.remove(engine.world, body);
        const view = links.get(body);
        links.delete(body);
        if (view !== undefined && !keepDisplay && view.destroyed !== true) view.destroy();
        later();
      },
      settle,
      dispose,
    };
  };
}
