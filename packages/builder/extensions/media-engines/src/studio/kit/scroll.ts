/*
  s.scroll for the scene kit (pixi-studio §B.2).

  - progress: 0 when the region's top meets the viewport's bottom, 1 when its bottom leaves the
    viewport's top (linear in between, clamped);
  - velocity: signed scroll speed in VIEWPORT HEIGHTS per second, smoothed and decaying to 0
    (a fast flick is around 2..6);
  - visible: the region intersects the viewport (fed by the kit's IntersectionObserver).
  Ordinary progress reads only. Explicit pin() reserves a native scroll span for narrative scenes.
*/

import type { SceneApp } from './types';
import { pinSceneViewport } from './scroll-pin';
import { sceneScrollViewport } from './scroll-viewport';

export interface SceneScroll {
  progress: number;
  velocity: number;
  visible: boolean;
  /** Pin the runtime canvas for 1–8 viewport heights (default 3); inert in editor/calm mode. */
  pin(screens?: number): () => void;
}

export interface ScrollTracker {
  scroll: SceneScroll;
  pointerElement: () => HTMLElement;
  update(dtSeconds: number): void;
  setVisible(visible: boolean): void;
  dispose: () => void;
}

export function scrollProgress(top: number, height: number, viewport: number): number {
  const span = viewport + height;
  if (!(span > 0)) return 0;
  return Math.max(0, Math.min(1, (viewport - top) / span));
}

export function createScrollTracker(
  el: HTMLElement,
  win: Window,
  scene?: { canvas: HTMLCanvasElement; app: SceneApp; calm: boolean; scrub?: boolean },
): ScrollTracker {
  let pinned: ReturnType<typeof pinSceneViewport> | undefined;
  let disposed = false;
  function unpin(): void {
    pinned?.dispose();
    pinned = undefined;
  }
  const scroll: SceneScroll = {
    progress: 0,
    velocity: 0,
    visible: true,
    pin(screens = 3) {
      if (disposed || scene === undefined || scene.calm) return () => undefined;
      pinned ??= pinSceneViewport(
        {
          root: el,
          win,
          canvas: scene.canvas,
          app: scene.app,
        },
        Number.isFinite(screens) ? Math.max(1, Math.min(8, screens)) : 3,
      );
      measure();
      return unpin;
    },
  };
  let lastTop = el.getBoundingClientRect().top;
  let pending = 0;

  function measure(): void {
    try {
      const rect = el.getBoundingClientRect();
      const viewport = sceneScrollViewport(el, win);
      pending += lastTop - rect.top;
      lastTop = rect.top;
      scroll.progress =
        pinned?.measure() ?? scrollProgress(rect.top - viewport.top, rect.height, viewport.height);
    } catch {
      // Detached: keep the last value.
    }
  }

  function onScroll(): void {
    measure();
  }

  const options: AddEventListenerOptions = { passive: true, capture: true };
  win.addEventListener('scroll', onScroll, options);
  win.addEventListener('resize', onScroll, options);
  measure();
  if (scene?.scrub === true) scroll.pin();

  return {
    scroll,
    pointerElement: () => (pinned === undefined ? el : (scene?.canvas ?? el)),
    update(dtSeconds: number): void {
      measure();
      const dt = Math.max(1 / 240, dtSeconds);
      const viewport = sceneScrollViewport(el, win).height;
      const instant = pending / viewport / dt;
      pending = 0;
      // Rise fast, fall smoothly.
      const blend = Math.abs(instant) > Math.abs(scroll.velocity) ? 0.5 : 1 - Math.exp(-dt * 4);
      scroll.velocity += (instant - scroll.velocity) * blend;
      if (Math.abs(scroll.velocity) < 1e-3) scroll.velocity = 0;
    },
    setVisible(visible: boolean): void {
      scroll.visible = visible;
    },
    dispose(): void {
      disposed = true;
      win.removeEventListener('scroll', onScroll, options);
      win.removeEventListener('resize', onScroll, options);
      unpin();
    },
  };
}
