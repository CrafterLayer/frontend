/*
  Peeking characters for the `anim` Studio library (2026-11-05).

  `anim.peek(s, options)` draws a small character that hides behind an edge (a line, a progress
  bar, a card's top border, a dialogue box) and peeks over it: it rises on a spring until its eyes
  clear the edge, holds, ducks back quickly, and comes up again after a random 3-10 s. While up it
  blinks, breathes and glances around, or follows the pointer. Everything on the far side of the
  edge is masked, so the edge itself can be any art drawn above or below the peeker.

  The character is data, not art: ears, head shape, fur/face/eye colours, blush, whiskers and mouth
  make any original creature, and a texture (a `s.lib.peeps` face) can stand in for the drawn head.
  The pattern follows production peeks (Vellum's companion, Gumroad's dashboard mascot): eyes on
  the edge, spring up and quick duck, top or bottom edge only, a static raised peek where nothing
  ticks (editor, reduced motion). See docs/architecture/peeking-character-research.md.

  Plain code: the Pixi namespace arrives with the call (the scene `s`, `s.PIXI`, or ck.stage()'s
  `{ PIXI, app }`), like `s.lib.peeps.texture`.
*/

import type { Animator } from './tween';

export const PEEK_EARS = ['cat', 'fox', 'bear', 'bunny', 'none'] as const;
export const PEEK_SHAPES = ['round', 'wide', 'tall'] as const;
export const PEEK_MOUTHS = ['smile', 'cat', 'open', 'none'] as const;
export const PEEK_MODES = ['loop', 'up'] as const;

export type PeekEars = (typeof PEEK_EARS)[number];
export type PeekShape = (typeof PEEK_SHAPES)[number];
export type PeekMouth = (typeof PEEK_MOUTHS)[number];
export type PeekMode = (typeof PEEK_MODES)[number];

type Color = number | string;

export interface PeekCharacter {
  ears?: PeekEars;
  shape?: PeekShape;
  /** Head and ear colour. */
  fur?: Color;
  /** The face patch; the fur colour for one solid head. */
  face?: Color;
  /** Iris colour. */
  eyes?: Color;
  /** Cheeks; `false` for none. */
  blush?: Color | false;
  /** Nose, mouth and whisker ink. */
  ink?: Color;
  whiskers?: boolean;
  mouth?: PeekMouth;
}

export interface PeekOptions {
  /** The edge's centre, in the parent's coordinates. */
  x?: number;
  y?: number;
  /** Head width in px (24..600). */
  size?: number;
  /** 'top' rises over the edge; 'bottom' hangs under it, upside down. */
  side?: 'top' | 'bottom';
  /** 'loop' peeks every few seconds; 'up' stays raised (blinking, breathing). */
  mode?: PeekMode;
  /** How much of the head shows when up, 0.45..1 (the eyes always clear the edge). */
  reveal?: number;
  /** Seconds between peeks, [min, max]. */
  interval?: readonly [number, number];
  /** Seconds a peek holds before ducking. */
  hold?: number;
  /** 'pointer' follows the scene pointer; 'wander' glances around; 'none' looks ahead. */
  look?: 'pointer' | 'wander' | 'none';
  character?: PeekCharacter;
  /** A Pixi texture (e.g. `await s.lib.peeps.texture(s, …)`) drawn instead of the head. */
  texture?: unknown;
}

export interface Peeker {
  /** Add this to the stage (`s.world.addChild(p.view)`); it sits on the edge's centre. */
  readonly view: unknown;
  readonly mode: PeekMode;
  /** 0 hidden … 1 raised. */
  readonly lift: number;
  up(): void;
  down(): void;
  /** Rise now (loop mode), then carry on looping. */
  peek(): void;
  setMode(mode: PeekMode): boolean;
  blink(): void;
  /** Glance at a point in the parent's coordinates; null hands the eyes back. */
  lookAt(x: number | null, y?: number): void;
  stop(): void;
}

interface DisplayLike {
  x: number;
  y: number;
  rotation: number;
  scale: { x: number; y: number };
  addChild(...children: unknown[]): unknown;
  mask?: unknown;
}

