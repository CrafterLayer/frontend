/*
  Two CraftKit behaviours for the vendored particle emitter (particles and physics, 2026-10-13).
  emitter-entry.ts registers them with upstream's own `Emitter.registerBehavior`, so the vendored
  files stay exactly as fetched and a hand-written config may use them too:

  - `colorPick` { colors, wave? }: each particle (or each wave, for a fireworks burst) takes one
    colour from the list — confetti in the palette's colours. Upstream only has one static colour
    or one gradient for all.
  - `drift` { sway?, freq?, flip?, spin?, drag?, top?, bottom? }: what weather needs and
    upstream's movement lacks — a sideways sway (px), a paper flutter (scale.x, rad/s), a spin
    from a random start angle (deg/s), air drag on the velocity (per second), and kill lines: a
    particle past `bottom` or above `top` is recycled at once instead of living out its life off
    screen. It runs after upstream's movement (order 6 > BehaviorOrder.Late).
*/

const TAU = Math.PI * 2;

/** The slice of the vendored Particle these behaviours touch. */
export interface BehaviorParticle {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  tint: number;
  age: number;
  next?: BehaviorParticle | undefined;
  config: { velocity?: { x: number; y: number }; phase?: number; spin?: number };
}

export interface ColorPickConfig {
  colors: readonly number[];
  /** One colour per wave instead of per particle. */
  wave?: boolean;
}

// Fields are `declare`d and assigned in the constructor: no define-property helper per field in
// the minified asset (its gzip budget counts every byte).
export class ColorPickBehavior {
  static readonly type = 'colorPick';
  declare readonly order: number;
  declare readonly colors: readonly number[];
  declare readonly wave: boolean;

  constructor(config: ColorPickConfig) {
    this.order = 2;
    this.colors = config.colors.length > 0 ? config.colors : [0xffffff];
    this.wave = config.wave === true;
  }

  initParticles(first: BehaviorParticle): void {
    const { colors } = this;
    const pick = (): number => colors[Math.floor(Math.random() * colors.length)] ?? 0xffffff;
    const one = pick();
    for (let p: BehaviorParticle | undefined = first; p; p = p.next)
      p.tint = this.wave ? one : pick();
  }
}

export interface DriftConfig {
  /** Sideways sway amplitude (px). */
  sway?: number;
  /** Sway speed (rad/s, default 1.5). */
  freq?: number;
  /** Flutter: scale.x follows cos(age * flip) (rad/s). */
  flip?: number;
  /** Spin up to ± this (deg/s), from a random start angle. */
  spin?: number;
  /** Air drag on the velocity (per second). */
  drag?: number;
  /** Kill lines: recycle a particle above `top` or below `bottom`. */
  top?: number;
  bottom?: number;
}

export class DriftBehavior {
  static readonly type = 'drift';
  declare readonly order: number;
  declare sway: number;
  declare freq: number;
  declare flip: number;
  declare spin: number;
  declare drag: number;
  declare top: number;
  declare bottom: number;

  constructor(config: DriftConfig) {
    this.order = 6;
    this.sway = config.sway ?? 0;
    this.freq = config.freq ?? 1.5;
    this.flip = config.flip ?? 0;
    this.spin = ((config.spin ?? 0) * Math.PI) / 180;
    this.drag = config.drag ?? 0;
    this.top = config.top ?? -Infinity;
    this.bottom = config.bottom ?? Infinity;
  }

  initParticles(first: BehaviorParticle): void {
    for (let p: BehaviorParticle | undefined = first; p; p = p.next) {
      p.config.phase = Math.random() * TAU;
      if (this.spin !== 0) {
        p.config.spin = (Math.random() * 2 - 1) * this.spin;
        p.rotation = Math.random() * TAU;
      }
    }
  }

  /** True recycles the particle (upstream's contract). */
  updateParticle(p: BehaviorParticle, dt: number): boolean {
    const phase = p.config.phase ?? 0;
    if (this.sway !== 0) p.x += Math.cos(p.age * this.freq + phase) * this.sway * this.freq * dt;
    if (this.spin !== 0) p.rotation += (p.config.spin ?? 0) * dt;
    if (this.flip !== 0) p.scaleX = p.scaleY * Math.cos(p.age * this.flip + phase);
    const velocity = p.config.velocity;
    if (this.drag !== 0 && velocity !== undefined) {
      const keep = Math.exp(-this.drag * dt);
      velocity.x *= keep;
      velocity.y *= keep;
    }
    return p.y > this.bottom || p.y < this.top;
  }
}
