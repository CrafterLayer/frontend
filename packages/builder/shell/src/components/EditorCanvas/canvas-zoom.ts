import { useLayoutEffect } from 'react';

import { CANVAS_VIEWPORT_HEIGHT_PROPERTY } from '@craftkit/builder-renderer';

/** The custom property CSS inside the overlay layer reads the canvas zoom from. */
export const CANVAS_ZOOM_PROPERTY = '--bldr-canvas-zoom';

/**
 * Publishes the canvas zoom to the chrome that must NOT zoom with the page.
 *
 * The overlay layer shares the frame's `scale(zoom)` (EditorCanvas.css), so
 * anything drawn in it shrinks with the content unless it undoes the zoom:
 *
 *   the floating hosts read `zoomRef` per placement (through the frame bridge)
 *                      and counter-scale themselves (overlay/floating-host.ts);
 *   CSS in the layer   reads `--bldr-canvas-zoom` — the quick bar's width cap,
 *                      outline strokes and name chips (overlay/overlay.css).
 *
 * A layout effect, so both land before the browser paints the new zoom; then
 * every toolbar re-places through the anchor channel.
 *
 * preview-fix (2026-10-12): and to the PAGE, the viewport height it is laid
 * out for. The frame is `100 / zoom` percent tall so the scaled frame fills the
 * column, which made its own `vh` grow with every step of zoom-out (a 70vh AI
 * story stage was 999px at "Fit · 57%", 604px in Preview). `--ck-vh` is one
 * hundredth of the frame's height at zoom 1 — its height times the zoom — and
 * custom-code regions read their viewport heights through it
 * (`canvasViewportHeightUnits`), so zoom changes how the page looks, not how it
 * is laid out.
 */
export function useCanvasZoom(
  zoom: number,
  zoomRef: { current: number },
  layerRef: { readonly current: HTMLElement | null },
  machineryRef: { readonly current: { readonly anchors: { refresh: () => void } } | null },
  frame?: HTMLIFrameElement | null,
): void {
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    layerRef.current?.style.setProperty(CANVAS_ZOOM_PROPERTY, String(zoom));
    machineryRef.current?.anchors.refresh();
  }, [zoom, zoomRef, layerRef, machineryRef]);

  useLayoutEffect(() => {
    const view = frame?.contentWindow ?? null;
    const root = frame?.contentDocument?.documentElement ?? null;
    if (view === null || root === null) return undefined;
    const publish = (): void => {
      root.style.setProperty(
        CANVAS_VIEWPORT_HEIGHT_PROPERTY,
        `${String((view.innerHeight * zoom) / 100)}px`,
      );
    };
    publish();
    view.addEventListener('resize', publish);
    return () => {
      view.removeEventListener('resize', publish);
      root.style.removeProperty(CANVAS_VIEWPORT_HEIGHT_PROPERTY);
    };
  }, [frame, zoom]);
}
