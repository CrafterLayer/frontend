/*
  Character animation for the `anim` Studio library (creative engines, 2026-10-12).

  Two ways to bring a character to life, both driven by the Animator's clock:

  - `anim.sprite(view, { states, initial })` — a frame-based state machine. Frames are usually
    textures (assigned to `view.texture`) from a licensed sprite sheet; `apply(frame, index, state)`
    lets any other value drive the view instead.
  - `anim.rig(parts, { state })` — a procedural rig for characters drawn with Graphics (no art
    assets needed): idle breathing, walk/run cycles, jump, wave, talk, celebrate, hurt and think,
    cross-faded over 0.15 s. Parts are any objects with x, y, rotation and scale.{x,y}.
*/

import type { Animator } from './tween';

export interface SpriteStateDef {
  frames: readonly unknown[];
  fps?: number;
  loop?: boolean;
  /** The state to enter when a non-looping state ends. */
  next?: string;
}

export interface SpriteAnimatorOptions {
  states: Readonly<Record<string, SpriteStateDef>>;
  initial?: string;
  apply?: (frame: unknown, index: number, state: string) => void;
}

export interface SpriteAnimator {
  readonly state: string;
  readonly frame: number;
  play(state: string, restart?: boolean): boolean;
  onEnd(fn: (state: string) => void): void;
  stop(): void;
}

const MAX_STATES = 32;
const MAX_FRAMES = 256;

export function createSpriteAnimator(
  animator: Animator,
  view: unknown,
  // Authored scene code is plain JavaScript: the options or their states may be missing.
  input: SpriteAnimatorOptions | null | undefined,
): SpriteAnimator {
  if (input === null || input === undefined) throw new TypeError('anim.sprite needs states');
  const options = input;
  const rawStates: unknown = options.states;
  if (typeof rawStates !== 'object' || rawStates === null)
    throw new TypeError('anim.sprite needs states');
  const states = rawStates as Readonly<Record<string, SpriteStateDef>>;
  const names = Object.keys(states);
  if (names.length < 1 || names.length > MAX_STATES) {
    throw new RangeError(`anim.sprite needs 1..${String(MAX_STATES)} states`);
  }
  for (const [name, def] of Object.entries(states)) {
    if (!Array.isArray(def.frames) || def.frames.length < 1 || def.frames.length > MAX_FRAMES) {
      throw new RangeError(`anim.sprite state "${name}" needs 1..${String(MAX_FRAMES)} frames`);
    }
    if (def.next !== undefined && !(def.next in states)) {
      throw new RangeError(`anim.sprite state "${name}" goes to unknown "${def.next}"`);
    }
  }
  let state =
    options.initial !== undefined && options.initial in states ? options.initial : (names[0] ?? '');
  let frame = 0;
  let clock = 0;
  let stopped = false;
  const listeners: ((state: string) => void)[] = [];

  /** The current state's definition (validated above; re-read so later edits to states apply). */
  function stateDef(): SpriteStateDef {
    const def = states[state];
    if (def === undefined) throw new TypeError(`anim.sprite state "${state}" is missing`);
    return def;
  }

  function show(): void {
    const def = stateDef();
    const value = def.frames[frame];
    if (options.apply !== undefined) options.apply(value, frame, state);
    else if (typeof view === 'object' && view !== null)
      (view as { texture: unknown }).texture = value;
  }

  function play(next: string, restart = false): boolean {
    if (stopped || !(next in states)) return false;
    if (next === state && !restart) return true;
    state = next;
    frame = 0;
    clock = 0;
    show();
    return true;
  }

  show();
  animator.add({
    target: view,
    step(dt) {
      if (stopped) return false;
      const def = stateDef();
      const fps = Math.max(0.5, Math.min(60, def.fps ?? 8));
      clock += dt;
      const advance = Math.floor(clock * fps);
      if (advance === 0) return true;
      clock -= advance / fps;
      let nextFrame = frame + advance;
      if (nextFrame >= def.frames.length) {
        if (def.loop !== false) nextFrame %= def.frames.length;
        else {
          nextFrame = def.frames.length - 1;
          const ended = state;
          if (def.next !== undefined) play(def.next, true);
          else frame = nextFrame;
          for (const fn of listeners) fn(ended);
          if (def.next !== undefined) return true;
        }
      }
      if (nextFrame !== frame) {
        frame = nextFrame;
        show();
      }
      return true;
    },
    cancel() {
      stopped = true;
    },
  });

  return {
    get state() {
      return state;
    },
    get frame() {
      return frame;
    },
    play,
    onEnd(fn) {
      if (typeof fn === 'function') listeners.push(fn);
    },
    stop() {
      stopped = true;
    },
  };
}

