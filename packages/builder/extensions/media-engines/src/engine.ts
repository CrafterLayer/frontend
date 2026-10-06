/*
  The scene engine's mount, written against a structural app so the policy can
  be tested without WebGL. `entry.ts` supplies the real Pixi `Application`,
  `Assets.load` and the scene table; nothing here imports Pixi at runtime.

  Mount order (media-motion DESIGN §D.4):
  1. reduced motion → never mounted, the fallback `img` stays (and no request
     was made for the engine in the first place: the `engines` pack checks too);
  2. load every `img` child as a texture (`currentSrc || src`); any failure
     (CORS, 404) → stop here, fallback stays, `data-ck-ready` is never set;
  3. create the app on a runtime `<canvas aria-hidden role=presentation>`
     appended inside the scene element, DPR capped, WebGL preferred with Pixi's
     own fallback order;
  4. build the scene, draw the first frame, set `data-ck-ready` (CSS hides the
     fallback images only under it), then hand the ticker to the policy.
  Dispose → `app.destroy(true)` (removes the canvas) and removes `data-ck-ready`.
*/

import type { CkEngine, CkEngineContext } from './ck-engines';
import { readPalette, type ScenePalette } from './palette';
import {
  attachPlaybackPolicy,
  densityCount,
  prefersReducedMotion,
  readDensity,
  rtlSign,
  sceneResolution,
  watchContextLoss,
  type PlaybackPolicy,
  type SceneDensity,
} from './policy';

export const SCENE_NAMES = [
  'particles',
  'mesh-gradient',
  'parallax-layers',
  'mural',
  'ripple',
] as const;
export type SceneName = (typeof SCENE_NAMES)[number];

export function isSceneName(value: string | null): value is SceneName {
  return value !== null && (SCENE_NAMES as readonly string[]).includes(value);
}

/** The part of Pixi's `Application` the mount drives. */
export interface SceneApp {
  init(options: Record<string, unknown>): Promise<void>;
  readonly canvas: HTMLCanvasElement;
  start(): void;
  stop(): void;
  render(): void;
  resize?(): void;
  destroy(removeView?: boolean): void;
}

/** What a scene is handed beyond the app and its element. */
export interface SceneContext<TTexture> extends CkEngineContext {
  /** Textures of the element's `img` children, in document order (may be empty). */
  textures: TTexture[];
  palette: ScenePalette;
  density: SceneDensity;
  /** The capped element budget for this density on this device. */
  count: number;
  /** +1 LTR, -1 RTL: multiply horizontal velocities by it. */
  sign: 1 | -1;
  /** Where pointer input is read (the scene's parent section, else the element). */
  pointerHost: HTMLElement;
  /** The element's own window (the iframe's on the editor canvas). */
  win: Window;
}

export type SceneFactory<TApp, TTexture> = (
  app: TApp,
  el: HTMLElement,
  ctx: SceneContext<TTexture>,
) => () => void;

export interface SceneEngineDeps<TApp extends SceneApp, TTexture> {
  createApp(): TApp;
  loadTexture(url: string): Promise<TTexture>;
  scenes: Readonly<Record<SceneName, SceneFactory<TApp, TTexture>>>;
}

export const READY_ATTR = 'data-ck-ready';

const noop = (): void => {
  /* nothing to undo */
};

function imageSources(el: HTMLElement): string[] {
  const sources: string[] = [];
  for (const img of Array.from(el.querySelectorAll('img'))) {
    const src = img.currentSrc || img.src || (img.getAttribute('src') ?? '');
    if (src !== '') {
      sources.push(src);
    }
  }
  return sources;
}

function styleCanvas(canvas: HTMLCanvasElement, interactive: boolean): void {
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  canvas.setAttribute('data-ck-scene-canvas', '');
  const style = canvas.style;
  style.position = 'absolute';
  style.insetBlockStart = '0';
  style.insetInlineStart = '0';
  style.inlineSize = '100%';
  style.blockSize = '100%';
  style.display = 'block';
  style.pointerEvents = interactive ? 'auto' : 'none';
}

export function createSceneEngine<TApp extends SceneApp, TTexture>(
  deps: SceneEngineDeps<TApp, TTexture>,
): CkEngine {
  const active = new WeakSet<HTMLElement>();

  return {
    mount(el, ctx) {
      const doc = el.ownerDocument;
      const win = doc.defaultView;
      const sceneName = el.getAttribute('data-ck-scene');
      if (win === null || !isSceneName(sceneName) || active.has(el)) {
        return noop;
      }
      if (prefersReducedMotion(win)) {
        return noop;
      }
      const scene = deps.scenes[sceneName];
      active.add(el);

      let disposed = false;
      // Read through a function: TS would otherwise narrow `disposed` to false across the awaits.
      const isDisposed = () => disposed;
      let teardown: () => void = noop;

      const run = async () => {
        const textures = await Promise.all(imageSources(el).map((src) => deps.loadTexture(src)));
        if (isDisposed()) {
          return;
        }

        const app = deps.createApp();
        let appDestroyed = false;
        const destroyApp = () => {
          if (!appDestroyed) {
            appDestroyed = true;
            try {
              app.destroy(true);
            } catch {
              // A renderer that never finished initialising has nothing to free.
            }
          }
        };
        // Until the scene is fully built, a failure or a dispose frees the app alone.
        teardown = () => {
          teardown = noop;
          destroyApp();
          el.removeAttribute(READY_ATTR);
          active.delete(el);
        };
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: sceneResolution(win),
          preference: 'webgl',
          resizeTo: el,
          autoStart: false,
          sharedTicker: false,
        });
        if (isDisposed()) {
          teardown();
          return;
        }

        const canvas = app.canvas;
        styleCanvas(canvas, sceneName === 'ripple' && !ctx.still);
        el.appendChild(canvas);

        const density = readDensity(el);
        const sceneDispose = scene(app, el, {
          still: ctx.still,
          rtl: ctx.rtl,
          lang: ctx.lang,
          onPlay: (cb) => {
            ctx.onPlay(cb);
          },
          onStop: (cb) => {
            ctx.onStop(cb);
          },
          textures,
          palette: readPalette(el),
          density,
          count: densityCount(density, win),
          sign: rtlSign(ctx),
          pointerHost: el.parentElement ?? el,
          win,
        });

        const policy: PlaybackPolicy = attachPlaybackPolicy({
          el,
          ctx,
          ticker: {
            start: () => {
              app.start();
            },
            stop: () => {
              app.stop();
            },
          },
          renderOnce: () => {
            app.render();
          },
        });
        let resizeObserver: ResizeObserver | undefined;
        let stopContextWatch: () => void = noop;
        teardown = () => {
          teardown = noop;
          policy.dispose();
          resizeObserver?.disconnect();
          stopContextWatch();
          try {
            sceneDispose();
          } finally {
            destroyApp();
            el.removeAttribute(READY_ATTR);
            active.delete(el);
          }
        };

        stopContextWatch = watchContextLoss(canvas, () => {
          teardown();
        });
        // The element's own realm: on the editor canvas that is the iframe's window.
        const RO = (win as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
        if (typeof RO === 'function' && typeof app.resize === 'function') {
          resizeObserver = new RO(() => {
            app.resize?.();
          });
          resizeObserver.observe(el);
        }
        el.setAttribute(READY_ATTR, '');
      };

      run().catch(() => {
        // Texture CORS/404, no renderer, a scene error: the fallback image stays.
        teardown();
        active.delete(el);
      });

      return () => {
        disposed = true;
        teardown();
        active.delete(el);
      };
    },
  };
}
