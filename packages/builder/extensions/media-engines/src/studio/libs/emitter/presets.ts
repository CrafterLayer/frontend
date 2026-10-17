/*
  Recipe → upstream EmitterConfigV3 for one scene (particles and physics, 2026-10-13). Pure: the
  scene's textures, palette, direction, view and particle budget come in as `PresetEnv`, so the
  unit tests read the configs without a GPU. spawn.ts adds the lifecycle (container, ticking,
  reduced motion, resize, disposal).

  Placement: omit x/y and a preset fills the view of s.world (and follows its resizes); give x/y
  and it anchors there — falling presets fall from y, rising ones rise from y, fire burns at x,y
  across `width`, area presets fill a width × height box centred on x,y. Recipe defaults: w/h
  400, alpha [1], dir 0, spread 180, sway speed 1.5 rad/s.
*/

import { CELL, type ParticleShape } from './atlas';
import { PARTICLE_PRESETS, RECIPES, type Recipe, type RecipePalette } from './recipes';

export interface ParticleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What `presets.<name>(s, options)`, `spawn` and `burst` accept. */
export interface ParticleOptions {
  /** The anchor in the parent's units; omit both to fill the view (and follow resizes). */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** One colour or a list (0xRRGGBB or '#rrggbb'); default: the preset's theme-aware colours. */
  color?: number | string;
  colors?: readonly (number | string)[];
  /** Rate and count multiplier, 0..3 (default 1). */
  intensity?: number;
  /** Particle size multiplier (default 1). */
  size?: number;
  /** Speed multiplier (default 1). */
  speed?: number;
  /** Lean toward the inline end, -1..1 (mirrors in RTL); default: the preset's own. */
  wind?: number;
  /** Particles in a burst (default: the preset's). */
  count?: number;
  /** The container the particles go in (default s.world). */
  parent?: unknown;
}

/** The scene, as the builder reads it. */
export interface PresetEnv {
  readonly textures: Readonly<Record<ParticleShape, unknown>>;
  readonly palette: RecipePalette;
  readonly dir: 1 | -1;
  /** The visible part of the parent (s.design.view in design mode, else the region). */
  readonly view: ParticleRect;
  /** Particle budget multiplier: s.count density × quality, halved in the editor. */
  readonly budget: number;
}

export interface BehaviorEntry {
  type: string;
  config: Record<string, unknown>;
}

/** Upstream's EmitterConfigV3, as the presets fill it. */
export interface PresetConfig {
  lifetime: { min: number; max: number };
  frequency: number;
  particlesPerWave: number;
  maxParticles: number;
  emit: boolean;
  pos: { x: number; y: number };
  behaviors: BehaviorEntry[];
}

export interface BuiltPreset {
  readonly config: PresetConfig;
  /** Blend additively (a glowing preset on a dark surface). */
  readonly glow: boolean;
  /** Fireworks: a burst every [a, b] s inside `area`. */
  readonly show: readonly [number, number] | undefined;
  readonly area: ParticleRect;
  /** No x/y given: the preset follows the view on resize. */
  readonly auto: boolean;
  /** Seconds to pre-run so a stream starts full (0 for bursts and shows). */
  readonly prewarm: number;
  /** move(x, y) moves the emitter itself (point presets, bursts) rather than its area (a show's too). */
  readonly point: boolean;
}

const MAX_PARTICLES = 1200;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 0xRRGGBB from a number or '#rgb' / '#rrggbb'; anything else reads as white. */
export function colorNumber(color: number | string): number {
  if (typeof color === 'number') return color;
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex.replace(/./gu, '$&$&');
  const value = Number.parseInt(hex, 16);
  return hex.length === 6 && Number.isFinite(value) ? value : 0xffffff;
}

function keyframes(
  values: readonly number[],
  scale = 1,
): { list: { value: number; time: number }[] } {
  const last = Math.max(1, values.length - 1);
  return { list: values.map((value, index) => ({ value: value * scale, time: index / last })) };
}

function entry(type: string, config: Record<string, unknown>): BehaviorEntry {
  return { type, config };
}