export const RIG_STATES = [
  'idle',
  'walk',
  'run',
  'jump',
  'wave',
  'talk',
  'celebrate',
  'hurt',
  'think',
] as const;
export type RigState = (typeof RIG_STATES)[number];

const RIG_PARTS = ['root', 'body', 'head', 'armL', 'armR', 'legL', 'legR', 'tail'] as const;
type RigPart = (typeof RIG_PARTS)[number];

interface Transformable {
  x: number;
  y: number;
  rotation: number;
  scale: { x: number; y: number };
}

interface Pose {
  x: number;
  y: number;
  rotation: number;
  sx: number;
  sy: number;
}

type PoseFn = (t: number, size: number) => Partial<Record<RigPart, Partial<Pose>>>;

const POSES: Readonly<Record<RigState, PoseFn>> = {
  idle: (t, size) => ({
    body: { y: Math.sin(t * 2.2) * size * 0.015, sy: 1 + Math.sin(t * 2.2) * 0.02 },
    head: { rotation: Math.sin(t * 1.1) * 0.04 },
    armL: { rotation: Math.sin(t * 2.2) * 0.04 },
    armR: { rotation: -Math.sin(t * 2.2) * 0.04 },
    tail: { rotation: Math.sin(t * 3) * 0.25 },
  }),
  walk: (t, size) => {
    const p = t * 8;
    return {
      body: { y: -Math.abs(Math.sin(p)) * size * 0.04 },
      head: { rotation: Math.sin(p) * 0.04 },
      legL: { rotation: Math.sin(p) * 0.45 },
      legR: { rotation: -Math.sin(p) * 0.45 },
      armL: { rotation: -Math.sin(p) * 0.4 },
      armR: { rotation: Math.sin(p) * 0.4 },
      tail: { rotation: Math.sin(p * 0.5) * 0.35 },
    };
  },
  run: (t, size) => {
    const p = t * 13;
    return {
      root: { rotation: 0.08 },
      body: { y: -Math.abs(Math.sin(p)) * size * 0.08 },
      head: { rotation: Math.sin(p) * 0.06 },
      legL: { rotation: Math.sin(p) * 0.8 },
      legR: { rotation: -Math.sin(p) * 0.8 },
      armL: { rotation: -Math.sin(p) * 0.9 },
      armR: { rotation: Math.sin(p) * 0.9 },
      tail: { rotation: Math.sin(p * 0.5) * 0.5 },
    };
  },
  jump: (t, size) => ({
    body: { y: -size * 0.05, sy: 1.04, sx: 0.97 },
    legL: { rotation: 0.6 },
    legR: { rotation: -0.4 },
    armL: { rotation: -2.4 + Math.sin(t * 6) * 0.1 },
    armR: { rotation: 2.4 - Math.sin(t * 6) * 0.1 },
    tail: { rotation: 0.6 },
  }),
  wave: (t) => ({
    armR: { rotation: 2.5 + Math.sin(t * 9) * 0.45 },
    head: { rotation: -0.06 },
    tail: { rotation: Math.sin(t * 6) * 0.4 },
  }),
  talk: (t, size) => ({
    head: { rotation: Math.sin(t * 7) * 0.05, y: Math.abs(Math.sin(t * 9)) * -size * 0.01 },
    armR: { rotation: 0.5 + Math.sin(t * 4) * 0.25 },
    body: { y: Math.sin(t * 2.2) * size * 0.012 },
  }),
  celebrate: (t, size) => ({
    body: { y: -Math.abs(Math.sin(t * 7)) * size * 0.12 },
    armL: { rotation: -2.6 + Math.sin(t * 14) * 0.25 },
    armR: { rotation: 2.6 - Math.sin(t * 14) * 0.25 },
    head: { rotation: Math.sin(t * 7) * 0.08 },
    tail: { rotation: Math.sin(t * 12) * 0.5 },
  }),
  hurt: (t, size) => ({
    root: { rotation: -0.12 },
    body: { x: Math.sin(t * 40) * size * 0.02 * Math.max(0, 1 - t * 2) },
    head: { rotation: -0.2 },
    armL: { rotation: 0.6 },
    armR: { rotation: -0.6 },
  }),
  think: (t) => ({
    head: { rotation: 0.12 + Math.sin(t * 1.4) * 0.03 },
    armR: { rotation: 2 + Math.sin(t * 2) * 0.05 },
    body: { sy: 1 + Math.sin(t * 2) * 0.01 },
  }),
};

