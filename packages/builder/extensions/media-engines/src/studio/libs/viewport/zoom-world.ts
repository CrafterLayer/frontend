/*
  The camera behind `ck.scene({ libs: ['viewport'], design: { …, zoom: true } })` (responsive
  scenes, 2026-10-13): `s.world` becomes a pixi-viewport Viewport over the design, fitted like a
  plain design world (the fitted scale is the furthest zoom out) and clamped to the design.

  It never traps the page: the wheel zooms only with ctrl / ⌘ (a trackpad pinch sends ctrl) or
  while the canvas has focus — otherwise the page scrolls, untouched; on touch one finger scrolls
  the page (touch-action pan-x pan-y) and two fingers pan and pinch. No inertia under reduced
  motion, where the ticker is stopped, so every move clamps and renders at once. The editor
  canvas gets the fitted world and no gestures at all.

  Built here, inside ck-lib-viewport.js, so the camera code ships only with scenes that list
  'viewport'; the kit reaches it as `s.lib.viewport.zoomWorld` (kit/design.ts).
*/

import type { Viewport } from 'pixi-viewport';
import type { EventSystem, Ticker } from 'pixi.js';

import type { DesignZoom, DesignZoomHost } from '../../kit/design';

export function createZoomWorld(View: typeof Viewport, host: DesignZoomHost): DesignZoom {
  const app = host.app as { renderer: { events: EventSystem }; ticker: Ticker };
  const view = new View({
    screenWidth: 1,
    screenHeight: 1,
    worldWidth: host.width,
    worldHeight: host.height,
    events: app.renderer.events,
    ticker: app.ticker,
    passiveWheel: false,
  });
  const doc = host.root.ownerDocument;
  const align = host.align === 'top' || host.align === 'bottom' ? host.align : 'center';
  const maxZoom = Math.max(1, Number(host.maxZoom) || 4);
  /** The fitted (furthest-out) scale; 0 before the first fit. */
  let base = 0;
  let settling = false;

  /* Before the canvas hears the wheel (capture on an ancestor): zoom only when asked to. */
  function gate(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey || doc.activeElement === host.canvas) {
      view.plugins.resume('wheel');
    } else {
      view.plugins.pause('wheel');
    }
  }
  /* Reduced motion: no ticker runs the clamp, so a move clamps and renders right away. */
  function settle(): void {
    if (settling) return;
    settling = true;
    try {
      view.plugins.get('clamp')?.update();
      host.render();
    } finally {
      settling = false;
    }
  }
  const capture = { capture: true, passive: true };
  if (host.interactive) {
    view.drag({ wheel: false }).pinch().wheel().clamp({ direction: 'all', underflow: align });
    if (!host.calm) view.decelerate();
    host.root.addEventListener('wheel', gate, capture);
    host.canvas.style.touchAction = 'pan-x pan-y';
    host.canvas.style.pointerEvents = 'auto';
    if (host.calm) {
      view.on('moved', settle);
      view.on('zoomed', settle);
    }
  }

  return {
    world: view,
    fit(scale: number, x: number, y: number, screenWidth: number, screenHeight: number): void {
      // A resize keeps the visitor's zoom (relative to the fit) and the point they look at.
      const keep = host.interactive && base > 0;
      const zoom = keep ? view.scale.x / base : 1;
      const center = view.center;
      base = scale;
      view.resize(screenWidth, screenHeight, host.width, host.height);
      view.clampZoom({ minScale: scale, maxScale: scale * maxZoom });
      if (keep) {
        view.setZoom(scale * zoom);
        view.moveCenter(center);
        view.plugins.get('clamp')?.update();
      } else {
        view.scale.set(scale);
        view.position.set(x, y);
      }
    },
    dispose(): void {
      host.root.removeEventListener('wheel', gate, capture);
      view.destroy({ children: true });
    },
  };
}