interface GraphicsLike extends DisplayLike {
  rect(x: number, y: number, w: number, h: number): GraphicsLike;
  circle(x: number, y: number, r: number): GraphicsLike;
  ellipse(x: number, y: number, rx: number, ry: number): GraphicsLike;
  poly(points: number[]): GraphicsLike;
  moveTo(x: number, y: number): GraphicsLike;
  lineTo(x: number, y: number): GraphicsLike;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): GraphicsLike;
  fill(style: unknown): GraphicsLike;
  stroke(style: unknown): GraphicsLike;
}

interface SpriteLike extends DisplayLike {
  width: number;
  height: number;
  anchor: { set(x: number, y?: number): void };
}

interface PixiLike {
  Container: new () => DisplayLike;
  Graphics: new () => GraphicsLike;
  Sprite: new (texture: unknown) => SpriteLike;
}

interface Host {
  PIXI: PixiLike;
  random: () => number;
  pointer: { x: number; y: number } | undefined;
}

const SHAPE_RADII: Readonly<Record<PeekShape, readonly [number, number]>> = {
  round: [1, 0.92],
  wide: [1.12, 0.84],
  tall: [0.9, 1],
};

function isPixi(value: unknown): value is PixiLike {
  const v = value as Partial<PixiLike> | null;
  return (
    typeof v?.Container === 'function' &&
    typeof v.Graphics === 'function' &&
    typeof v.Sprite === 'function'
  );
}

function hostOf(value: unknown): Host {
  if (isPixi(value)) return { PIXI: value, random: Math.random, pointer: undefined };
  const host = value as { PIXI?: unknown; random?: unknown; pointer?: unknown } | null;
  if (!isPixi(host?.PIXI)) {
    throw new TypeError('anim.peek needs the scene (s), s.PIXI or { PIXI }');
  }
  const random =
    typeof host.random === 'function' ? (host.random as () => number).bind(host) : Math.random;
  // The scene pointer is a live object: keep the reference, read x/y every frame.
  const pointer = host.pointer as { x?: unknown; y?: unknown } | undefined;
  return {
    PIXI: host.PIXI,
    random,
    pointer:
      typeof pointer?.x === 'number' && typeof pointer.y === 'number'
        ? (pointer as { x: number; y: number })
        : undefined,
  };
}

