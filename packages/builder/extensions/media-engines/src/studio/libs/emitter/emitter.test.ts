import { Container, ParticleContainer, Rectangle, Texture } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';

import { buildScenePalette } from '../../kit/palette-oklab';
import { createEmitterLibrary } from '../emitter-entry';
import { CELL, drawParticleAtlas, PARTICLE_SHAPES, type AtlasPixi } from './atlas';
import { ColorPickBehavior, DriftBehavior, type BehaviorParticle } from './behaviors';
import { buildPreset, colorNumber, type PresetEnv } from './presets';
import { PARTICLE_PRESETS } from './recipes';
import type { ParticleHandle } from './spawn';

/*
  particles and physics (2026-10-13): the emitter presets. The pure builder is read without a GPU;
  spawn/burst run the real vendored Emitter on real Pixi ParticleContainers (jsdom has no WebGL,
  so the atlas is drawn into a recording Graphics and the renderer is a stand-in). The generated
  runtime draws them for real in apps/evals (particles.browser.test.ts).
*/

const DARK = buildScenePalette({ surface: 0x0f172a, text: 0xf1f5f9, accent: 0x67e8f9 });
const LIGHT = buildScenePalette({ surface: 0xffffff, text: 0x0f172a, accent: 0x2563eb });
const TEXTURES = Object.fromEntries(PARTICLE_SHAPES.map((shape) => [shape, { shape }])) as never;
const VIEW = { x: 0, y: 0, width: 1280, height: 720 };

function env(overrides: Partial<PresetEnv> = {}): PresetEnv {
  return { textures: TEXTURES, palette: DARK, dir: 1, view: VIEW, budget: 1, ...overrides };
}

function behavior(
  config: { behaviors: { type: string; config: Record<string, unknown> }[] },
  type: string,
) {
  return config.behaviors.find((entry) => entry.type === type)?.config;
}

/** The upstream behaviour types plus CraftKit's two. */
const KNOWN = new Set([
  'textureSingle',
  'textureRandom',
  'spawnShape',
  'rotationStatic',
  'moveSpeedStatic',
  'moveAcceleration',
  'scaleStatic',
  'scale',
  'alphaStatic',
  'alpha',
  'color',
  'colorPick',
  'drift',
]);

