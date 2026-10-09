/*
  The rules every canvas scene obeys (media-motion DESIGN §0 laws 4, 5, 8 and
  §D.4), kept apart from Pixi so they can be tested without a GPU.

  A scene is decoration behind real HTML. It is never worth a spinning fan:
  - reduced motion: the engine is never mounted, the fallback image shows;
  - off-screen or a hidden tab: the ticker stops, and resumes when visible;
  - a still context (`ctx.still`): one frame is drawn, then nothing runs until
    Preview (`onPlay`) starts it, and `onStop` stops it again;
  - the editor canvas (`ctx.canvas`, gsap-pixi 2026-10-08) is NOT still: the
    scene runs while editing under the same off-screen / hidden-tab pauses, and
    the end of a Preview (`onStop`) returns it to running, never freezes it;
  - a lost WebGL context: the scene is destroyed and the fallback image stays;
  - DPR is capped at 2, and the dot count is capped and halved on weak devices;
  - RTL mirrors horizontal drift.

  Precedent: aceternity `CloudShader.tsx` (IntersectionObserver +
  visibilitychange + reduced-motion), which this generalises.
*/

import type { CkEngineContext } from './ck-engines';

/** Device-pixel-ratio ceiling: a 3x phone rendering a background at 3x is pure heat. */
export const DPR_CAP = 2;

/** The structural part of a window this module reads, so tests can pass a fake. */
export interface PolicyWindow {
  devicePixelRatio?: number;
  navigator?: { hardwareConcurrency?: number };
  matchMedia?: (query: string) => { matches: boolean };
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

function mediaMatches(win: PolicyWindow, query: string): boolean {
  try {
    return typeof win.matchMedia === 'function' && win.matchMedia(query).matches;
  } catch {
    return false;
  }
}

export function prefersReducedMotion(win: PolicyWindow): boolean {
  return mediaMatches(win, REDUCED_MOTION_QUERY);
}

/** Renderer resolution: the device's ratio, at least 1, at most {@link DPR_CAP}. */
export function sceneResolution(win: PolicyWindow): number {
  const ratio = Number(win.devicePixelRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 1;
  }
  return Math.min(Math.max(ratio, 1), DPR_CAP);
}

/** +1 left-to-right, -1 right-to-left: multiply every horizontal velocity by it. */
export function rtlSign(ctx: Pick<CkEngineContext, 'rtl'>): 1 | -1 {
  return ctx.rtl ? -1 : 1;
}

export type SceneDensity = 'low' | 'medium' | 'high';

/** Closed `data-ck-density` vocabulary → the most elements a scene may draw. */
export const DENSITY_CAPS: Readonly<Record<SceneDensity, number>> = Object.freeze({
  low: 36,
  medium: 72,
  high: 120,
});

export function readDensity(el: Element): SceneDensity {
  const value = el.getAttribute('data-ck-density');
  return value === 'low' || value === 'high' ? value : 'medium';
}

/** True on touch-first or low-core devices, where every count is halved. */
export function isConstrainedDevice(win: PolicyWindow): boolean {
  const cores = win.navigator?.hardwareConcurrency;
  return (
    mediaMatches(win, COARSE_POINTER_QUERY) ||
    (typeof cores === 'number' && cores > 0 && cores <= 4)
  );
}

/** The capped element count for a density, halved on a constrained device. */
export function densityCount(level: SceneDensity, win: PolicyWindow): number {
  const cap = DENSITY_CAPS[level];
  return isConstrainedDevice(win) ? Math.floor(cap / 2) : cap;
}

/** The two ticker verbs the policy needs: Pixi's `app.start()` / `app.stop()`. */
export interface PolicyTicker {
  start(): void;
  stop(): void;
}

export interface PlaybackPolicyOptions {
  el: HTMLElement;
  ctx: CkEngineContext;
  ticker: PolicyTicker;
  /** Draw exactly one frame (Pixi's `app.render()`). */
  renderOnce: () => void;
  /** Document whose visibility pauses the scene; defaults to `el.ownerDocument`. */
  doc?: Document;
  /** IntersectionObserver constructor; defaults to the element's window's. */
  IntersectionObserverImpl?: typeof IntersectionObserver | undefined;
}

export interface PlaybackPolicy {
  /** Whether the ticker is meant to be running right now. */
  readonly running: boolean;
  dispose(): void;
}

/**
 * Wire start/stop of the ticker to visibility, tab state and the editor's
 * still/Preview switch. Draws one frame immediately, so a still canvas is never
 * blank; a stopped ticker leaves the last presented frame on screen.
 */
export function attachPlaybackPolicy(options: PlaybackPolicyOptions): PlaybackPolicy {
  const { el, ctx, ticker, renderOnce } = options;
  const doc = options.doc ?? el.ownerDocument;
  const view = doc.defaultView;
  const IO =
    'IntersectionObserverImpl' in options
      ? options.IntersectionObserverImpl
      : (view?.IntersectionObserver ?? undefined);

  let disposed = false;
  let playing = !ctx.still;
  let inView = true;
  let running = false;

  const update = () => {
    if (disposed) {
      return;
    }
    const shouldRun = playing && inView && !doc.hidden;
    if (shouldRun === running) {
      return;
    }
    running = shouldRun;
    if (shouldRun) {
      ticker.start();
    } else {
      ticker.stop();
    }
  };

  renderOnce();
  ticker.stop();
  update();

  let observer: IntersectionObserver | undefined;
  if (IO !== undefined) {
    observer = new IO(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last !== undefined) {
          inView = last.isIntersecting;
          update();
        }
      },
      { rootMargin: '25% 0px' },
    );
    observer.observe(el);
  }

  const onVisibility = () => {
    update();
  };
  doc.addEventListener('visibilitychange', onVisibility);

  ctx.onPlay(() => {
    playing = true;
    update();
  });
  ctx.onStop(() => {
    // Back to the context's own state: still stops, a live scene (canvas included) keeps running.
    playing = !ctx.still;
    update();
  });

  return {
    get running() {
      return running;
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      observer?.disconnect();
      doc.removeEventListener('visibilitychange', onVisibility);
      if (running) {
        ticker.stop();
      }
      running = false;
    },
  };
}

/**
 * A lost WebGL context is not retried: the scene is torn down and the fallback
 * image (already under the canvas) is what the reader sees.
 */
export function watchContextLoss(canvas: HTMLCanvasElement, onLost: () => void): () => void {
  const handler = () => {
    onLost();
  };
  canvas.addEventListener('webglcontextlost', handler, { once: true });
  return () => {
    canvas.removeEventListener('webglcontextlost', handler);
  };
}