export interface RigOptions {
  state?: RigState;
  /** The character's height in px; scales the bob distances. */
  size?: number;
  speed?: number;
  facing?: 1 | -1;
}

export interface Rig {
  readonly state: RigState;
  readonly facing: 1 | -1;
  set(state: RigState): boolean;
  face(direction: 1 | -1): void;
  speed: number;
  stop(): void;
}

function isTransformable(value: unknown): value is Transformable {
  if (typeof value !== 'object' || value === null) return false;
  const part = value as Partial<Record<keyof Transformable, unknown>>;
  return (
    typeof part.x === 'number' &&
    typeof part.y === 'number' &&
    typeof part.rotation === 'number' &&
    typeof part.scale === 'object' &&
    part.scale !== null
  );
}

function isRigState(value: unknown): value is RigState {
  return (RIG_STATES as readonly unknown[]).includes(value);
}

export function createRig(
  animator: Animator,
  // Authored scene code is plain JavaScript: parts may be missing or not an object.
  parts: Readonly<Partial<Record<RigPart, unknown>>> | null | undefined,
  options: RigOptions = {},
): Rig {
  if (typeof parts !== 'object' || parts === null) throw new TypeError('anim.rig needs parts');
  const bound = new Map<RigPart, { part: Transformable; base: Pose }>();
  for (const name of RIG_PARTS) {
    const part = parts[name];
    if (part === undefined) continue;
    if (!isTransformable(part))
      throw new TypeError(`anim.rig part "${name}" is not a display object`);
    bound.set(name, {
      part,
      base: { x: part.x, y: part.y, rotation: part.rotation, sx: part.scale.x, sy: part.scale.y },
    });
  }
  if (bound.size === 0) throw new RangeError('anim.rig needs at least one part');
  const size = Math.max(8, Math.min(2000, options.size ?? 64));
  let state: RigState = isRigState(options.state) ? options.state : 'idle';
  let previous: RigState = state;
  let blend = 1;
  let t = 0;
  let facing: 1 | -1 = options.facing === -1 ? -1 : 1;
  let stopped = false;
  let speed = Math.max(0, Math.min(4, options.speed ?? 1));

  function render(): void {
    const now = POSES[state](t, size);
    const before = blend < 1 ? POSES[previous](t, size) : undefined;
    for (const [name, { part, base }] of bound) {
      const a = now[name] ?? {};
      const b = before?.[name] ?? {};
      const mix = (key: keyof Pose, rest: number): number => {
        const target = a[key] ?? rest;
        return before === undefined
          ? target
          : (b[key] ?? rest) + (target - (b[key] ?? rest)) * blend;
      };
      // The root belongs to game code (it walks, jumps, is laid out on resize): the rig only
      // leans, flips and squashes it, never moves it.
      if (name !== 'root') {
        part.x = base.x + mix('x', 0);
        part.y = base.y + mix('y', 0);
      }
      part.rotation = base.rotation + mix('rotation', 0);
      part.scale.x = base.sx * mix('sx', 1) * (name === 'root' ? facing : 1);
      part.scale.y = base.sy * mix('sy', 1);
    }
  }

  render();
  animator.add({
    target: parts,
    step(dt) {
      if (stopped) return false;
      t += dt * speed;
      if (blend < 1) blend = Math.min(1, blend + dt / 0.15);
      render();
      return true;
    },
    cancel() {
      stopped = true;
    },
  });

  return {
    get state() {
      return state;
    },
    get facing() {
      return facing;
    },
    get speed() {
      return speed;
    },
    set speed(value: number) {
      if (Number.isFinite(value)) speed = Math.max(0, Math.min(4, value));
    },
    set(next) {
      if (!RIG_STATES.includes(next) || stopped) return false;
      if (next === state) return true;
      previous = state;
      state = next;
      blend = animator.reducedMotion ? 1 : 0;
      if (next === 'hurt') t = 0;
      render();
      return true;
    },
    face(direction) {
      facing = direction === -1 ? -1 : 1;
      render();
    },
    stop() {
      stopped = true;
      for (const [name, { part, base }] of bound) {
        if (name !== 'root') {
          part.x = base.x;
          part.y = base.y;
        }
        part.rotation = base.rotation;
        part.scale.x = base.sx;
        part.scale.y = base.sy;
      }
    },
  };
}