describe('emitter presets: the pure builder', () => {
  it.each(PARTICLE_PRESETS)('%s builds a sound stream and burst config', (name) => {
    for (const once of [false, true]) {
      const { config } = buildPreset(name, {}, env(), once);
      for (const entry of config.behaviors) expect(KNOWN.has(entry.type)).toBe(true);
      expect(config.lifetime.min).toBeGreaterThan(0);
      expect(config.lifetime.max).toBeGreaterThanOrEqual(config.lifetime.min);
      expect(config.frequency).toBeGreaterThan(0);
      expect(config.maxParticles).toBeGreaterThan(0);
      expect(config.maxParticles).toBeLessThanOrEqual(1200);
      expect(behavior(config, 'drift')).toBeDefined();
      expect(JSON.stringify(config)).not.toMatch(/null|NaN/u);
    }
  });

  it('fills the view without x/y: snow falls from just above it and dies just below it', () => {
    const built = buildPreset('snow', {}, env());
    expect(built.auto).toBe(true);
    expect(built.area).toEqual(VIEW);
    const rect = behavior(built.config, 'spawnShape')?.['data'] as {
      x: number;
      y: number;
      w: number;
    };
    expect(rect.y).toBeLessThan(0);
    expect(rect.w).toBeGreaterThan(1280);
    expect(behavior(built.config, 'drift')?.['bottom']).toBeGreaterThan(720);
    // Pre-warmed long enough for the slowest flake to cross the whole view.
    expect(built.prewarm).toBe(built.config.lifetime.max);
    expect(built.config.lifetime.max * 35).toBeGreaterThan(720);
  });

  it('anchors at x/y: fire burns at the point, snow falls from y over a width × height box', () => {
    const fire = buildPreset('fire', { x: 200, y: 500, width: 120 }, env());
    expect(fire.config.pos).toEqual({ x: 200, y: 500 });
    expect(fire.point).toBe(true);
    expect((behavior(fire.config, 'spawnShape')?.['data'] as { w: number }).w).toBe(120);
    const snow = buildPreset('snow', { x: 300, y: 100, width: 200, height: 160 }, env());
    expect(snow.auto).toBe(false);
    expect(snow.area).toEqual({ x: 200, y: 100, width: 200, height: 160 });
    expect(behavior(snow.config, 'drift')?.['bottom']).toBeGreaterThan(260);
    expect(behavior(snow.config, 'drift')?.['bottom']).toBeLessThan(320);
  });

  it('mirrors wind and slant with s.dir', () => {
    const ltr = behavior(buildPreset('rain', {}, env()).config, 'rotationStatic');
    const rtl = behavior(buildPreset('rain', {}, env({ dir: -1 })).config, 'rotationStatic');
    const centre = (range: Record<string, unknown> | undefined): number =>
      ((range?.['min'] as number) + (range?.['max'] as number)) / 2;
    expect(centre(ltr)).toBeLessThan(90);
    expect(centre(rtl)).toBeGreaterThan(90);
    expect(centre(ltr) + centre(rtl)).toBeCloseTo(180, 6);
    // Rising smoke leans toward the inline end too.
    const smoke = (dir: 1 | -1): number =>
      centre(behavior(buildPreset('smoke', {}, env({ dir })).config, 'rotationStatic'));
    expect(smoke(1)).toBeGreaterThan(270);
    expect(smoke(-1)).toBeLessThan(270);
    // An explicit wind of 0 falls straight.
    expect(centre(behavior(buildPreset('rain', { wind: 0 }, env()).config, 'rotationStatic'))).toBe(
      90,
    );
  });

  it('reads the theme: visible snow on light pages, additive glow only on dark ones', () => {
    const dark = buildPreset('snow', {}, env());
    const light = buildPreset('snow', {}, env({ palette: LIGHT }));
    expect(behavior(dark.config, 'colorPick')?.['colors']).toContain(0xffffff);
    expect(behavior(light.config, 'colorPick')?.['colors']).not.toContain(0xffffff);
    expect(buildPreset('sparkles', {}, env()).glow).toBe(true);
    expect(buildPreset('sparkles', {}, env({ palette: LIGHT })).glow).toBe(false);
    expect(buildPreset('confetti', {}, env()).config.behaviors).toContainEqual({
      type: 'colorPick',
      config: { colors: expect.arrayContaining([DARK.accent]) as unknown, wave: false },
    });
  });

  it('takes explicit colours and turns gradients into upstream colour lists', () => {
    expect(behavior(buildPreset('sparkles', { color: '#f00' }, env()).config, 'colorPick')).toEqual(
      {
        colors: [0xff0000],
        wave: false,
      },
    );
    const fire = behavior(
      buildPreset('fire', { colors: [0x112233, '#445566'] }, env()).config,
      'color',
    );
    expect(fire).toEqual({
      color: {
        list: [
          { time: 0, value: '#112233' },
          { time: 1, value: '#445566' },
        ],
      },
    });
    expect(colorNumber('#abc')).toBe(0xaabbcc);
    expect(colorNumber('nope')).toBe(0xffffff);
  });

  it('scales the particle budget: editor and density halve it, intensity raises it', () => {
    const full = buildPreset('rain', {}, env()).config;
    const editor = buildPreset('rain', {}, env({ budget: 0.5 })).config;
    const strong = buildPreset('rain', { intensity: 2 }, env()).config;
    expect(editor.frequency).toBeCloseTo(full.frequency * 2, 6);
    expect(editor.maxParticles).toBeLessThan(full.maxParticles);
    expect(strong.frequency).toBeCloseTo(full.frequency / 2, 6);
    // A wider area gets more particles per second, a phone fewer.
    const phone = buildPreset('rain', {}, env({ view: { x: 0, y: 0, width: 390, height: 720 } }));
    expect(phone.config.frequency).toBeGreaterThan(full.frequency);
  });

  it('builds a burst: one wave of `count`, all around or in its cone, fading out', () => {
    const { config, point, prewarm } = buildPreset(
      'confetti',
      { x: 100, y: 200, count: 40 },
      env(),
      true,
    );
    expect(config.emit).toBe(false);
    expect(config.particlesPerWave).toBe(40);
    expect(config.maxParticles).toBe(40);
    expect(config.pos).toEqual({ x: 100, y: 200 });
    expect(point).toBe(true);
    expect(prewarm).toBe(0);
    expect(behavior(config, 'rotationStatic')).toEqual({ min: 270 - 32, max: 270 + 32 });
    expect(behavior(config, 'alpha')).toEqual({
      alpha: {
        list: [
          { value: 1, time: 0 },
          { value: 1, time: 0.5 },
          { value: 0, time: 1 },
        ],
      },
    });
    expect(behavior(config, 'drift')?.['drag']).toBeGreaterThan(0);
    // Fireworks pick one colour per burst.
    expect(behavior(buildPreset('fireworks', {}, env(), true).config, 'colorPick')?.['wave']).toBe(
      true,
    );
  });

  it('refuses an unknown preset by naming the real ones', () => {
    expect(() => buildPreset('lava', {}, env())).toThrow(/no preset "lava" \(fire, smoke/u);
  });
});

describe('emitter presets: the CraftKit behaviours', () => {
  function chain(count: number): BehaviorParticle[] {
    const particles = Array.from({ length: count }, () => ({
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      tint: 0,
      age: 0,
      config: {},
    })) as BehaviorParticle[];
    particles.forEach((p, i) => {
      p.next = particles[i + 1];
    });
    return particles;
  }

  it('colorPick tints each particle, or each wave with one colour', () => {
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValueOnce(0).mockReturnValueOnce(0.99).mockReturnValueOnce(0.5);
    const particles = chain(2);
    new ColorPickBehavior({ colors: [1, 2, 3] }).initParticles(particles[0]!);
    expect(particles.map((p) => p.tint)).toEqual([3, 2]);
    random.mockRestore();
    const wave = chain(3);
    new ColorPickBehavior({ colors: [7, 8, 9], wave: true }).initParticles(wave[0]!);
    expect(new Set(wave.map((p) => p.tint)).size).toBe(1);
  });

  it('drift sways, spins, flutters, drags and recycles past its kill lines', () => {
    const [p] = chain(1) as [BehaviorParticle];
    p.config.velocity = { x: 100, y: 0 };
    const drift = new DriftBehavior({ sway: 10, freq: 2, flip: 3, spin: 90, drag: 1, bottom: 50 });
    drift.initParticles(p);
    expect(Math.abs(p.config.spin ?? 0)).toBeLessThanOrEqual(Math.PI / 2);
    const before = { x: p.x, rotation: p.rotation };
    p.age = 0.3;
    expect(drift.updateParticle(p, 0.1)).toBe(false);
    expect(p.x).not.toBe(before.x);
    expect(Math.abs(p.scaleX)).toBeLessThanOrEqual(1);
    expect(p.config.velocity.x).toBeCloseTo(100 * Math.exp(-0.1), 6);
    p.y = 51;
    expect(drift.updateParticle(p, 0.1)).toBe(true);
    expect(new DriftBehavior({ top: 0 }).updateParticle({ ...p, y: -1 }, 0.1)).toBe(true);
  });
});

describe('emitter presets: the procedural atlas', () => {
  it('draws eight shapes in 64 px cells and frees its gradients', () => {
    const calls: string[] = [];
    const g = new Proxy(
      {},
      {
        get(_target, key: string, receiver: unknown) {
          return (...args: unknown[]) => {
            calls.push(`${key}:${String(args[0])}`);
            return receiver;
          };
        },
      },
    );
    const destroyed: string[] = [];
    const PIXI = {
      FillGradient: class {
        constructor(readonly options: { type: string }) {}
        destroy(): void {
          destroyed.push(this.options.type);
        }
      },
    } as unknown as AtlasPixi;
    const gradients = drawParticleAtlas(PIXI, g as never);
    expect(gradients).toHaveLength(2);
    expect(calls.some((call) => call.startsWith('star:'))).toBe(true);
    const xs = calls
      .filter((call) => /^(?:circle|rect|roundRect|star|moveTo|lineTo):/u.test(call))
      .map((call) => Number(call.split(':')[1]));
    expect(Math.max(...xs)).toBeLessThan(CELL * PARTICLE_SHAPES.length);
    for (const gradient of gradients) gradient.destroy();
    expect(destroyed.sort()).toEqual(['linear', 'radial']);
  });
});

/* ── spawn / burst on the real vendored Emitter ─────────────────────────── */

interface FakeScene {
  scene: Record<string, unknown>;
  ticks: ((time: { dt: number }) => void)[];
  resizes: (() => void)[];
  disposers: (() => void)[];
  generated: number;
  released: number;
  run(seconds: number): void;
}

function fakeScene(
  options: { reducedMotion?: boolean; editor?: boolean; dir?: 1 | -1 } = {},
): FakeScene {
  const record = {
    ticks: [] as ((time: { dt: number }) => void)[],
    resizes: [] as (() => void)[],
    disposers: [] as (() => void)[],
    generated: 0,
    released: 0,
  };
  const g = new Proxy({} as { destroy(): void }, {
    get(_target, _key, receiver: unknown) {
      return () => receiver;
    },
  });
  const sheet = new Texture({ source: Texture.WHITE.source });
  sheet.destroy = () => {
    record.released += 1;
  };
  const view = { width: 800, height: 600 };
  const scene = {
    PIXI: {
      Graphics: class {
        constructor() {
          return g;
        }
        destroy(): void {
          /* the recording proxy stands in */
        }
      },
      FillGradient: class {
        destroy(): void {
          /* recorded by the atlas test */
        }
      },
      Rectangle,
      Texture: class extends Texture {
        constructor() {
          super({ source: Texture.WHITE.source });
        }
      },
      ParticleContainer,
    },
    app: {
      renderer: {
        generateTexture() {
          record.generated += 1;
          return sheet;
        },
      },
      render: vi.fn(),
    },
    world: new Container(),
    get width() {
      return view.width;
    },
    get height() {
      return view.height;
    },
    design: null,
    palette: DARK,
    dir: options.dir ?? 1,
    editor: options.editor === true,
    reducedMotion: options.reducedMotion === true,
    count: (n: number) => n,
    tick: (fn: (time: { dt: number }) => void) => record.ticks.push(fn),
    onResize: (fn: () => void) => record.resizes.push(fn),
    dispose: (fn: () => void) => record.disposers.push(fn),
    resize(width: number, height: number) {
      view.width = width;
      view.height = height;
      for (const fn of record.resizes) fn();
    },
  };
  return {
    ...record,
    scene,
    get generated() {
      return record.generated;
    },
    get released() {
      return record.released;
    },
    run(seconds: number) {
      for (let t = 0; t < seconds; t += 1 / 30) for (const fn of record.ticks) fn({ dt: 1 / 30 });
    },
  };
}

const lib = createEmitterLibrary();

describe('emitter presets: spawn and burst', () => {
  it('keeps every upstream export and adds presets, spawn and burst', async () => {
    const upstream = await import('../../../../vendor/particle-emitter/src/index');
    for (const key of Object.keys(upstream)) expect(lib).toHaveProperty(key);
    expect(Object.keys(lib.presets)).toEqual([...PARTICLE_PRESETS]);
    expect(typeof lib.spawn).toBe('function');
    expect(typeof lib.burst).toBe('function');
  });

  it.each(PARTICLE_PRESETS)(
    '%s spawns a pre-warmed emitter in a ParticleContainer on s.world',
    (name) => {
      const fake = fakeScene();
      const handle = lib.spawn(fake.scene, name);
      const container = handle.container as ParticleContainer;
      expect(container).toBeInstanceOf(ParticleContainer);
      expect((fake.scene['world'] as Container).children).toContain(container);
      if (name === 'fireworks') expect(handle.count).toBe(0);
      else expect(handle.count).toBeGreaterThan(0);
      fake.run(1.5);
      expect(handle.count).toBeGreaterThan(0);
      expect(container.particleChildren.length).toBe(handle.count);
    },
  );

  it('shares one atlas, one tick and one disposal per scene, and frees everything', () => {
    const fake = fakeScene();
    const snow = lib.spawn(fake.scene, 'snow');
    const fire = lib.spawn(fake.scene, 'fire', { x: 100, y: 500 });
    lib.presets.rain(fake.scene);
    expect(fake.generated).toBe(1);
    expect(fake.ticks).toHaveLength(1);
    expect(fake.disposers).toHaveLength(1);
    for (const fn of fake.disposers) fn();
    expect(snow.active).toBe(false);
    expect(fire.active).toBe(false);
    expect((snow.container as ParticleContainer).destroyed).toBe(true);
    expect(fake.released).toBe(1);
    // A new scene on a fresh renderer draws its own atlas.
    const next = fakeScene();
    lib.spawn(next.scene, 'dust');
    expect(next.generated).toBe(1);
  });

  it('a burst emits once and destroys itself when its particles are gone', () => {
    const fake = fakeScene();
    const pop = lib.burst(fake.scene, 'confetti', { x: 400, y: 300, count: 30 });
    expect(pop.count).toBe(30);
    expect(pop.active).toBe(true);
    fake.run(5);
    expect(pop.active).toBe(false);
    expect((pop.container as ParticleContainer).destroyed).toBe(true);
  });

  it('reduced motion: a stream is one frozen pre-warmed frame, a burst emits nothing', () => {
    const fake = fakeScene({ reducedMotion: true });
    const snow = lib.spawn(fake.scene, 'snow');
    const frozen = (snow.container as ParticleContainer).particleChildren.map((p) => p.y);
    expect(frozen.length).toBeGreaterThan(0);
    expect(fake.scene['app']).toHaveProperty('render');
    expect((fake.scene['app'] as { render: () => void }).render).toHaveBeenCalled();
    fake.run(2);
    expect((snow.container as ParticleContainer).particleChildren.map((p) => p.y)).toEqual(frozen);
    const pop = lib.burst(fake.scene, 'fireworks', { x: 10, y: 10 });
    expect(pop.active).toBe(false);
    expect(pop.count).toBe(0);
    // A still fireworks show is one burst caught mid-bloom.
    expect(lib.spawn(fake.scene, 'fireworks').count).toBeGreaterThan(0);
  });

  it('the editor gets fewer particles', () => {
    const live = lib.spawn(fakeScene().scene, 'rain').emitter;
    const editor = lib.spawn(fakeScene({ editor: true }).scene, 'rain').emitter;
    expect(editor.maxParticles).toBeLessThan(live.maxParticles);
  });

  it('a view-filling preset follows resizes; move() re-anchors and stops that', () => {
    const fake = fakeScene();
    const snow: ParticleHandle = lib.spawn(fake.scene, 'snow');
    const shape = () =>
      (snow.emitter.getBehavior('spawnShape') as { shape: { w: number; y: number } }).shape;
    const before = shape().w;
    (fake.scene['resize'] as (w: number, h: number) => void)(390, 700);
    expect(shape().w).toBeLessThan(before);
    snow.move(100, 50);
    expect(shape().y).toBeLessThan(50);
    expect(shape().y).toBeGreaterThan(0);
    const anchored = shape().w;
    (fake.scene['resize'] as (w: number, h: number) => void)(1280, 720);
    expect(shape().w).toBe(anchored);
  });

  it('stop() lets particles die out, start() resumes, burst() adds a wave', () => {
    const fake = fakeScene();
    const fire = lib.spawn(fake.scene, 'fire', { x: 50, y: 50 });
    const count = fire.count;
    fire.burst(10);
    expect(fire.count).toBeGreaterThanOrEqual(Math.min(count + 10, fire.emitter.maxParticles));
    fire.stop();
    fake.run(1.2);
    expect(fire.count).toBe(0);
    fire.start();
    fake.run(0.3);
    expect(fire.count).toBeGreaterThan(0);
    fire.destroy();
    expect(fire.active).toBe(false);
    expect(fire.count).toBe(0);
  });

  it('moves a fireworks show to its new box', () => {
    const fake = fakeScene();
    const show = lib.spawn(fake.scene, 'fireworks');
    show.move(100, 80);
    fake.run(1.5);
    const xs = (show.container as ParticleContainer).particleChildren.map((p) => p.x);
    expect(xs.length).toBeGreaterThan(0);
    // Bursts now bloom in the default 400 px box around x 100, not around the view's centre (400).
    const mean = xs.reduce((sum, x) => sum + x, 0) / xs.length;
    expect(mean).toBeLessThan(260);
  });

  it('runs a hand-written config with the same lifecycle, and frees the atlas a preset drew', () => {
    const fake = fakeScene();
    const config = lib.presets.embers(fake.scene, { x: 100, y: 300 });
    expect(fake.disposers).toHaveLength(1);
    const handle = lib.spawn(fake.scene, config);
    expect(handle.config).toBe(config);
    expect(handle.count).toBeGreaterThan(0);
  });
});
