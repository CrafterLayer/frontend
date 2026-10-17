/*
  The mural kit's shared shapes (mural kit, 2026-10-14). Structural, like the other plain
  libraries: the kit draws with the scene's own Pixi namespace (s.PIXI) and animates through the
  scene's s.lib.anim, so nothing here imports pixi.js or the anim library.
*/

export type Time = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';
export type Depth = 'sky' | 'far' | 'mid' | 'near' | 'front';

/** A Pixi display object, as much of one as the kit touches. */
export interface View {
  x: number;
  y: number;
  alpha: number;
  rotation: number;
  visible: boolean;
  tint: number;
  blendMode: string;
  scale: { x: number; y: number; set(x: number, y?: number): void };
  position: { x: number; y: number; set(x: number, y?: number): void };
  pivot?: { x: number; y: number };
  parent: unknown;
  destroyed?: boolean;
  destroy(options?: unknown): void;
}

export interface Box extends View {
  addChild<T>(child: T): T;
  readonly children: readonly unknown[];
}

/** Pixi v8 Graphics: every call returns the same Graphics. */
export interface Gfx extends Box {
  rect(x: number, y: number, w: number, h: number): Gfx;
  roundRect(x: number, y: number, w: number, h: number, r: number): Gfx;
  circle(x: number, y: number, r: number): Gfx;
  ellipse(x: number, y: number, rx: number, ry: number): Gfx;
  poly(points: number[], close?: boolean): Gfx;
  star(x: number, y: number, points: number, radius: number, inner?: number): Gfx;
  moveTo(x: number, y: number): Gfx;
  lineTo(x: number, y: number): Gfx;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): Gfx;
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number): Gfx;
  arc(x: number, y: number, r: number, start: number, end: number, ccw?: boolean): Gfx;
  closePath(): Gfx;
  fill(style: unknown): Gfx;
  stroke(style: unknown): Gfx;
}

export interface MuralPixi {
  Container: new () => Box;
  Graphics: new () => Gfx;
  Sprite?: new (texture?: unknown) => Box & { anchor?: { set(x: number, y?: number): void } };
  FillGradient?: new (options: unknown) => { destroy(): void };
  Texture?: { EMPTY?: unknown };
}

/** The resolved colours an item paints with (0xRRGGBB). */
export interface Palette {
  land: [number, number, number];
  water: [number, number];
  leaf: [number, number];
  trunk: number;
  wall: number;
  roof: number;
  stone: number;
  wood: number;
  ink: number;
  skin: number;
  cloth: [number, number, number];
  accent: number;
  light: number;
  snow: number;
  sand: number;
  bloom: number;
  sky: Record<Time, [number, number]>;
}

/** What every primitive draws with: the layer's containers, colours, seed and budgets. */
export interface Ctx {
  P: MuralPixi;
  /** The item's art (tinted with the time of day) and its lights (never tinted). */
  art: Box;
  glow: Box;
  pal: Palette;
  /** A palette colour with the layer's atmospheric fade applied. */
  c: (color: number) => number;
  mix: (a: number, b: number, t: number) => number;
  /** Seeded 0..1 (each item has its own stream). */
  r: () => number;
  /** A detail count scaled by the scene's quality and density. */
  n: (count: number) => number;
  /** Panorama span this layer shows (design units), and its depth. */
  span: number;
  depth: Depth;
  /** An Open Peeps head as a sprite, when s.lib.peeps is loaded. */
  peep?: (seed: string, size: number) => Box | undefined;
  /** Gradient fills to destroy with the mural. */
  fills: { destroy(): void }[];
}

/** Item options as a spec writes them (validated by the registry). */
export interface ItemOpts {
  x: number;
  y: number;
  size: number;
  /** Wide items: the range they cover in layer units. */
  from: number;
  to: number;
  kind: string;
  color?: number;
  colors?: number[];
  count: number;
  seed: number;
  /** Item-specific flags (snow caps, lit windows, sails…). */
  flag: Record<string, unknown>;
}

/** What a primitive hands back. */
export interface Drawn {
  view: Box;
  /** Rig parts (root, body, head, armL, armR, legL, legR, tail) for s.lib.anim. */
  rig?: Record<string, unknown>;
  /** The state the rig rests in ('idle', 'run' for wings, 'walk' for a fish's tail). */
  rest?: string;
  /** Lit marks that turn on at dusk (windows, lanterns): alpha 0..1. */
  lights?: View[];
  /** Night-sky marks (stars, moon, aurora) that follow the time of day. */
  night?: View[];
  /** A sun that sets and rises with the time of day. */
  sun?: View;
  /** Gentle motion: T seconds since start. */
  ambient?: (T: number) => void;
  /** Wheels and the like, turned by the distance the item moved. */
  roll?: (dx: number) => void;
  /** Lights inside the glow layer that must follow the item's transform. */
  follow?: Box;
}

export type Primitive = (ctx: Ctx, o: ItemOpts) => Drawn;
