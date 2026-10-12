import { useLayoutEffect } from 'react';

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
 */
export function useCanvasZoom(
  zoom: number,
  zoomRef: { current: number },
  layerRef: { readonly current: HTMLElement | null },
  machineryRef: { readonly current: { readonly anchors: { refresh: () => void } } | null },
): void {
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    layerRef.current?.style.setProperty(CANVAS_ZOOM_PROPERTY, String(zoom));
    machineryRef.current?.anchors.refresh();
  }, [zoom, zoomRef, layerRef, machineryRef]);
}
