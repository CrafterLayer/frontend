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

  HOST mode (gsap-pixi 2026-10-08): when the scene element holds content — any
  element child that is not an `img` (a registered section root, a customCode
  `section`) — the scene draws BEHIND that content instead of over a fallback:
  the element gets `data-ck-scene-host`, a `div[data-ck-scene-layer]
  [aria-hidden=true]` is prepended as its FIRST child (absolute, inset 0,
  z-index -1, no pointer events, clipped), and the host gets `isolation:
  isolate` plus `position: relative` when it computes static — inline, and
  restored on dispose — so the layer sits above the section background and
  below its content. No texture is loaded from a host (its imgs are content),
  the app resizes to the layer, and pointer input is read from the host.
  LAYER mode (a div with only img children) is unchanged.
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
  /**
   * Called once the app is initialised, before the scene is built. The bundle
   * uses it to drop Pixi's interaction ticker: no scene reads Pixi's own pointer
   * events, and that ticker kept a page at 60 requestAnimationFrame calls a
   * second with the scene off screen (walk 2026-10-08).
   */
  afterInit?(app: TApp): void;
  loadTexture(url: string): Promise<TTexture>;
  scenes: Readonly<Record<SceneName, SceneFactory<TApp, TTexture>>>;
}

export const READY_ATTR = 'data-ck-ready';
/** Set on a scene element in HOST mode (gsap-pixi 2026-10-08). */
export const HOST_ATTR = 'data-ck-scene-host';
/** The runtime layer a hosted scene draws into, the host's first child. */
export const LAYER_ATTR = 'data-ck-scene-layer';
const CANVAS_ATTR = 'data-ck-scene-canvas';

const noop = (): void => {
  /* nothing to undo */
};

/**
 * HOST mode: the scene element has an element child that is not an `img` (the
 * engine's own layer and canvas do not count, so a re-mount reads the same).
 */
export function isSceneHost(el: Element): boolean {
  for (const child of Array.from(el.children)) {
    if (
      child.localName === 'img' ||
      child.hasAttribute(LAYER_ATTR) ||
      child.hasAttribute(CANVAS_ATTR)
    ) {
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Prepare a host: the layer as its first child, `isolation: isolate` and (when
 * it computes static) `position: relative` inline. Returns the layer and the
 * undo, which restores the host's own inline values exactly.
 */
function prepareHost(el: HTMLElement, win: Window): { layer: HTMLElement; restore: () => void } {
  const doc = el.ownerDocument;
  const host = el.style;
  const hadStyle = el.hasAttribute('style');
  const previous = {
    isolation: host.getPropertyValue('isolation'),
    position: host.getPropertyValue('position'),
  };
  let computedPosition = '';
  try {
    computedPosition = win.getComputedStyle(el).position;
  } catch {
    computedPosition = '';
  }
  const positioned = computedPosition !== '' && computedPosition !== 'static';
  el.setAttribute(HOST_ATTR, '');
  host.setProperty('isolation', 'isolate');
  if (!positioned) {
    host.setProperty('position', 'relative');
  }

  const layer = doc.createElement('div');
  layer.setAttribute(LAYER_ATTR, '');
  layer.setAttribute('aria-hidden', 'true');
  const style = layer.style;
  style.setProperty('position', 'absolute');
  style.setProperty('inset', '0');
  style.setProperty('z-index', '-1');
  style.setProperty('pointer-events', 'none');
  style.setProperty('overflow', 'hidden');
  el.insertBefore(layer, el.firstChild);

  const put = (name: 'isolation' | 'position', value: string) => {
    if (value === '') {
      host.removeProperty(name);
    } else {
      host.setProperty(name, value);
    }
  };
  let restored = false;
  return {
    layer,
    restore: () => {
      if (restored) {
        return;
      }
      restored = true;
      layer.remove();
      el.removeAttribute(HOST_ATTR);
      put('isolation', previous.isolation);
      if (!positioned) {
        put('position', previous.position);
      }
      if (!hadStyle && (el.getAttribute('style') ?? '').trim() === '') {
        el.removeAttribute('style');
      }
    },
  };
}

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
  canvas.setAttribute(CANVAS_ATTR, '');
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
      // gsap-pixi additions (2026-10-08): HOST mode, read once at mount (see the header).
      const hosted = isSceneHost(el);
      let restoreHost: () => void = noop;

      let disposed = false;
      // Read through a function: TS would otherwise narrow `disposed` to false across the awaits.
      const isDisposed = () => disposed;
      let teardown: () => void = noop;

      const run = async () => {
        // A host's imgs are content: no texture is loaded from it.
        const textures: TTexture[] = hosted
          ? []
          : await Promise.all(imageSources(el).map((src) => deps.loadTexture(src)));
        if (isDisposed()) {
          return;
        }
        let surface: HTMLElement = el;
        if (hosted) {
          const prepared = prepareHost(el, win);
          surface = prepared.layer;
          restoreHost = prepared.restore;
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
          restoreHost();
          active.delete(el);
        };
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: sceneResolution(win),
          preference: 'webgl',
          resizeTo: surface,
          autoStart: false,
          sharedTicker: false,
        });
        if (isDisposed()) {
          teardown();
          return;
        }
        deps.afterInit?.(app);

        const canvas = app.canvas;
        // Only a live ripple on a published page takes pointer input; the editor canvas never does.
        styleCanvas(canvas, sceneName === 'ripple' && !ctx.still && ctx.canvas !== true);
        surface.appendChild(canvas);

        const density = readDensity(el);
        const sceneDispose = scene(app, el, {
          still: ctx.still,
          ...(ctx.canvas === undefined ? {} : { canvas: ctx.canvas }),
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
          pointerHost: hosted ? el : (el.parentElement ?? el),
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
            restoreHost();
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
          resizeObserver.observe(surface);
        }
        el.setAttribute(READY_ATTR, '');
      };

      run().catch(() => {
        // Texture CORS/404, no renderer, a scene error: the fallback image stays (a host is restored).
        teardown();
        restoreHost();
        active.delete(el);
      });

      return () => {
        disposed = true;
        teardown();
        restoreHost();
        active.delete(el);
      };
    },
  };
}
