/*
  The `fx` Studio library's effect engine (creative engines, 2026-10-12).

    const fx = s.lib.fx.create(s.app, { reducedMotion: s.reducedMotion, rng: s.random });
    s.tick((time) => fx.update(time.dt));
    s.dispose(() => fx.dispose());
    fx.emit('coin', hero.x, hero.y);           // a named recipe
    const rain = fx.weather('rain');           // continuous, sized to the live screen
    fx.shake(world, { intensity: 10 });        // camera shake on any container
    fx.floatText(x, y, '+10', { color: 0xfde047 });

  Particles are pooled Sprites over textures drawn once per shape (white, tinted per particle),
  in one layer above the scene. Everything is bounded (`max` live particles, ≤ 32 continuous
  emitters, ≤ 64 one-shot effects) and does nothing under reduced motion — meaning stays in the
  DOM and the still frame. Nothing runs unless `update(dt)` is called by the scene's own clock.
*/

import type { PixiNamespace, PixiTexture } from '../shared/pixi-types';
import {
  FX_PRESETS,
  PARTICLE_SHAPES,
  WEATHER_KINDS,
  type BurstOptions,
  type ParticleShape,
} from './presets';

import {
  FX_LIMITS,
  NOOP_HANDLE,
  TEXTURE_SIZE,
  WEATHER_BY_NAME,
  drawShape,
  isApp,
  range,
  type Fx,
  type FxHandle,
  type FxOptions,
  type Particle,
  type Runner,
  type Sprite,
} from './particles';
export { FX_LIMITS } from './particles';
export type {
  FloatTextOptions,
  Fx,
  FxHandle,
  FxOptions,
  TrailOptions,
  WeatherOptions,
} from './particles';

