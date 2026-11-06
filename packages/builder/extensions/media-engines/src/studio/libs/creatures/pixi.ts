/*
  The Pixi back-end for `s.lib.creatures` (character art, 2026-11-05). Each joint of the part
  tree becomes a Container and each layer a Graphics, so `anim.rig` drives root, body, head,
  arms, legs and tail directly. Soft shading uses Pixi v8's FillGradient in 'local' texture space
  (the same 0..1 box SVG's objectBoundingBox uses); a namespace without FillGradient (a test
  stand-in) gets each gradient's middle colour instead.

  Plain code: the Pixi namespace arrives with the call (the scene `s`, `s.PIXI`, or ck.stage()'s
  `{ PIXI, app }`), like `anim.peek`.
*/

import { createRig, type RigOptions, type RigState } from '../anim/character';
import type { Animator } from '../anim/tween';
import { buildCreature, rebuildFace, type Built } from './build';
import { asDef, knownMood, moodOf, type CreatureDef, type CreatureMood } from './define';
import { createLife, GAZE, type Life, type Transform } from './life';
import type { Gradient, Layer, Line, Paint, Part, Prim, Shape } from './shapes';
import { sizeOf } from './svg';

interface DisplayLike extends Transform {
  addChild(...children: unknown[]): unknown;
  removeChildren?: () => unknown[];
  destroy?: (options?: unknown) => void;
  parent?: unknown;
  label?: string;
}

interface GraphicsLike extends DisplayLike {
  ellipse(x: number, y: number, rx: number, ry: number): GraphicsLike;
  moveTo(x: number, y: number): GraphicsLike;
  lineTo(x: number, y: number): GraphicsLike;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): GraphicsLike;
  bezierCurveTo(ax: number, ay: number, bx: number, by: number, x: number, y: number): GraphicsLike;
  closePath(): GraphicsLike;
  fill(style: unknown): GraphicsLike;
  stroke(style: unknown): GraphicsLike;
}

interface GradientLike {
  destroy?: () => void;
}

interface PixiLike {
  Container: new () => DisplayLike;
  Graphics: new () => GraphicsLike;
  FillGradient?: new (options: unknown) => GradientLike;
}

interface Host {
  PIXI: PixiLike;
  random: () => number;
  pointer: { x: number; y: number } | undefined;
  world: DisplayLike | undefined;
  editor: boolean;
  reducedMotion: boolean;
}

function isPixi(value: unknown): value is PixiLike {
  const v = value as Partial<PixiLike> | null;
  return typeof v?.Container === 'function' && typeof v.Graphics === 'function';
}

