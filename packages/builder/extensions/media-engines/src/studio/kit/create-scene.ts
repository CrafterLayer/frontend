/*
  createScene: the scene runtime behind `await ck.scene({...})` (pixi-studio DESIGN §B.2, D7).

  runtime-wiring opens the stage (ck.stage), loads the libs (ck.use) and calls
  `kit.createScene(ck, PIXI, app, canvas, libs, options)`. The returned object is the ONE stable
  surface presets, agent code and user code are written against.

  Rules enforced here (§B.2):
  - every listener, observer, ticker callback, shader, render texture, emitter and physics engine
    the kit creates is released on dispose (through ck.onDispose);
  - the ticker stops while the region is offscreen (IntersectionObserver) or the page is hidden;
  - reduced motion: the ticker never runs; every tick fn runs ONCE at t = 0, then the still fns,
    then one render (re-done on resize and when textures arrive);
  - the editor canvas runs the scene but never captures input (window listeners are passive) and
    never plays sound (ck.sound is a silent stub there; runtime-wiring);
  - webglcontextlost: the first loss pauses and resumes on restore (Pixi re-uploads its GPU
    resources); a second loss of the same region falls back to the still frame.
*/

import { delaunay as buildDelaunay } from './delaunay';
import { createDesign } from './design';
import { createFixedStep } from './fixed-step';
import { createSceneInput } from './input';
import { createStory } from './story';
import { createNoise } from './noise';
import { buildScenePalette, paletteOverride, readPaletteRoles } from './palette-oklab';
import { createPointerTracker } from './pointer';
import { poissonDisk } from './poisson';
import { createRandom } from './random';
import { numberParam, readDirection, readFontFamily, readLang } from './region-reads';
import { createScrollTracker } from './scroll';
import { createShaderFilter, type ShaderHandle } from './shader';
import { admittedMediaUrl } from '../libs/shared/media-url';
import { createSceneText, words as splitWords } from './text';
import { createClock, createGovernor, scaledCount, type SceneTime } from './time-governor';
import type {
  Scene,
  SceneApp,
  SceneAudioBands,
  SceneHost,
  SceneLibs,
  SceneOptions,
  SceneSound,
  SceneTicker,
  ScriptParamValue,
} from './types';

import { SILENT_BANDS, SILENT_SOUND } from './silent-sound';
export { SILENT_SOUND } from './silent-sound';

export const KIT_VERSION = '1.2.0';

/** Context losses per region element (a rerun keeps the count; the second loss goes still). */
const contextLosses = new WeakMap<Element, number>();

interface PixiKitNamespace {
  Graphics: new () => { svg(markup: string): unknown };
  RenderTexture: {
    create(options: Record<string, unknown>): { destroy(destroySource?: boolean): void };
  };
  Assets: { load(asset: unknown): Promise<unknown> };
}

interface MatterLike {
  Engine?: { create?: (...args: unknown[]) => unknown; clear?: (engine: unknown) => void };
  Composite?: { clear?: (composite: unknown, keepStatic: boolean, deep?: boolean) => void };
  Events?: { off?: (object: unknown) => void };
}

interface EmitterLib {
  Emitter?: new (...args: never[]) => { destroy(): void };
}