export function buildPreset(
  name: string,
  options: ParticleOptions,
  env: PresetEnv,
  once = false,
): BuiltPreset {
  const r = (RECIPES as Record<string, Recipe | undefined>)[name];
  if (r === undefined) {
    throw new TypeError(`emitter: no preset "${name}" (${PARTICLE_PRESETS.join(', ')})`);
  }
  const o = options;
  const view = env.view;
  const auto = o.x === undefined && o.y === undefined;
  const point = r.place === 'point';
  const fills = auto && !point;
  const w = Math.max(1, o.width ?? (fills ? view.width : (r.w ?? 400)));
  const h = Math.max(1, o.height ?? (fills ? view.height : (r.h ?? 400)));
  const x = o.x ?? view.x + view.width / 2;
  const y = o.y ?? view.y + view.height * (point ? 0.9 : 0.5);
  const area: ParticleRect = fills
    ? { ...view }
    : {
        x: x - w / 2,
        y: r.place === 'fall' ? y : r.place === 'rise' ? y - h : y - h / 2,
        width: w,
        height: h,
      };
  const size = o.size ?? 1;
  const speed = o.speed ?? 1;
  const burst = r.burst;
  const blast = once || r.show !== undefined;
  const v0 = (blast ? burst.v[0] : r.v[0]) * speed;
  const v1 = (blast ? burst.v[1] : r.v[1]) * speed;
  // Wind turns the direction toward the inline end: clockwise for a fall, anticlockwise for a rise.
  const wind = clamp(o.wind ?? r.wind ?? 0, -1, 1) * env.dir;
  const base = r.dir ?? 0;
  const dir = blast ? (burst.dir ?? 0) : base + (base < 180 ? -40 : 40) * wind;
  const spread = blast ? (burst.spread ?? 180) : (r.spread ?? 180);
  const radians = (dir * Math.PI) / 180;
  const intensity = clamp(o.intensity ?? 1, 0.05, 3);
  const reach = r.size[1] * size * 1.5 + 10;

  let life = (blast ? burst.life : undefined) ?? r.life ?? [1, 1];
  let rate = r.rate * intensity * env.budget;
  let rect = { x: area.x, y: area.y, w: area.width, h: area.height };
  let top: number | undefined;
  let bottom: number | undefined;
  if (point && !blast) {
    rect = { x: -w / 2, y: -h / 2, w, h };
    rate *= clamp(w / (r.w ?? w), 0.5, 3);
  } else if (r.place === 'area') {
    rate *= Math.max(0.15, Math.sqrt((area.width * area.height) / 600_000));
  } else if (!blast) {
    // fall / rise: a band just outside the edge, widened upwind so a slant still covers the area.
    const cross = r.life === undefined;
    const margin = cross ? reach : 0;
    const travel = area.height + 2 * reach;
    const sin = Math.max(0.2, Math.abs(Math.sin(radians)));
    const drift = (travel * Math.cos(radians)) / sin;
    const sway = r.sway ?? 0;
    rect = {
      x: area.x - Math.max(0, drift) - sway,
      y: r.place === 'fall' ? area.y - margin : area.y + area.height + margin,
      w: area.width + Math.abs(drift) + 2 * sway,
      h: 1,
    };
    rate *= Math.max(0.1, rect.w / 1000);
    if (cross) {
      life = [travel / (v1 * sin), (travel / (v0 * sin)) * 1.05];
      if (r.place === 'fall') bottom = area.y + area.height + reach;
      else top = area.y - reach;
    }
  }

  const count = Math.max(1, Math.round((o.count ?? burst.n) * (once ? intensity : 1)));
  const given = o.colors ?? (o.color === undefined ? [] : [o.color]);
  const colors = given.length === 0 ? r.colors(env.palette) : given.map(colorNumber);
  const s0 = (r.size[0] * size) / CELL;
  const s1 = (r.size[1] * size) / CELL;
  const a = r.alpha ?? [1];
  // A burst of a constant-alpha preset still fades out at the end of its life.
  const alpha = blast && a.length === 1 ? [a[0] ?? 1, a[0] ?? 1, 0] : a;
  const gravity = (blast ? burst.g : r.g) ?? 0;
  const shapes = r.shape.map((shape) => env.textures[shape]);
  const lifeMax = Math.max(0.05, life[1]);
  const perSecond = Math.max(0.05, rate);

  const config: PresetConfig = {
    lifetime: { min: clamp(life[0], 0.05, lifeMax), max: lifeMax },
    frequency: blast ? 1 : 1 / perSecond,
    particlesPerWave: blast ? count : 1,
    maxParticles: Math.min(
      MAX_PARTICLES,
      blast ? count * (once ? 1 : 4) : Math.ceil(perSecond * lifeMax * 1.1) + 4,
    ),
    emit: !blast,
    pos: blast || point ? { x, y } : { x: 0, y: 0 },
    behaviors: [
      shapes.length === 1
        ? entry('textureSingle', { texture: shapes[0] })
        : entry('textureRandom', { textures: shapes }),
      entry(
        'spawnShape',
        blast
          ? { type: 'torus', data: { x: 0, y: 0, radius: Math.max(1, (o.width ?? 8) / 2) } }
          : { type: 'rect', data: rect },
      ),
      entry('rotationStatic', { min: dir - spread, max: dir + spread }),
      gravity === 0
        ? entry('moveSpeedStatic', { min: v0, max: v1 })
        : entry('moveAcceleration', {
            minStart: v0,
            maxStart: v1,
            accel: { x: 0, y: gravity },
            rotate: r.align === true,
          }),
      r.grow === undefined
        ? entry('scaleStatic', { min: s0, max: s1 })
        : entry('scale', { scale: keyframes(r.grow, s1), minMult: s0 / s1 }),
      alpha.length === 1
        ? entry('alphaStatic', { alpha: alpha[0] })
        : entry('alpha', { alpha: keyframes(alpha) }),
      r.gradient === true && colors.length > 1
        ? entry('color', {
            color: {
              list: keyframes(colors).list.map((key) => ({
                time: key.time,
                value: `#${key.value.toString(16).padStart(6, '0')}`,
              })),
            },
          })
        : entry('colorPick', { colors, wave: r.wave === true }),
      entry('drift', {
        sway: r.sway,
        freq: r.freq,
        flip: r.flip,
        spin: r.align === true ? 0 : r.spin,
        drag: blast ? burst.drag : 0,
        top,
        bottom,
      }),
    ],
  };
  return {
    config,
    glow: r.glow === true && env.palette.dark,
    show: once ? undefined : r.show,
    area,
    auto,
    prewarm: blast ? 0 : lifeMax,
    point: point || once,
  };
}
