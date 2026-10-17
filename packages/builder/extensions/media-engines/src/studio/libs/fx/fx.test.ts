import { describe, expect, it } from 'vitest';

import { fakePixi } from '../shared/fake-pixi.test-util';
import { createFx } from './effects';
import { FX_PRESETS, WEATHER_KINDS } from './presets';

function seeded(seed = 1): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** fx clamps a frame to 0.1 s like the scene clock, so long spans are stepped. */
function run(fx: { update(dt: number): void }, seconds: number): void {
  for (let left = seconds; left > 1e-9; left -= 0.05) fx.update(Math.min(0.05, left));
}

function setup(options: Parameters<typeof createFx>[2] = {}) {
  const { PIXI, app } = fakePixi();
  const fx = createFx(PIXI, app, { rng: seeded(), ...options });
  return { app, fx };
}

describe('fx particles', () => {
  it('bursts pooled particles that move, fade and expire', () => {
    const { fx } = setup();
    expect(fx.burst(100, 100, { count: 10, speed: [100, 100], life: [0.5, 0.5] })).toBe(10);
    expect(fx.count).toBe(10);
    run(fx, 0.25);
    expect(fx.count).toBe(10);
    run(fx, 0.3);
    expect(fx.count).toBe(0);
  });

  it('plays every named preset and rejects unknown ones', () => {
    const { fx } = setup({ max: 1500 });
    for (const name of Object.keys(FX_PRESETS)) expect(fx.emit(name, 10, 10)).toBeGreaterThan(0);
    expect(() => fx.emit('nuke', 0, 0)).toThrow(RangeError);
    expect(fx.presets).toContain('confetti');
  });

  it('caps live particles and burst sizes', () => {
    const { fx } = setup({ max: 50 });
    expect(fx.burst(0, 0, { count: 500 })).toBe(50);
    expect(fx.burst(0, 0, { count: 5 })).toBe(0);
    const big = setup({ max: 1500 }).fx;
    expect(big.burst(0, 0, { count: 10_000 })).toBe(200);
  });

  it('fills the sky with weather at once and keeps it going until stopped', () => {
    const { fx } = setup({ max: 1500 });
    for (const kind of WEATHER_KINDS) {
      const handle = fx.weather(kind);
      run(fx, 0.1);
      expect(handle.active).toBe(true);
      handle.stop();
      expect(handle.active).toBe(false);
    }
    expect(fx.count).toBeGreaterThan(0);
    expect(() => fx.weather('hail' as never)).toThrow(RangeError);
  });

  it('trails a moving target until it is destroyed', () => {
    const { fx } = setup();
    const target = { x: 0, y: 0, destroyed: false };
    const trail = fx.trail(target, { rate: 60 });
    run(fx, 0.1);
    expect(fx.count).toBeGreaterThan(0);
    target.destroyed = true;
    run(fx, 0.1);
    expect(trail.active).toBe(false);
  });
});

describe('fx one-shot effects', () => {
  it('shakes a container and restores it', () => {
    const { app, fx } = setup();
    app.stage.x = 5;
    fx.shake(app.stage, { intensity: 10, life: 0.2 });
    run(fx, 0.05);
    expect(app.stage.x).not.toBe(5);
    run(fx, 0.3);
    expect(app.stage.x).toBe(5);
  });

  it('floats text that rises, fades and is destroyed', () => {
    const { fx } = setup();
    const handle = fx.floatText(50, 50, '+10', { life: 0.5 });
    expect(fx.layer.children.length).toBeGreaterThan(0);
    run(fx, 0.25);
    expect(handle.active).toBe(true);
    run(fx, 0.3);
    expect(handle.active).toBe(false);
  });

  it('runs rings and flashes to completion and pulses until stopped', () => {
    const { fx } = setup();
    const ring = fx.ring(10, 10, { life: 0.2 });
    const flash = fx.flash({ life: 0.2 });
    run(fx, 0.3);
    expect(ring.active).toBe(false);
    expect(flash.active).toBe(false);
    const target = {
      x: 0,
      y: 0,
      alpha: 1,
      scale: {
        x: 1,
        y: 1,
        set(x: number, y = x) {
          this.x = x;
          this.y = y;
        },
      },
    };
    const pulse = fx.pulse(target as never, { scale: 1.2, speed: 1 });
    run(fx, 0.25);
    expect(target.scale.x).toBeGreaterThan(1);
    pulse.stop();
    expect(target.scale.x).toBe(1);
  });
});

describe('fx lifecycle', () => {
  it('does nothing under reduced motion', () => {
    const { fx } = setup({ reducedMotion: true });
    expect(fx.burst(0, 0, { count: 10 })).toBe(0);
    expect(fx.weather('snow').active).toBe(false);
    expect(fx.floatText(0, 0, 'hi').active).toBe(false);
    expect(fx.count).toBe(0);
  });

  it('disposes its layer and textures and ignores later calls', () => {
    const { app, fx } = setup();
    fx.emit('magic', 10, 10);
    fx.weather('rain');
    run(fx, 0.1);
    const layer = fx.layer as unknown as { destroyed: boolean };
    fx.dispose();
    expect(layer.destroyed).toBe(true);
    expect(
      (app as unknown as { textures: { destroyed: boolean }[] }).textures.every((t) => t.destroyed),
    ).toBe(true);
    expect(fx.burst(0, 0)).toBe(0);
    expect(fx.count).toBe(0);
  });

  it('refuses a missing app', () => {
    const { PIXI } = fakePixi();
    expect(() => createFx(PIXI, {})).toThrow(TypeError);
  });
});

describe('fx shake stacking', () => {
  it('restarts from the true base when shaken again mid-shake', () => {
    const { PIXI, app } = fakePixi();
    const fx = createFx(PIXI, app, { rng: seeded(3) });
    app.stage.x = 0;
    fx.shake(app.stage, { intensity: 20, life: 0.3 });
    fx.update(0.05);
    fx.shake(app.stage, { intensity: 20, life: 0.3 });
    for (let i = 0; i < 10; i += 1) fx.update(0.05);
    expect(app.stage.x).toBe(0);
  });
});