export function createFx(PIXI: PixiNamespace, sceneApp: unknown, options: FxOptions = {}): Fx {
  if (!isApp(sceneApp)) throw new TypeError('fx.create needs the scene app (s.app)');
  const app = sceneApp;
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const reduced = options.reducedMotion === true;
  const max = Math.max(1, Math.min(FX_LIMITS.particles, Math.floor(options.max ?? 600)));
  const ownsLayer = options.layer === undefined;
  const layer = options.layer ?? app.stage.addChild(new PIXI.Container());
  const particleLayer = layer.addChild(new PIXI.Container());
  const overlay = layer.addChild(new PIXI.Container());
  const textures = new Map<ParticleShape, PixiTexture>();
  const live: Particle[] = [];
  const pool: Sprite[] = [];
  const runners: Runner[] = [];
  const shakes = new Map<object, FxHandle>();
  let disposed = false;

  function texture(shape: ParticleShape): PixiTexture {
    const known = textures.get(shape);
    if (known !== undefined) return known;
    const g = new PIXI.Graphics();
    drawShape(g, PARTICLE_SHAPES.includes(shape) ? shape : 'dot');
    const made = app.renderer.generateTexture({
      target: g,
      frame: new PIXI.Rectangle(0, 0, TEXTURE_SIZE, TEXTURE_SIZE),
      resolution: 2,
      antialias: true,
    });
    g.destroy();
    textures.set(shape, made);
    return made;
  }

  function sprite(shape: ParticleShape): Sprite {
    const reused = pool.pop();
    const made = reused ?? new PIXI.Sprite(texture(shape));
    made.texture = texture(shape);
    made.anchor?.set(0.5);
    made.visible = true;
    particleLayer.addChild(made);
    return made;
  }

  function release(particle: Particle): void {
    particle.sprite.removeFromParent();
    particle.sprite.visible = false;
    if (pool.length < 256) pool.push(particle.sprite);
    else particle.sprite.destroy();
  }

  function spawn(
    x: number,
    y: number,
    burst: BurstOptions,
    extra?: { sway?: number; twinkle?: boolean },
  ): boolean {
    if (live.length >= max) return false;
    const colors =
      burst.colors !== undefined && burst.colors.length > 0 ? burst.colors : [0xffffff];
    const shape = burst.shape ?? 'dot';
    const angle = (burst.angle ?? 0) + (rng() - 0.5) * (burst.spread ?? Math.PI * 2);
    const speed = range(burst.speed, [60, 180], rng);
    const jitter = burst.jitter ?? 0;
    const size0 = range(burst.size, [3, 6], rng);
    const s = sprite(shape);
    s.tint = colors[Math.floor(rng() * colors.length)] ?? 0xffffff;
    s.blendMode = burst.additive === true ? 'add' : 'normal';
    s.x = x + (rng() - 0.5) * 2 * jitter;
    s.y = y + (rng() - 0.5) * 2 * jitter;
    s.rotation = shape === 'drop' || shape === 'spark' ? angle + Math.PI / 2 : rng() * Math.PI * 2;
    s.width = size0;
    s.height = shape === 'drop' ? size0 * 3 : size0;
    s.alpha = extra?.twinkle === true ? 0 : 1;
    live.push({
      sprite: s,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: Math.max(0.05, range(burst.life, [0.5, 1], rng)),
      size0,
      size1: burst.shrink === false ? size0 * (burst.grow ?? 1) : 0,
      spin: range(burst.spin, [0, 0], rng),
      gravity: burst.gravity ?? 0,
      drag: Math.max(0, Math.min(1, burst.drag ?? 0)),
      fade: burst.fade !== false,
      twinkle: extra?.twinkle === true,
      sway: extra?.sway ?? 0,
      phase: rng() * Math.PI * 2,
      alpha: 1,
    });
    return true;
  }

  function burst(x: number, y: number, burstOptions: BurstOptions = {}): number {
    if (disposed || reduced || !Number.isFinite(x) || !Number.isFinite(y)) return 0;
    const count = Math.max(0, Math.min(FX_LIMITS.perBurst, Math.floor(burstOptions.count ?? 16)));
    let made = 0;
    for (let i = 0; i < count; i += 1) if (spawn(x, y, burstOptions)) made += 1;
    return made;
  }

  function addRunner(runner: Runner, limit: number): FxHandle {
    if (disposed || reduced) {
      runner.stop();
      return NOOP_HANDLE;
    }
    if (runners.length >= limit) {
      runner.stop();
      throw new RangeError('fx: too many running effects');
    }
    runners.push(runner);
    let active = true;
    return {
      get active() {
        return active && runners.includes(runner);
      },
      stop() {
        active = false;
        const at = runners.indexOf(runner);
        if (at >= 0) runners.splice(at, 1);
        runner.stop();
      },
    };
  }

  function screenArea(): { x: number; y: number; width: number; height: number } {
    return { x: 0, y: 0, width: app.screen.width, height: app.screen.height };
  }

  const fx: Fx = {
    get count() {
      return live.length;
    },
    layer,
    presets: Object.freeze(Object.keys(FX_PRESETS)),
    update(dtSeconds) {
      if (disposed) return;
      const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? Math.min(dtSeconds, 0.1) : 0;
      if (dt === 0) return;
      for (let i = live.length - 1; i >= 0; i -= 1) {
        const p = live[i];
        if (p === undefined) continue;
        p.age += dt;
        if (p.age >= p.life) {
          live.splice(i, 1);
          release(p);
          continue;
        }
        const k = p.age / p.life;
        const keep = Math.pow(1 - p.drag, dt);
        p.vx *= keep;
        p.vy = p.vy * keep + p.gravity * dt;
        const swayX = p.sway === 0 ? 0 : Math.sin(p.phase + p.age * 2) * p.sway * dt;
        const s = p.sprite;
        s.x += p.vx * dt + swayX;
        s.y += p.vy * dt;
        s.rotation += p.spin * dt;
        const size = p.size0 + (p.size1 - p.size0) * k;
        s.width = Math.max(0.01, size);
        s.height = Math.max(0.01, s.texture === textures.get('drop') ? size * 3 : size);
        if (p.twinkle) s.alpha = Math.sin(Math.PI * k);
        else if (p.fade) s.alpha = 1 - k * k;
      }
      for (let i = runners.length - 1; i >= 0; i -= 1) {
        const runner = runners[i];
        if (runner === undefined) continue;
        if (!runner.step(dt)) {
          runners.splice(i, 1);
          runner.stop();
        }
      }
    },
    burst,
    emit(name, x, y, overrides = {}) {
      const preset = FX_PRESETS[name];
      if (preset === undefined)
        throw new RangeError(
          `fx: unknown preset "${name}" (${Object.keys(FX_PRESETS).join(', ')})`,
        );
      return burst(x, y, { ...preset, ...overrides });
    },
    // Authored scene code may pass any value as the kind; property lookup coerces it to a key.
    weather(kind: unknown, weatherOptions = {}) {
      const recipe = WEATHER_BY_NAME[kind as string];
      if (recipe === undefined)
        throw new RangeError(`fx: unknown weather "${String(kind)}" (${WEATHER_KINDS.join(', ')})`);
      const density = Math.max(0, Math.min(4, weatherOptions.density ?? 1));
      const area = weatherOptions.area ?? screenArea;
      const wind = weatherOptions.wind ?? 0;
      const look: BurstOptions = {
        ...recipe.burst,
        ...(weatherOptions.colors === undefined ? {} : { colors: weatherOptions.colors }),
      };
      let owed = 0;
      // Fill the area at once so a page never opens on an empty sky.
      let primed = false;
      return addRunner(
        {
          step(dt) {
            const box = area();
            const spawnOne = (age: number): void => {
              const x = box.x + rng() * box.width;
              const y =
                recipe.from === 'top'
                  ? box.y - 10
                  : recipe.from === 'bottom'
                    ? box.y + box.height + 10
                    : box.y + rng() * box.height;
              const p = spawn(x, y, look, {
                sway: recipe.sway ?? 0,
                twinkle: recipe.twinkle === true,
              })
                ? live[live.length - 1]
                : undefined;
              if (p !== undefined) {
                p.vx += wind;
                if (age > 0) {
                  const t = Math.min(age, p.life * 0.9);
                  p.age = t;
                  p.sprite.x += p.vx * t;
                  p.sprite.y += p.vy * t;
                }
              }
            };
            if (!primed) {
              primed = true;
              const life = ((recipe.burst.life?.[0] ?? 1) + (recipe.burst.life?.[1] ?? 1)) / 2;
              const prefill = Math.min(max / 2, recipe.rate * density * life);
              for (let i = 0; i < prefill; i += 1) spawnOne(rng() * life);
            }
            owed += recipe.rate * density * dt;
            while (owed >= 1) {
              owed -= 1;
              spawnOne(0);
            }
            return true;
          },
          stop() {
            /* existing particles finish their lives */
          },
        },
        FX_LIMITS.emitters,
      );
    },
    trail(target, trailOptions = {}) {
      let owed = 0;
      const rate = Math.max(1, Math.min(120, trailOptions.rate ?? 40));
      const look: BurstOptions = {
        colors: trailOptions.colors ?? [0xffffff],
        shape: trailOptions.shape ?? 'glow',
        size: trailOptions.size ?? [4, 8],
        life: trailOptions.life ?? [0.25, 0.5],
        speed: [0, 12],
        additive: trailOptions.additive !== false,
      };
      return addRunner(
        {
          step(dt) {
            if ((target as { destroyed?: boolean }).destroyed === true) return false;
            owed += rate * dt;
            while (owed >= 1) {
              owed -= 1;
              spawn(target.x, target.y, look);
            }
            return true;
          },
          stop() {
            /* nothing owned */
          },
        },
        FX_LIMITS.emitters,
      );
    },
    ring(x, y, ringOptions = {}) {
      const g = overlay.addChild(new PIXI.Graphics());
      const radius = Math.max(4, Math.min(2000, ringOptions.radius ?? 90));
      const width = Math.max(1, Math.min(60, ringOptions.width ?? 6));
      const life = Math.max(0.05, Math.min(5, ringOptions.life ?? 0.45));
      const color = ringOptions.color ?? 0xffffff;
      let age = 0;
      return addRunner(
        {
          step(dt) {
            age += dt;
            const k = Math.min(1, age / life);
            const eased = 1 - (1 - k) ** 3;
            g.clear()
              .circle(x, y, Math.max(1, radius * eased))
              .stroke({ color, width: width * (1 - k) + 0.5, alpha: 1 - k });
            return k < 1;
          },
          stop() {
            g.destroy();
          },
        },
        FX_LIMITS.effects,
      );
    },
    flash(flashOptions = {}) {
      const g = overlay.addChild(new PIXI.Graphics());
      const life = Math.max(0.05, Math.min(3, flashOptions.life ?? 0.25));
      const peak = Math.max(0, Math.min(1, flashOptions.alpha ?? 0.6));
      const color = flashOptions.color ?? 0xffffff;
      let age = 0;
      return addRunner(
        {
          step(dt) {
            age += dt;
            const k = Math.min(1, age / life);
            g.clear()
              .rect(0, 0, app.screen.width, app.screen.height)
              .fill({ color, alpha: peak * (1 - k) });
            return k < 1;
          },
          stop() {
            g.destroy();
          },
        },
        FX_LIMITS.effects,
      );
    },
    shake(target = app.stage, shakeOptions = {}) {
      // A new shake replaces a running one, so the base position is never a shaken one.
      shakes.get(target)?.stop();
      const baseX = target.x;
      const baseY = target.y;
      const intensity = Math.max(0, Math.min(80, shakeOptions.intensity ?? 8));
      const life = Math.max(0.05, Math.min(3, shakeOptions.life ?? 0.35));
      let age = 0;
      const handle = addRunner(
        {
          step(dt) {
            age += dt;
            const k = Math.min(1, age / life);
            const amount = intensity * (1 - k) * (1 - k);
            target.x = baseX + (rng() * 2 - 1) * amount;
            target.y = baseY + (rng() * 2 - 1) * amount;
            return k < 1;
          },
          stop() {
            target.x = baseX;
            target.y = baseY;
            shakes.delete(target);
          },
        },
        FX_LIMITS.effects,
      );
      if (handle.active) shakes.set(target, handle);
      return handle;
    },
    // Authored scene code often passes a number (a score); String() accepts anything.
    floatText(x, y, text: unknown, textOptions = {}) {
      if (disposed || reduced) return NOOP_HANDLE;
      const label = new PIXI.Text({
        text: String(text).slice(0, 40),
        style: {
          fill: textOptions.color ?? 0xffffff,
          fontSize: Math.max(8, Math.min(96, textOptions.size ?? 22)),
          fontWeight: '800',
          fontFamily: textOptions.fontFamily ?? 'system-ui, sans-serif',
          stroke: { color: textOptions.stroke ?? 0x0f172a, width: 4 },
        },
      });
      label.anchor?.set(0.5);
      label.x = x;
      label.y = y;
      overlay.addChild(label);
      const rise = textOptions.rise ?? 46;
      const life = Math.max(0.2, Math.min(4, textOptions.life ?? 0.9));
      let age = 0;
      return addRunner(
        {
          step(dt) {
            age += dt;
            const k = Math.min(1, age / life);
            label.y = y - rise * (1 - (1 - k) ** 2);
            label.alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
            const pop =
              k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : 1.15 - Math.min(0.15, (k - 0.15) * 0.5);
            label.scale.set(pop);
            return k < 1;
          },
          stop() {
            label.destroy();
          },
        },
        FX_LIMITS.effects,
      );
    },
    pulse(target, pulseOptions = {}) {
      const baseX = target.scale.x;
      const baseY = target.scale.y;
      const baseAlpha = target.alpha;
      const amount = Math.max(0, Math.min(1, (pulseOptions.scale ?? 1.08) - 1));
      const speed = Math.max(0.1, Math.min(10, pulseOptions.speed ?? 2));
      const dim = Math.max(0, Math.min(1, pulseOptions.alpha ?? 0));
      let t = 0;
      return addRunner(
        {
          step(dt) {
            if (target.destroyed === true) return false;
            t += dt;
            const wave = (Math.sin(t * speed * Math.PI * 2) + 1) / 2;
            target.scale.set(baseX * (1 + amount * wave), baseY * (1 + amount * wave));
            if (dim > 0) target.alpha = baseAlpha * (1 - dim * (1 - wave));
            return true;
          },
          stop() {
            if (target.destroyed === true) return;
            target.scale.set(baseX, baseY);
            target.alpha = baseAlpha;
          },
        },
        FX_LIMITS.emitters,
      );
    },
    clear() {
      for (const p of live.splice(0)) release(p);
      for (const runner of runners.splice(0)) runner.stop();
    },
    dispose() {
      if (disposed) return;
      fx.clear();
      disposed = true;
      for (const s of pool.splice(0)) s.destroy();
      for (const made of textures.values()) made.destroy(true);
      textures.clear();
      if (ownsLayer) layer.destroy({ children: true });
      else {
        particleLayer.destroy({ children: true });
        overlay.destroy({ children: true });
      }
    },
  };
  return fx;
}
