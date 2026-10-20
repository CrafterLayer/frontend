import type { SceneApp } from './types';
import { sceneScrollViewport } from './scroll-viewport';

interface PinContext {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly app: SceneApp;
  readonly win: Window;
}

/** Restore only properties still carrying the value this runtime wrote. */
function ownedStyle(element: HTMLElement, key: string) {
  const original = element.style.getPropertyValue(key);
  const priority = element.style.getPropertyPriority(key);
  let written: string | undefined;
  return {
    set(value: string) {
      if (written !== undefined && element.style.getPropertyValue(key) !== written) return;
      element.style.setProperty(key, value);
      written = element.style.getPropertyValue(key);
    },
    restore() {
      if (written === undefined || element.style.getPropertyValue(key) !== written) return;
      if (original === '') element.style.removeProperty(key);
      else element.style.setProperty(key, original, priority);
      written = undefined;
    },
  };
}

/**
 * Reserve a scroll span on the existing region, then keep only its runtime-owned canvas in view.
 * No authored nodes are reparented: React, overlay selection and native scrolling keep ownership.
 * Position follows the actual scroller, so intermediate overflow clipping cannot defeat CSS sticky.
 */
export function pinSceneViewport({ root, canvas, app, win }: PinContext, screens: number) {
  const minHeight = ownedStyle(root, 'min-height');
  const top = ownedStyle(canvas, 'top');
  const width = ownedStyle(canvas, 'width');
  const height = ownedStyle(canvas, 'height');
  const priorResizeTo = app.resizeTo;
  const pinMarker = canvas.getAttribute('data-ck-scroll-pinned');
  canvas.setAttribute('data-ck-scroll-pinned', 'true');
  app.resizeTo = undefined;
  let disposed = false;
  let viewHeight = 0;
  let frameHeight = 0;
  let lastWidth = -1;
  let lastViewport = -1;
  let span = 1;

  function refresh(): void {
    const viewport = sceneScrollViewport(root, win);
    const nextWidth = root.clientWidth;
    if (nextWidth === lastWidth && viewport.height === lastViewport) return;
    lastWidth = nextWidth;
    lastViewport = viewport.height;
    // Read authored height before adding the runway; repeated ResizeObserver callbacks stay inert.
    minHeight.restore();
    const naturalHeight = root.getBoundingClientRect().height;
    viewHeight = viewport.height;
    frameHeight = Math.max(1, Math.min(naturalHeight || viewHeight, viewHeight));
    span = Math.max(1, viewHeight * screens);
    minHeight.set(`${String(frameHeight + span)}px`);
    app.renderer.resize?.(Math.max(1, nextWidth), frameHeight);
    width.set(`${String(Math.max(1, nextWidth))}px`);
    height.set(`${String(frameHeight)}px`);
  }

  function measure(): number {
    if (disposed) return 0;
    refresh();
    const viewport = sceneScrollViewport(root, win);
    const rect = root.getBoundingClientRect();
    const offset = Math.max(0, Math.min(span, viewport.top - rect.top));
    top.set(`${String(offset)}px`);
    // A short end hold makes the final beat visible before the canvas leaves the viewport.
    return Math.max(0, Math.min(1, offset / Math.max(1, span - viewHeight * 0.15)));
  }

  measure();
  return {
    measure,
    dispose() {
      if (disposed) return;
      disposed = true;
      minHeight.restore();
      top.restore();
      width.restore();
      height.restore();
      if (canvas.getAttribute('data-ck-scroll-pinned') === 'true') {
        if (pinMarker === null) canvas.removeAttribute('data-ck-scroll-pinned');
        else canvas.setAttribute('data-ck-scroll-pinned', pinMarker);
      }
      app.resizeTo ??= priorResizeTo;
      app.resize?.();
    },
  };
}
