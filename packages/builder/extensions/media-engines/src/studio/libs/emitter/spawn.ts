/*
  `s.lib.emitter.presets / spawn / burst` (particles and physics, 2026-10-13): tuned emitters in
  one line, with the lifecycle a scene would otherwise hand-write.

    const snow = s.lib.emitter.spawn(s, 'snow');                       // fills the view, follows resizes
    s.lib.emitter.burst(s, 'confetti', { x: s.pointer.x, y: s.pointer.y }); // one shot, then gone
    const cfg = s.lib.emitter.presets.fire(s, { x: 200, y: 400 });     // a config for new Emitter(…)

  Each handle owns a PIXI.ParticleContainer (upstream requires one) added to s.world (or
  `parent`), an upstream Emitter updated in ONE s.tick per scene (paused offscreen with the rest
  of the scene), the atlas texture shared per renderer, and everything ends in s.dispose. Streams
  are pre-warmed so the first frame is already full. Reduced motion: a stream is pre-warmed and
  then frozen — one still frame — and a burst emits nothing. The editor canvas gets half the
  particles (env.budget). Wind and slant mirror with s.dir.
*/

import {
  particleTextures,
  releaseParticleTextures,
  type AtlasPixi,
  type AtlasRenderer,
} from './atlas';
import {
  buildPreset,
  type BehaviorEntry,
  type BuiltPreset,
  type ParticleOptions,
  type PresetConfig,
  type PresetEnv,
} from './presets';
import { PARTICLE_PRESETS, type ParticlePreset, type RecipePalette } from './recipes';

/** The slice of the upstream Emitter the handles drive. */
export interface EmitterLike {
  emit: boolean;
  frequency: number;
  maxParticles: number;
  minLifetime: number;
  maxLifetime: number;
  particlesPerWave: number;
  readonly particleCount: number;
  update(seconds: number): void;
  emitNow(): void;
  updateSpawnPos(x: number, y: number): void;
  getBehavior(type: string): unknown;
  destroy(): void;
}
export type EmitterClass = new (parent: unknown, config: unknown) => EmitterLike;

interface ContainerLike {
  blendMode: string;
  destroyed?: boolean;
  destroy(): void;
}
interface ParentLike {
  addChild(child: unknown): unknown;
}

/** The scene, as the particle kit reads it (a structural Scene). */
interface SceneSlice {
  readonly PIXI: AtlasPixi & {
    ParticleContainer: new (options: Record<string, unknown>) => ContainerLike;
  };
  readonly app: { readonly renderer: AtlasRenderer & object; render(): void };
  readonly world: unknown;
  readonly width: number;
  readonly height: number;
  readonly design: {
    readonly view: { x: number; y: number; width: number; height: number };
  } | null;
  readonly palette: RecipePalette;
  readonly dir: 1 | -1;
  readonly editor: boolean;
  readonly reducedMotion: boolean;
  count(n: number): number;
  tick(fn: (time: { dt: number }) => void): void;
  onResize(fn: () => void): void;
  dispose(fn: () => void): void;
}

export interface ParticleHandle {
  /** The upstream Emitter (advanced: its full API). */
  readonly emitter: EmitterLike;
  /** Its PIXI.ParticleContainer. */
  readonly container: unknown;
  /** The EmitterConfigV3 it was built from. */
  readonly config: PresetConfig;
  /** Live particles. */
  readonly count: number;
  /** False once destroyed (a finished burst destroys itself). */
  readonly active: boolean;
  /** Move the anchor (fire follows a torch; an area preset moves its box). */
  move(x: number, y: number): void;
  /** One extra wave now (default 12 particles). Nothing under reduced motion. */
  burst(count?: number): void;
  start(): void;
  /** Stop emitting; live particles finish their lives. */
  stop(): void;
  destroy(): void;
}

interface Entry {
  readonly handle: ParticleHandle;
  step(dt: number): void;
  /** Rebuild the geometry: on resize for a preset that fills the view, or after move(). */
  relayout(moved?: boolean): void;
  destroy(): void;
}

type Kind = ParticlePreset | PresetConfig;

const PREWARM_STEP = 1 / 20;

function guard(fn: () => void): void {
  try {
    fn();
  } catch {
    // Teardown order is not ours: the stage may already be destroyed with the region.
  }
}
const registries = new WeakMap<object, Set<Entry>>();

function viewOf(s: SceneSlice): PresetEnv['view'] {
  const view = s.design?.view;
  return view === undefined ? { x: 0, y: 0, width: s.width, height: s.height } : { ...view };
}

function envOf(s: SceneSlice): PresetEnv {
  return {
    textures: particleTextures(s.PIXI, s.app.renderer),
    palette: s.palette,
    dir: s.dir === -1 ? -1 : 1,
    view: viewOf(s),
    budget: (s.count(1000) / 1000) * (s.editor ? 0.5 : 1),
  };
}

/** One s.tick, one resize hook and one disposal per scene, however many handles it makes. */
function registry(s: SceneSlice): Set<Entry> {
  let live = registries.get(s);
  if (live !== undefined) return live;
  const entries = new Set<Entry>();
  live = entries;
  registries.set(s, entries);
  s.tick((time) => {
    for (const entry of entries) entry.step(time.dt);
  });
  s.onResize(() => {
    for (const entry of entries) entry.relayout();
  });
  s.dispose(() => {
    for (const entry of [...entries]) entry.destroy();
    registries.delete(s);
    releaseParticleTextures(s.app.renderer);
  });
  return entries;
}

function find(config: PresetConfig, type: string): Record<string, unknown> | undefined {
  return config.behaviors.find((entry: BehaviorEntry) => entry.type === type)?.config;
}