function hostOf(value: unknown): Host {
  const plain = {
    random: Math.random,
    pointer: undefined,
    world: undefined,
    editor: false,
    reducedMotion: false,
  };
  if (isPixi(value)) return { PIXI: value, ...plain };
  const host = value as {
    PIXI?: unknown;
    random?: unknown;
    pointer?: unknown;
    world?: unknown;
    editor?: unknown;
    reducedMotion?: unknown;
  } | null;
  if (!isPixi(host?.PIXI)) {
    throw new TypeError('creatures.create needs the scene (s), s.PIXI or { PIXI }');
  }
  const pointer = host.pointer as { x?: unknown; y?: unknown } | undefined;
  const world = host.world as { addChild?: unknown } | undefined;
  return {
    PIXI: host.PIXI,
    random:
      typeof host.random === 'function' ? (host.random as () => number).bind(host) : Math.random,
    pointer:
      typeof pointer?.x === 'number' && typeof pointer.y === 'number'
        ? (pointer as { x: number; y: number })
        : undefined,
    world: typeof world?.addChild === 'function' ? (world as DisplayLike) : undefined,
    editor: host.editor === true,
    reducedMotion: host.reducedMotion === true,
  };
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

const hex8 = (c: number, a: number) =>
  `#${(c & 0xffffff).toString(16).padStart(6, '0')}${Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** Turns gradients into FillGradients once per creature (shapes sharing one share it). */
class Paints {
  readonly made: GradientLike[] = [];
  private readonly cache = new Map<Gradient, GradientLike>();
  constructor(private readonly P: PixiLike) {}

  fill(p: Paint, alpha = 1): unknown {
    if (typeof p === 'number') return { color: p, alpha };
    const Fill = this.P.FillGradient;
    if (Fill === undefined) {
      // No gradients: the stop nearest the middle stands in.
      const mid = [...p.stops].sort((a, b) => Math.abs(a[0] - 0.5) - Math.abs(b[0] - 0.5))[0];
      return { color: mid?.[1] ?? 0, alpha: alpha * (mid?.[2] ?? 1) };
    }
    let g = this.cache.get(p);
    if (g === undefined) {
      const colorStops = p.stops.map(([offset, c, a]) => ({ offset, color: hex8(c, a) }));
      g =
        p.type === 'linear'
          ? new Fill({
              type: 'linear',
              start: { x: p.x1, y: p.y1 },
              end: { x: p.x2, y: p.y2 },
              colorStops,
              textureSpace: 'local',
              textureSize: 128,
            })
          : new Fill({
              type: 'radial',
              center: { x: p.cx, y: p.cy },
              innerRadius: 0,
              outerCenter: { x: p.cx, y: p.cy },
              outerRadius: p.r,
              colorStops,
              textureSpace: 'local',
              textureSize: 64,
            });
      this.cache.set(p, g);
      this.made.push(g);
    }
    return { fill: g, alpha };
  }

  destroy(): void {
    for (const g of this.made) g.destroy?.();
    this.made.length = 0;
    this.cache.clear();
  }
}

/* Shapes are traced in pixels (figure units × s): Pixi picks curve and ellipse segment counts
   from the size it is given, so tracing small units and scaling the container up would facet. */
function trace(g: GraphicsLike, shape: Shape, s: number): void {
  if (shape.t === 'ellipse') {
    g.ellipse(shape.cx * s, shape.cy * s, shape.rx * s, shape.ry * s);
    return;
  }
  for (const c of shape.d) {
    switch (c[0]) {
      case 'M':
        g.moveTo(c[1] * s, c[2] * s);
        break;
      case 'L':
        g.lineTo(c[1] * s, c[2] * s);
        break;
      case 'Q':
        g.quadraticCurveTo(c[1] * s, c[2] * s, c[3] * s, c[4] * s);
        break;
      case 'C':
        g.bezierCurveTo(c[1] * s, c[2] * s, c[3] * s, c[4] * s, c[5] * s, c[6] * s);
        break;
      default:
        g.closePath();
    }
  }
}

const strokeStyle = (line: Line, scale: number) => ({
  width: line.w * scale,
  color: line.c,
  alpha: line.a ?? 1,
  cap: 'round',
  join: 'round',
});

function drawPrim(g: GraphicsLike, p: Prim, paints: Paints, s: number): void {
  if (p.fill !== undefined) {
    trace(g, p.shape, s);
    g.fill(paints.fill(p.fill, p.alpha ?? 1));
  }
  if (p.line !== undefined) {
    if (p.fill === undefined) trace(g, p.shape, s);
    g.stroke(strokeStyle(p.line, s));
  }
}

function drawLayer(g: GraphicsLike, l: Layer, paints: Paints, s: number): void {
  if (l.outline !== undefined) {
    for (const p of l.prims) {
      trace(g, p.shape, s);
      g.stroke(strokeStyle(l.outline, 2 * s));
    }
  }
  for (const p of l.prims) drawPrim(g, p, paints, s);
}

interface Rendered {
  readonly named: Map<string, DisplayLike>;
  readonly roles: Map<string, DisplayLike[]>;
}

function renderInto(
  P: PixiLike,
  container: DisplayLike,
  p: Part,
  paints: Paints,
  out: Rendered,
  s: number,
): void {
  for (const item of p.items) {
    if (item.kind === 'part') {
      const child = new P.Container();
      child.x = (item.px - p.px) * s;
      child.y = (item.py - p.py) * s;
      child.label = item.name;
      if (!out.named.has(item.name)) out.named.set(item.name, child);
      renderInto(P, child, item, paints, out, s);
      container.addChild(child);
    } else {
      if (item.prims.length === 0) continue;
      const g = new P.Graphics();
      g.x = -p.px * s;
      g.y = -p.py * s;
      drawLayer(g, item, paints, s);
      container.addChild(g);
      if (item.role !== undefined) {
        const list = out.roles.get(item.role) ?? [];
        list.push(g);
        out.roles.set(item.role, list);
      }
    }
  }
}

/** The joints `anim.rig` reads. */
const RIG_NAMES = ['root', 'body', 'head', 'armL', 'armR', 'legL', 'legR', 'tail'] as const;

/* Chibi limbs are short and the head is big: the rig's human-sized swings are eased for them,
   so a raised arm waves beside the head instead of disappearing behind it. */
function eased(target: DisplayLike, kind: 'arm' | 'leg'): Transform {
  let raw = target.rotation;
  const soften = (r: number) => {
    if (kind === 'leg') return r * 0.6;
    const a = Math.abs(r);
    return Math.sign(r) * (a <= 1 ? a : 1 + (a - 1) * 0.55);
  };
  return {
    get x() {
      return target.x;
    },
    set x(v: number) {
      target.x = v;
    },
    get y() {
      return target.y;
    },
    set y(v: number) {
      target.y = v;
    },
    get rotation() {
      return raw;
    },
    set rotation(v: number) {
      raw = v;
      target.rotation = soften(v);
    },
    scale: target.scale,
  };
}

export interface CreateOptions {
  /** The square the character is drawn in, px (24..1024); 200 by default. */
  size?: number;
  /** Where the feet stand, in the parent's coordinates. */
  x?: number;
  y?: number;
  /** An `s.lib.anim` animator: blinking, glances and secondary motion run on it. */
  animator?: unknown;
  mood?: CreatureMood | (string & {});
  /** 'wander' glances around, 'pointer' follows the scene pointer, 'none' looks ahead. */
  look?: 'wander' | 'pointer' | 'none';
  /** Where to add the view; the scene's world by default. null adds it nowhere. */
  parent?: unknown;
}

export interface CreatureFace {
  readonly mood: CreatureMood;
  set(mood: CreatureMood | (string & {})): boolean;
  blink(): void;
  /** Glance at a point in the view's parent space; null hands the eyes back. */
  lookAt(x: number | null, y?: number): void;
}

export interface CreatureRigOptions {
  state?: RigState;
  speed?: number;
  facing?: 1 | -1;
}

export interface Creature {
  readonly view: unknown;
  readonly parts: Readonly<Record<string, unknown>>;
  readonly def: CreatureDef;
  readonly face: CreatureFace;
  /** Drive the joints with `anim.rig` (idle, walk, run, jump, wave, talk, celebrate, hurt, think). */
  rig(animator: unknown, options?: CreatureRigOptions | null): ReturnType<typeof createRig>;
  dispose(): void;
}

interface AnimatorLike extends Animator {
  rig?: (
    parts: Readonly<Record<string, unknown>>,
    options?: RigOptions,
  ) => ReturnType<typeof createRig>;
}

function isAnimator(value: unknown): value is AnimatorLike {
  const a = value as Partial<Animator> | null;
  return typeof a?.add === 'function' && typeof a.update === 'function';
}

const UNITS = 120;

export function createCreature(
  target: unknown,
  input?: unknown,
  options?: CreateOptions | null,
): Creature {
  const host = hostOf(target);
  const P = host.PIXI;
  const opts = typeof options === 'object' && options !== null ? options : {};
  const def = asDef(input);
  let mood: CreatureMood = opts.mood === undefined ? def.mood : moodOf(opts.mood);
  const built: Built = buildCreature(def, mood);
  const size = sizeOf(opts.size);
  const paints = new Paints(P);
  const rendered: Rendered = { named: new Map(), roles: new Map() };
  const view = new P.Container();
  view.label = `creature:${def.kind}`;
  // Pixels per figure unit: the joints and shapes are laid out in pixels, the view stays at 1.
  const k = (size / UNITS) * built.fit;
  renderInto(P, view, built.root, paints, rendered, k);
  view.x = num(opts.x, 0, -1e6, 1e6);
  view.y = num(opts.y, 0, -1e6, 1e6);
  const named = rendered.named;
  named.set('root', view);
  const shadow = rendered.roles.get('shadow')?.[0];
  if (shadow !== undefined) {
    // Scale the contact shadow about its own centre (it sits on the feet line).
    shadow.x = 0;
    shadow.y = 0;
  }

  const parts: Record<string, unknown> = {};
  for (const [name, c] of named) parts[name] = c;
  if (shadow !== undefined) parts['shadow'] = shadow;
  // A mood change rebuilds the eyes: always hand out the current ones.
  Object.defineProperty(parts, 'eyes', { get: () => named.get('eyes'), enumerable: true });

  const parent =
    opts.parent === null
      ? undefined
      : typeof (opts.parent as { addChild?: unknown } | undefined)?.addChild === 'function'
        ? (opts.parent as DisplayLike)
        : host.world;
  parent?.addChild(view);

  const animator = isAnimator(opts.animator) ? opts.animator : undefined;
  const still =
    host.editor || host.reducedMotion || animator === undefined || animator.reducedMotion;
  const look = opts.look === 'pointer' || opts.look === 'none' ? opts.look : 'wander';

  // Eyes offset toward a point in the view's parent space.
  const gazeToward = (x: number, y: number) => {
    const eyesY = view.y + (built.face.eyeY - 0) * k;
    const dx = x - view.x;
    const dy = y - eyesY;
    const d = Math.max(1, Math.hypot(dx, dy));
    return { x: (dx / d) * GAZE.x * k * Math.sign(view.scale.x || 1), y: (dy / d) * GAZE.y * k };
  };

  let life: Life | undefined;
  let removeRunner: (() => void) | undefined;
  if (!still) {
    life = createLife(
      {
        eyes: () => named.get('eyes'),
        earL: named.get('earL'),
        earR: named.get('earR'),
        wingL: named.get('wingL'),
        wingR: named.get('wingR'),
        tailSway: named.get('tailSway'),
        float: named.get('float'),
        shadow,
        sparkles: rendered.roles.get('sparkle') ?? [],
      },
      built.motion,
      {
        random: host.random,
        pointer: () =>
          host.pointer === undefined ? undefined : gazeToward(host.pointer.x, host.pointer.y),
      },
      look,
      k,
    );
    const runner = life;
    removeRunner = animator.add({
      target: view,
      step: (dt) => runner.step(dt),
      cancel: () => {
        runner.stop();
      },
    });
  }

  const face: CreatureFace = {
    get mood() {
      return mood;
    },
    set(next) {
      // An unknown word keeps the current face.
      const resolved = knownMood(next);
      const holder = named.get('face');
      if (resolved === undefined || holder === undefined) return false;
      mood = resolved;
      const old = holder.removeChildren?.() ?? [];
      for (const child of old) (child as DisplayLike).destroy?.({ children: true });
      const fresh: Rendered = { named: new Map(), roles: new Map() };
      renderInto(P, holder, rebuildFace(built, mood), paints, fresh, k);
      const eyes = fresh.named.get('eyes');
      if (eyes !== undefined) named.set('eyes', eyes);
      return true;
    },
    blink() {
      life?.blink();
    },
    lookAt(x, y) {
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        life?.look(null);
        const eyes = named.get('eyes');
        if (life === undefined && eyes !== undefined) {
          eyes.x = 0;
          eyes.y = 0;
        }
        return;
      }
      const offset = gazeToward(x, y);
      if (life !== undefined) life.look(offset);
      else {
        const eyes = named.get('eyes');
        if (eyes !== undefined) {
          eyes.x = offset.x;
          eyes.y = offset.y;
        }
      }
    },
  };

  let disposed = false;
  return {
    view,
    parts: Object.freeze(parts),
    def,
    face,
    rig(anim, rigOptions) {
      if (!isAnimator(anim)) throw new TypeError('creatures: rig needs an s.lib.anim animator');
      const o = typeof rigOptions === 'object' && rigOptions !== null ? rigOptions : {};
      const rigParts: Record<string, unknown> = {};
      for (const name of RIG_NAMES) {
        const c = named.get(name);
        if (c === undefined) continue;
        rigParts[name] = name.startsWith('arm')
          ? eased(c, 'arm')
          : name.startsWith('leg')
            ? eased(c, 'leg')
            : c;
      }
      const rigOpts: RigOptions = {
        // The standing height in the parent's pixels (the rig's bobs scale with it).
        size: 96 * k,
        ...(o.state === undefined ? {} : { state: o.state }),
        ...(o.speed === undefined ? {} : { speed: o.speed }),
        ...(o.facing === undefined ? {} : { facing: o.facing }),
      };
      return typeof anim.rig === 'function'
        ? anim.rig(rigParts, rigOpts)
        : createRig(anim, rigParts, rigOpts);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      life?.stop();
      removeRunner?.();
      view.destroy?.({ children: true });
      paints.destroy();
    },
  };
}