export function createScene(
  ck: SceneHost,
  PIXI: unknown,
  app: SceneApp,
  canvas: HTMLCanvasElement,
  libs: SceneLibs = {},
  options: SceneOptions = {},
): Scene {
  const root = ck.root;
  const doc = root.ownerDocument;
  const win = (doc.defaultView ?? globalThis) as Window & typeof globalThis;
  const namespace = PIXI as PixiKitNamespace;
  const ticker: SceneTicker = app.ticker;
  const reducedMotion = ck.reducedMotion === true;
  const editor = ck.editor === true;
  const rtl = readDirection(root, ck.rtl);
  const lang = readLang(root, ck.lang);
  const params: Record<string, ScriptParamValue> = { ...(options.params ?? {}) };
  const seed = options.seed ?? numberParam(params, 'seed') ?? 1;
  const sound: SceneSound = ck.sound ?? SILENT_SOUND;

  const cleanups: (() => void)[] = [];
  let disposed = false;
  function guard(fn: () => void): void {
    try {
      fn();
    } catch {
      // Teardown order is not ours (the stage may already be destroyed); keep releasing the rest.
    }
  }
  function report(error: unknown): void {
    if (typeof ck.reportError === 'function') {
      ck.reportError(error);
      return;
    }
    setTimeout(() => {
      throw error;
    }, 0);
  }

  /* ── deterministic helpers ───────────────────────────────────────────── */
  const random = createRandom(seed);
  const noise = createNoise(seed);
  // poisson draws from its own stream so adding a poisson call never reshuffles s.random().
  const poissonRandom = createRandom(`${String(seed)}:poisson`);

  /* ── palette ─────────────────────────────────────────────────────────── */
  const palette = buildScenePalette(readPaletteRoles(root), paletteOverride(params['palette']));
  const scrollTracker = createScrollTracker(root, win, {
    canvas,
    app,
    calm: editor || reducedMotion,
    scrub: params['scrub'] === true,
  });
  cleanups.push(scrollTracker.dispose);

  /* ── design mode (responsive scenes, 2026-10-13): s.world in design units, kit/design.ts ── */
  const designed = options.design
    ? createDesign(PIXI, app, options.design, libs.viewport, {
        canvas,
        root,
        interactive: !editor,
        calm: reducedMotion,
        render,
        // The letterbox takes the theme surface, unless the scene chose a background (null: none).
        letterbox: options.background === undefined ? palette.surface : null,
      })
    : undefined;
  if (designed !== undefined) cleanups.push(designed.dispose);

  /* ── pointer, scroll, clock, governor ───────────────────────────────── */
  const pointerTracker = createPointerTracker(
    root,
    win,
    undefined,
    designed?.map,
    scrollTracker.pointerElement,
  );
  const input = createSceneInput(root, canvas, editor);
  cleanups.push(() => {
    input.dispose();
  });
  cleanups.push(() => {
    pointerTracker.dispose();
  });
  const clock = createClock();
  const governor = createGovernor({ mode: options.quality ?? 'auto' });
  const baseResolution = Math.min(2, app.renderer.resolution || 1);
  const qualityFns: ((quality: number) => void)[] = [];
  const audio: SceneAudioBands = { ...SILENT_BANDS };

  function applyQuality(): void {
    const quality = governor.quality;
    if (baseResolution > 1 && typeof app.renderer.resize === 'function') {
      guard(() => {
        app.renderer.resize?.(
          app.screen.width,
          app.screen.height,
          Math.max(1, baseResolution * quality),
        );
      });
    }
    for (const fn of qualityFns) {
      try {
        fn(quality);
      } catch (error) {
        report(error);
      }
    }
  }
  if (governor.quality !== 1) applyQuality();

  ticker.maxFPS = options.maxFps === 30 || options.maxFps === 120 ? options.maxFps : 60;

  /* ── tracked resources ──────────────────────────────────────────────── */
  const shaders: ShaderHandle[] = [];
  const renderTextures: { destroy(destroySource?: boolean): void }[] = [];
  cleanups.push(() => {
    for (const handle of shaders) guard(() => handle.destroy());
    for (const texture of renderTextures) guard(() => texture.destroy(true));
    shaders.length = 0;
    renderTextures.length = 0;
  });

  /* ── libs (tracked wrappers where the kit must release what they create) ── */
  const lib: SceneLibs = { ...libs };
  const physics = libs.physics as MatterLike | undefined;
  if (physics?.Engine?.create !== undefined) {
    const engines: unknown[] = [];
    const create = physics.Engine.create.bind(physics.Engine);
    lib.physics = {
      ...physics,
      Engine: {
        ...physics.Engine,
        create(...args: unknown[]): unknown {
          const engine = create(...args);
          engines.push(engine);
          return engine;
        },
      },
    };
    cleanups.push(() => {
      for (const engine of engines) {
        guard(() => physics.Events?.off?.(engine));
        guard(() => physics.Engine?.clear?.(engine));
        guard(() => physics.Composite?.clear?.((engine as { world: unknown }).world, false, true));
      }
      engines.length = 0;
    });
  }
  const emitterLib = libs.emitter as EmitterLib | undefined;
  if (typeof emitterLib?.Emitter === 'function') {
    const Base = emitterLib.Emitter as unknown as new (...args: unknown[]) => { destroy(): void };
    const emitters: { destroy(): void }[] = [];
    class TrackedEmitter extends Base {
      constructor(...args: unknown[]) {
        super(...args);
        emitters.push(this);
      }
    }
    lib.emitter = { ...emitterLib, Emitter: TrackedEmitter };
    cleanups.push(() => {
      for (const emitter of emitters) guard(() => emitter.destroy());
      emitters.length = 0;
    });
  }

  /* ── frame loop ─────────────────────────────────────────────────────── */
  const tickFns: ((time: SceneTime) => void)[] = [];
  const stillFns: (() => void)[] = [];
  const resizeFns: ((width: number, height: number) => void)[] = [];
  // The world refits before any of the scene's own resize callbacks run.
  if (designed !== undefined) resizeFns.push(designed.layout);
  /** Why the ticker is stopped; it runs only when the set is empty. */
  const pauses = new Set<string>();
  let stillMode = reducedMotion;
  let ranTicks = 0;
  let ranStills = 0;

  function readAudio(): void {
    if (options.audio !== true || reducedMotion || typeof sound.analyser !== 'function') return;
    try {
      const bands = sound.analyser();
      audio.level = bands.level;
      audio.bass = bands.bass;
      audio.mid = bands.mid;
      audio.treble = bands.treble;
      audio.beat = bands.beat;
      audio.active = bands.active;
    } catch {
      // A failing analyser reads as silence.
    }
  }

  function feedShaders(): void {
    for (const handle of shaders) {
      handle.update(
        clock.time.t,
        app.screen.width,
        app.screen.height,
        pointerTracker.pointer.nx,
        pointerTracker.pointer.ny,
      );
    }
  }

  function runTick(fn: (time: SceneTime) => void, time: SceneTime): boolean {
    try {
      fn(time);
      return true;
    } catch (error) {
      report(error);
      return false;
    }
  }

  function frame(): void {
    if (disposed) return;
    const raw = ticker.deltaMS / 1000;
    if (governor.sample(raw)) applyQuality();
    const time = clock.advance(raw);
    pointerTracker.update(time.dt);
    scrollTracker.update(time.dt);
    readAudio();
    feedShaders();
    for (let index = 0; index < tickFns.length; index += 1) {
      const fn = tickFns[index] as (time: SceneTime) => void;
      if (!runTick(fn, time)) {
        // A tick that throws is dropped: one report, not one per frame.
        const failedIndex = tickFns.indexOf(fn);
        if (failedIndex >= 0) tickFns.splice(failedIndex, 1);
        index -= 1;
      } else if (tickFns[index] !== fn) {
        // A fixed-step subscription may remove itself from inside its callback.
        index -= 1;
      }
    }
  }
  ticker.add(frame);
  cleanups.push(() => {
    guard(() => ticker.remove(frame));
  });

  function syncRunning(): void {
    if (disposed) return;
    if (pauses.size > 0) input.clear();
    guard(() => {
      if (pauses.size === 0 && !stillMode) {
        if (!ticker.started) {
          governor.reset();
          ticker.start();
        }
      } else if (ticker.started) {
        ticker.stop();
      }
    });
  }

  /* ── the still frame (reduced motion, second context loss) ───────────── */
  let flushQueued = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  cleanups.push(() => {
    for (const timer of timers) clearTimeout(timer);
    timers.length = 0;
  });

  function render(): void {
    if (disposed) return;
    guard(() => app.render());
  }

  /** Run every not-yet-run tick fn once at t = 0, then the still fns, then render. */
  function flushStill(all: boolean): void {
    flushQueued = false;
    if (disposed || !stillMode) return;
    const time: SceneTime = { t: 0, dt: 0, frame: 0 };
    feedShaders();
    const ticks = all ? tickFns.slice() : tickFns.slice(ranTicks);
    for (const fn of ticks) runTick(fn, time);
    ranTicks = tickFns.length;
    const stills = all ? stillFns.slice() : stillFns.slice(ranStills);
    for (const fn of stills) {
      try {
        fn();
      } catch (error) {
        report(error);
      }
    }
    ranStills = stillFns.length;
    render();
    // Late content (textures decoding, fonts) gets two more renders, no more.
    for (const delay of [120, 700]) {
      timers.push(setTimeout(render, delay));
    }
  }

  function queueStill(): void {
    if (!stillMode || flushQueued || disposed) return;
    flushQueued = true;
    Promise.resolve().then(
      () => {
        flushStill(false);
      },
      () => undefined,
    );
  }

  if (stillMode) {
    pauses.add('still');
    syncRunning();
  }

  /* ── visibility: offscreen and hidden pauses ────────────────────────── */
  const Observer = (win as unknown as { IntersectionObserver?: typeof IntersectionObserver })
    .IntersectionObserver;
  if (typeof Observer === 'function') {
    const observer = new Observer(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry === undefined) return;
        scrollTracker.setVisible(entry.isIntersecting);
        if (entry.isIntersecting) pauses.delete('offscreen');
        else pauses.add('offscreen');
        syncRunning();
      },
      { rootMargin: '64px' },
    );
    observer.observe(root);
    cleanups.push(() => {
      observer.disconnect();
    });
  }
  function onVisibility(): void {
    if (doc.visibilityState === 'hidden') pauses.add('hidden');
    else pauses.delete('hidden');
    syncRunning();
  }
  doc.addEventListener('visibilitychange', onVisibility);
  cleanups.push(() => {
    doc.removeEventListener('visibilitychange', onVisibility);
  });
  if (doc.visibilityState === 'hidden') {
    pauses.add('hidden');
    syncRunning();
  }

  /* ── resize ─────────────────────────────────────────────────────────── */
  let lastWidth = app.screen.width;
  let lastHeight = app.screen.height;
  function checkSize(): void {
    const width = app.screen.width;
    const height = app.screen.height;
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    for (const fn of resizeFns) {
      try {
        fn(width, height);
      } catch (error) {
        report(error);
      }
    }
    if (stillMode) {
      ranTicks = 0;
      ranStills = 0;
      flushStill(true);
    }
  }
  const Resize = (win as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  if (typeof Resize === 'function') {
    const observer = new Resize(() => {
      if (disposed) return;
      guard(() => app.resize?.());
      checkSize();
    });
    observer.observe(root);
    cleanups.push(() => {
      observer.disconnect();
    });
  }
  // Window resizes reach the app through Pixi's own resizeTo; the size check rides the ticker.
  ticker.add(checkSize);
  cleanups.push(() => {
    guard(() => ticker.remove(checkSize));
  });

  /* ── WebGL context loss ─────────────────────────────────────────────── */
  function onLost(): void {
    contextLosses.set(root, (contextLosses.get(root) ?? 0) + 1);
    pauses.add('lost');
    syncRunning();
  }
  function onRestored(): void {
    pauses.delete('lost');
    if ((contextLosses.get(root) ?? 0) >= 2 && !stillMode) {
      stillMode = true;
      pauses.add('still');
      ranTicks = 0;
      ranStills = 0;
      syncRunning();
      flushStill(true);
      return;
    }
    syncRunning();
    if (stillMode) flushStill(true);
  }
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  cleanups.push(() => {
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
  });

  /* ── dispose ────────────────────────────────────────────────────────── */
  ck.onDispose(() => {
    if (disposed) return;
    disposed = true;
    for (let index = cleanups.length - 1; index >= 0; index -= 1) {
      guard(cleanups[index] as () => void);
    }
    cleanups.length = 0;
    tickFns.length = 0;
    stillFns.length = 0;
    resizeFns.length = 0;
    qualityFns.length = 0;
  });

  const fontFamily = readFontFamily(root);

  const scene: Scene = {
    PIXI,
    app,
    stage: app.stage,
    canvas,
    lib,
    get width(): number {
      return app.screen.width;
    },
    get height(): number {
      return app.screen.height;
    },
    get dpr(): number {
      return app.renderer.resolution;
    },
    world: designed?.world ?? app.stage,
    design: designed?.design ?? null,
    get compact(): boolean {
      return app.screen.width < 600;
    },
    get portrait(): boolean {
      return app.screen.height > app.screen.width;
    },
    ui: designed?.ui ?? ((px: number): number => px),
    params,
    palette,
    pointer: pointerTracker.pointer,
    input,
    scroll: scrollTracker.scroll,
    time: clock.time,
    audio,
    random: random.random,
    rand: random.rand,
    int: random.int,
    pick: random.pick,
    shuffle: random.shuffle,
    noise2: noise.noise2,
    noise3: noise.noise3,
    fbm: noise.fbm,
    poisson(width: number, height: number, radius: number, max?: number) {
      return poissonDisk(width, height, radius, poissonRandom.random, max);
    },
    delaunay: buildDelaunay,
    count(n: number): number {
      return scaledCount(n, numberParam(params, 'density') ?? 1, governor.quality);
    },
    get quality(): number {
      return governor.quality;
    },
    onQuality(fn) {
      if (typeof fn === 'function') qualityFns.push(fn);
    },
    tick(fn) {
      if (typeof fn !== 'function' || disposed) return;
      tickFns.push(fn);
      queueStill();
    },
    fixedTick(fn, fixedOptions) {
      const simulation = createFixedStep(fn, fixedOptions);
      const update = (time: SceneTime): void => {
        if (!editor && !stillMode) simulation.advance(time.dt);
      };
      function unsubscribe(): void {
        simulation.dispose();
        const index = tickFns.indexOf(update);
        if (index >= 0) tickFns.splice(index, 1);
      }
      if (disposed) {
        simulation.dispose();
        return unsubscribe;
      }
      tickFns.push(update);
      cleanups.push(unsubscribe);
      return unsubscribe;
    },
    story(chapters, initial) {
      if (disposed) throw new Error('scene has been disposed');
      const story = createStory(
        chapters.map((chapter) => ({
          ...chapter,
          enter() {
            chapter.enter?.();
            // Manual chapter navigation stays usable after the reduced-motion still frame.
            if (stillMode) render();
          },
        })),
        initial,
      );
      cleanups.push(() => {
        story.dispose();
      });
      return story;
    },
    still(fn) {
      if (typeof fn !== 'function' || disposed) return;
      stillFns.push(fn);
      queueStill();
    },
    onResize(fn) {
      if (typeof fn === 'function') resizeFns.push(fn);
    },
    text(text, style) {
      return createSceneText(PIXI, text, style, { rtl, fontFamily });
    },
    words: splitWords,
    texture(url: string): Promise<unknown> {
      const value = String(url ?? '').trim();
      if (admittedMediaUrl(value, 'image') === undefined) {
        return Promise.reject(
          new Error(
            `s.texture: only https:, data:image/ and blob: URLs load (got "${value.slice(0, 60)}")`,
          ),
        );
      }
      return namespace.Assets.load({ src: value, parser: 'texture' }).then((texture) => {
        if (stillMode) timers.push(setTimeout(render, 0));
        return texture;
      });
    },
    svg(markup: string): unknown {
      return new namespace.Graphics().svg(String(markup ?? ''));
    },
    shader(fragment: string, uniforms?: Record<string, unknown>): unknown {
      const handle = createShaderFilter(PIXI, fragment, uniforms ?? {}, {
        width: app.screen.width,
        height: app.screen.height,
      });
      handle.update(
        clock.time.t,
        app.screen.width,
        app.screen.height,
        pointerTracker.pointer.nx,
        pointerTracker.pointer.ny,
      );
      shaders.push(handle);
      return handle.filter;
    },
    rt(width?: number, height?: number): unknown {
      const texture = namespace.RenderTexture.create({
        width: Math.max(1, Math.round(width ?? app.screen.width)),
        height: Math.max(1, Math.round(height ?? app.screen.height)),
        resolution: app.renderer.resolution,
      });
      renderTextures.push(texture);
      return texture;
    },
    sound,
    editor,
    reducedMotion,
    rtl,
    lang,
    dir: rtl ? -1 : 1,
    dispose(fn) {
      ck.onDispose(fn);
    },
  };
  return scene;
}