/** Copies a rebuilt config's geometry onto a live emitter, keeping its particles. */
function apply(emitter: EmitterLike, built: BuiltPreset): void {
  const { config } = built;
  emitter.frequency = config.frequency;
  emitter.maxParticles = config.maxParticles;
  emitter.minLifetime = config.lifetime.min;
  emitter.maxLifetime = config.lifetime.max;
  emitter.updateSpawnPos(config.pos.x, config.pos.y);
  const shape = (emitter.getBehavior('spawnShape') as { shape?: object } | null)?.shape;
  const data = find(config, 'spawnShape')?.['data'];
  if (shape !== undefined && typeof data === 'object' && data !== null) Object.assign(shape, data);
  const drift = emitter.getBehavior('drift');
  const lines = find(config, 'drift');
  if (drift !== null && typeof drift === 'object' && lines !== undefined) {
    Object.assign(drift, { top: lines['top'], bottom: lines['bottom'] });
  }
}

export function createParticleKit(Emitter: EmitterClass) {
  function make(
    scene: unknown,
    kind: Kind,
    options: ParticleOptions = {},
    once = false,
  ): ParticleHandle {
    const s = scene as SceneSlice;
    const o: ParticleOptions = { ...options };
    const entries = registry(s);
    const named = typeof kind === 'string';
    let built: BuiltPreset | undefined = named ? buildPreset(kind, o, envOf(s), once) : undefined;
    const config: PresetConfig = built?.config ?? (kind as PresetConfig);
    const calm = s.reducedMotion;
    const container = new s.PIXI.ParticleContainer({
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true, uvs: true },
    });
    if (built?.glow === true) container.blendMode = 'add';
    ((o.parent ?? s.world) as ParentLike).addChild(container);
    const emitter = new Emitter(container, config);
    let alive = true;
    let showing = built?.show !== undefined;
    let wait = 0;

    /** A show's next burst: somewhere in the upper two thirds of its area. */
    function wave(): void {
      const area = built?.area;
      if (area === undefined) return;
      emitter.updateSpawnPos(
        area.x + area.width * (0.15 + Math.random() * 0.7),
        area.y + area.height * (0.1 + Math.random() * 0.55),
      );
      emitter.emitNow();
    }
    function run(seconds: number): void {
      for (let t = 0; t < seconds; t += PREWARM_STEP) emitter.update(PREWARM_STEP);
    }

    const entry: Entry = {
      handle: {
        emitter,
        container,
        config,
        get count(): number {
          return alive ? emitter.particleCount : 0;
        },
        get active(): boolean {
          return alive;
        },
        move(x: number, y: number): void {
          if (!alive) return;
          o.x = x;
          o.y = y;
          if (built === undefined || built.point) emitter.updateSpawnPos(x, y);
          else entry.relayout(true);
        },
        burst(count = 12): void {
          if (!alive || calm) return;
          const wave = emitter.particlesPerWave;
          emitter.particlesPerWave = Math.max(1, Math.round(count));
          emitter.emitNow();
          emitter.particlesPerWave = wave;
        },
        start(): void {
          if (!alive || calm || once) return;
          if (built?.show === undefined) emitter.emit = true;
          else showing = true;
        },
        stop(): void {
          emitter.emit = false;
          showing = false;
        },
        destroy(): void {
          entry.destroy();
        },
      },
      step(dt: number): void {
        if (!alive || calm) return;
        if (showing) {
          wait -= dt;
          if (wait <= 0) {
            wave();
            const [a, b] = built?.show ?? [1, 1];
            wait = a + Math.random() * (b - a);
          }
        }
        emitter.update(dt);
        if (once && emitter.particleCount === 0) entry.destroy();
      },
      relayout(moved = false): void {
        if (!alive || once || built === undefined || !(moved || built.auto)) return;
        built = buildPreset(kind as string, o, envOf(s), once);
        apply(emitter, built);
      },
      destroy(): void {
        if (!alive) return;
        alive = false;
        entries.delete(entry);
        guard(() => {
          emitter.destroy();
        });
        guard(() => {
          if (container.destroyed !== true) container.destroy();
        });
      },
    };
    entries.add(entry);

    if (once) {
      if (calm) entry.destroy();
      else emitter.emitNow();
    } else if (built?.show !== undefined) {
      // A still show is one burst caught mid-bloom.
      if (calm) {
        wave();
        run(0.45);
      }
    } else {
      run(built?.prewarm ?? config.lifetime.max);
    }
    if (calm && entry.handle.active) {
      emitter.emit = false;
      s.app.render();
    }
    return entry.handle;
  }

  const presets = Object.freeze(
    Object.fromEntries(
      PARTICLE_PRESETS.map((name) => [
        name,
        (scene: unknown, options: ParticleOptions = {}): PresetConfig => {
          // The atlas the config's textures come from is freed with the scene.
          registry(scene as SceneSlice);
          return buildPreset(name, options, envOf(scene as SceneSlice)).config;
        },
      ]),
    ) as Record<ParticlePreset, (scene: unknown, options?: ParticleOptions) => PresetConfig>,
  );

  return {
    presets,
    /** A running emitter from a preset name (or your own config): see the header. */
    spawn: (scene: unknown, kind: Kind, options?: ParticleOptions): ParticleHandle =>
      make(scene, kind, options, false),
    /** One burst of a preset at x,y (default the view's centre); the handle ends itself. */
    burst: (scene: unknown, kind: ParticlePreset, options?: ParticleOptions): ParticleHandle =>
      make(scene, kind, options, true),
  };
}