function pick<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return (list as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function color(value: unknown, fallback: Color): Color {
  return typeof value === 'number' || (typeof value === 'string' && value.length <= 32)
    ? value
    : fallback;
}

function characterOf(input: PeekCharacter | undefined) {
  const c = input ?? {};
  const fur = color(c.fur, 0xf4a261);
  return {
    ears: pick(PEEK_EARS, c.ears, 'cat'),
    shape: pick(PEEK_SHAPES, c.shape, 'round'),
    fur,
    face: color(c.face, 0xfff1e0),
    eyes: color(c.eyes, 0x3d2c5e),
    blush: c.blush === false ? (false as const) : color(c.blush, 0xf08a9b),
    ink: color(c.ink, 0x2b2238),
    whiskers: c.whiskers === true,
    mouth: pick(PEEK_MOUTHS, c.mouth, 'smile'),
  };
}

type Character = ReturnType<typeof characterOf>;

interface Face {
  head: DisplayLike;
  /** Scaled on y to blink; undefined for a texture head. */
  lids: DisplayLike | undefined;
  /** Moved to look; undefined for a texture head. */
  gaze: DisplayLike | undefined;
  ears: DisplayLike | undefined;
  /** Head top (ears excluded), relative to the head's centre (negative). */
  top: number;
  bottom: number;
  /** The lowest point of the eyes, relative to the head's centre. */
  eyeLine: number;
  /** The highest point drawn (ear tips), above the head's centre (positive). */
  crown: number;
}

function drawEars(P: PixiLike, c: Character, rx: number, ry: number, r: number) {
  if (c.ears === 'none') return { ears: undefined, crown: ry };
  const ears = new P.Graphics();
  const inner = c.blush === false ? c.face : c.blush;
  let crown = ry;
  for (const side of [-1, 1]) {
    if (c.ears === 'cat' || c.ears === 'fox') {
      const tall = c.ears === 'fox' ? 1.35 : 1.12;
      ears
        .poly([side * rx * 0.95, -ry * 0.25, side * rx * 0.72, -ry * tall, side * rx * 0.2, -ry * 0.8])
        .fill({ color: c.fur });
      ears
        .poly([side * rx * 0.8, -ry * 0.45, side * rx * 0.7, -ry * (tall - 0.18), side * rx * 0.38, -ry * 0.78])
        .fill({ color: inner, alpha: 0.7 });
      crown = ry * tall;
    } else if (c.ears === 'bear') {
      ears.circle(side * rx * 0.72, -ry * 0.72, r * 0.3).fill({ color: c.fur });
      ears.circle(side * rx * 0.72, -ry * 0.72, r * 0.16).fill({ color: inner, alpha: 0.7 });
      crown = ry * 0.72 + r * 0.3;
    } else {
      ears.ellipse(side * rx * 0.36, -ry * 1.25, r * 0.19, r * 0.62).fill({ color: c.fur });
      ears.ellipse(side * rx * 0.36, -ry * 1.22, r * 0.09, r * 0.45).fill({ color: inner, alpha: 0.7 });
      crown = ry * 1.25 + r * 0.62;
    }
  }
  return { ears, crown };
}

function drawFace(P: PixiLike, input: PeekCharacter | undefined, size: number): Face {
  const c = characterOf(input);
  const r = size / 2;
  const [kx, ky] = SHAPE_RADII[c.shape];
  const rx = r * kx;
  const ry = r * ky;
  const head = new P.Container();
  const { ears, crown } = drawEars(P, c, rx, ry, r);
  if (ears !== undefined) head.addChild(ears);

  const skull = new P.Graphics().ellipse(0, 0, rx, ry).fill({ color: c.fur });
  if (c.face !== c.fur) skull.ellipse(0, ry * 0.16, rx * 0.8, ry * 0.74).fill({ color: c.face });
  head.addChild(skull);

  if (c.blush !== false) {
    const cheeks = new P.Graphics();
    for (const side of [-1, 1]) {
      cheeks
        .ellipse(side * rx * 0.56, ry * 0.36, r * 0.17, r * 0.1)
        .fill({ color: c.blush, alpha: 0.55 });
    }
    head.addChild(cheeks);
  }

  // Eyes: the lids container blinks (scale.y about the eye line), the gaze container looks.
  const eyeY = ry * 0.06;
  const lids = new P.Container();
  lids.y = eyeY;
  const gaze = new P.Container();
  const eyes = new P.Graphics();
  for (const side of [-1, 1]) {
    const ex = side * rx * 0.36;
    eyes.ellipse(ex, 0, r * 0.17, r * 0.2).fill({ color: c.eyes });
    eyes.circle(ex + r * 0.055, -r * 0.075, r * 0.065).fill({ color: 0xffffff });
    eyes.circle(ex - r * 0.06, r * 0.08, r * 0.028).fill({ color: 0xffffff, alpha: 0.85 });
  }
  gaze.addChild(eyes);
  lids.addChild(gaze);
  head.addChild(lids);

  const mouth = new P.Graphics();
  const ink = { width: Math.max(1, r * 0.035), color: c.ink, cap: 'round', join: 'round' };
  const my = ry * 0.36;
  mouth.ellipse(0, ry * 0.24, r * 0.045, r * 0.032).fill({ color: c.ink });
  if (c.mouth === 'smile') {
    mouth.moveTo(-r * 0.1, my).quadraticCurveTo(0, my + r * 0.09, r * 0.1, my).stroke(ink);
  } else if (c.mouth === 'cat') {
    mouth
      .moveTo(-r * 0.12, my)
      .quadraticCurveTo(-r * 0.06, my + r * 0.07, 0, my - r * 0.02)
      .quadraticCurveTo(r * 0.06, my + r * 0.07, r * 0.12, my)
      .stroke(ink);
  } else if (c.mouth === 'open') {
    mouth.ellipse(0, my + r * 0.03, r * 0.06, r * 0.05).fill({ color: c.ink });
  }
  if (c.whiskers) {
    for (const side of [-1, 1]) {
      for (const tilt of [-0.06, 0.05]) {
        mouth
          .moveTo(side * rx * 0.72, ry * (0.3 + tilt))
          .lineTo(side * rx * 1.12, ry * (0.26 + tilt * 2.2))
          .stroke({ ...ink, width: ink.width * 0.8 });
      }
    }
  }
  head.addChild(mouth);
  return { head, lids, gaze, ears, top: -ry, bottom: ry, eyeLine: eyeY + r * 0.2, crown };
}

function textureFace(P: PixiLike, texture: unknown, size: number): Face {
  const head = new P.Container();
  const sprite = new P.Sprite(texture);
  sprite.anchor.set(0.5);
  const aspect = sprite.width > 0 ? sprite.height / sprite.width : 1;
  sprite.width = size;
  sprite.height = size * aspect;
  head.addChild(sprite);
  const half = (size * aspect) / 2;
  return {
    head,
    lids: undefined,
    gaze: undefined,
    ears: undefined,
    top: -half,
    bottom: half,
    eyeLine: 0,
    crown: half,
  };
}

export function createPeeker(
  animator: Animator,
  target: unknown,
  // Authored scene code is plain JavaScript: options may be missing or malformed.
  input: PeekOptions | null | undefined = {},
): Peeker {
  const host = hostOf(target);
  const P = host.PIXI;
  const options = input ?? {};
  const size = num(options.size, 120, 24, 600);
  const side = options.side === 'bottom' ? 'bottom' : 'top';
  let mode: PeekMode = pick(PEEK_MODES, options.mode, 'loop');
  const reveal = num(options.reveal, 0.8, 0.45, 1);
  const range: readonly unknown[] = Array.isArray(options.interval) ? options.interval : [];
  const minWait = num(range[0], 3, 0.5, 60);
  const maxWait = Math.max(minWait, num(range[1], 10, 0.5, 120));
  const hold = num(options.hold, 1.6, 0.2, 30);
  const look = options.look === 'none' || options.look === 'pointer' ? options.look : 'wander';

  const face =
    options.texture !== undefined && options.texture !== null
      ? textureFace(P, options.texture, size)
      : drawFace(P, options.character, size);

  // view sits on the edge's centre (y = 0 is the edge); the mask hides the far side of the edge.
  const view = new P.Container();
  view.x = num(options.x, 0, -1e6, 1e6);
  view.y = num(options.y, 0, -1e6, 1e6);
  if (side === 'bottom') view.rotation = Math.PI;
  const rig = new P.Container();
  rig.addChild(face.head);
  const reach = face.crown + size;
  const mask = new P.Graphics()
    .rect(-size * 1.2, -reach, size * 2.4, reach)
    .fill({ color: 0xffffff });
  view.addChild(mask, rig);
  rig.mask = mask;

  // rig.y is the head centre's offset from the edge. Lift 0 tucks even the ear tips under it;
  // lift 1 shows `reveal` of the head, and never less than the eyes plus a margin.
  const height = face.bottom - face.top;
  const hiddenY = face.crown + size * 0.06;
  const shownY = Math.min(-face.top - reveal * height, -face.eyeLine - size * 0.04);
  const yAt = (l: number) => hiddenY + (shownY - hiddenY) * l;

  // Starting raised keeps the character visible where nothing ticks (editor, reduced motion).
  let lift = 1;
  let velocity = 0;
  let goal = 1;
  let phase: 'hold' | 'down' | 'wait' | 'up' = 'hold';
  let timer = hold;
  let t = 0;
  let blinkIn = 1.5 + host.random() * 2.5;
  let blinkT = -1;
  let glanceIn = 1 + host.random() * 2;
  let glance = { x: 0, y: 0 };
  let gazeNow = { x: 0, y: 0 };
  let manualLook: { x: number; y: number } | null = null;
  let stopped = false;

  const wait = () => minWait + host.random() * (maxWait - minWait);

  function gazeToward(x: number, y: number): { x: number; y: number } {
    const max = size * 0.06;
    const dx = x - view.x;
    const dy = y - (view.y + rig.y);
    const d = Math.max(1, Math.hypot(dx, dy));
    const sign = side === 'bottom' ? -1 : 1;
    return { x: (dx / d) * max * sign, y: (dy / d) * max * 0.6 * sign };
  }

  function render(): void {
    rig.y = yAt(lift);
    // Breathing while up; a little stretch on the way up and squash on the way down.
    const breath = Math.sin(t * 2.1) * 0.012 * lift;
    const stretch = Math.max(-0.06, Math.min(0.06, velocity * 0.01));
    face.head.scale.y = 1 + breath + stretch;
    face.head.scale.x = 1 - breath * 0.5 - stretch * 0.5;
    if (face.lids !== undefined) {
      const closed = blinkT >= 0 ? Math.sin(Math.min(1, blinkT / 0.14) * Math.PI) : 0;
      face.lids.scale.y = 1 - closed * 0.9;
    }
    if (face.gaze !== undefined) {
      face.gaze.x = gazeNow.x;
      face.gaze.y = gazeNow.y;
    }
    // A rare ear twitch: a short shiver when a slow sine peaks.
    if (face.ears !== undefined) {
      face.ears.rotation = Math.sin(t * 0.7) > 0.985 ? Math.sin(t * 40) * 0.03 : 0;
    }
  }

  function aim(dt: number): void {
    const max = size * 0.06;
    let want = { x: 0, y: 0 };
    if (manualLook !== null) want = manualLook;
    else if (look === 'pointer' && host.pointer !== undefined) {
      want = gazeToward(host.pointer.x, host.pointer.y);
    } else if (look === 'wander') {
      glanceIn -= dt;
      if (glanceIn <= 0) {
        glanceIn = 1.2 + host.random() * 2.6;
        glance =
          host.random() < 0.35
            ? { x: 0, y: 0 }
            : { x: (host.random() * 2 - 1) * max, y: (host.random() * 2 - 1) * max * 0.5 };
      }
      want = glance;
    }
    const k = Math.min(1, dt * 14);
    gazeNow = { x: gazeNow.x + (want.x - gazeNow.x) * k, y: gazeNow.y + (want.y - gazeNow.y) * k };
  }

  function advance(dt: number): void {
    if (mode === 'up') {
      goal = 1;
    } else {
      timer -= dt;
      if (phase === 'hold' && timer <= 0) {
        phase = 'down';
        goal = 0;
      } else if (phase === 'down' && lift <= 0.02) {
        phase = 'wait';
        timer = wait();
      } else if (phase === 'wait' && timer <= 0) {
        phase = 'up';
        goal = 1;
      } else if (phase === 'up' && lift >= 0.96) {
        phase = 'hold';
        timer = hold;
      }
    }
    // Spring up with a little overshoot; duck fast and flat.
    const rising = goal > lift;
    const stiffness = rising ? 120 : 260;
    const damping = rising ? 11 : 34;
    velocity += (stiffness * (goal - lift) - damping * velocity) * dt;
    lift = Math.max(-0.05, Math.min(1.12, lift + velocity * dt));
  }

  render();
  animator.add({
    target: view,
    step(dt) {
      if (stopped) return false;
      // Long frames run as short sub-steps so the spring stays stable and no time is lost; a
      // frame after a hidden tab counts as half a second at most.
      let rest = Math.min(Math.max(0, dt), 0.5);
      while (rest > 0) {
        const step = Math.min(rest, 1 / 30);
        rest -= step;
        t += step;
        advance(step);
        if (lift > 0.3) {
          blinkIn -= step;
          if (blinkIn <= 0 && blinkT < 0) {
            blinkT = 0;
            // One in five blinks comes back quickly as a double blink.
            blinkIn = host.random() < 0.2 ? 0.25 : 2.6 + host.random() * 2.6;
          }
        }
        if (blinkT >= 0) {
          blinkT += step;
          if (blinkT > 0.14) blinkT = -1;
        }
        aim(step);
      }
      render();
      return true;
    },
    cancel() {
      stopped = true;
    },
  });

  // Where nothing ticks, a call lands on its end state at once.
  const settle = () => {
    if (!animator.reducedMotion) return;
    lift = goal;
    velocity = 0;
    render();
  };

  return {
    view,
    get mode() {
      return mode;
    },
    get lift() {
      return lift;
    },
    up() {
      goal = 1;
      phase = 'up';
      settle();
    },
    down() {
      goal = 0;
      phase = 'down';
      settle();
    },
    peek() {
      if (mode !== 'loop') return;
      phase = 'up';
      goal = 1;
      settle();
    },
    setMode(next) {
      if (!(PEEK_MODES as readonly unknown[]).includes(next)) return false;
      mode = next;
      if (next === 'loop') {
        phase = 'hold';
        timer = hold;
      }
      return true;
    },
    blink() {
      blinkT = 0;
    },
    lookAt(x, y) {
      if (typeof x !== 'number' || typeof y !== 'number') {
        manualLook = null;
        return;
      }
      manualLook = gazeToward(x, y);
      if (animator.reducedMotion) {
        gazeNow = manualLook;
        render();
      }
    },
    stop() {
      stopped = true;
    },
  };
}
