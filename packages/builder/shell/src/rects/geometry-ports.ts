/**
 * Injectable geometry primitives (005 contract §1). jsdom has no layout, so the
 * system implementations are defaults and tests inject fakes — the same Law-D
 * port philosophy the kernel applies to time and identity.
 *
 * Coordinate space: PREVIEW-LOCAL (the frame's own viewport). The chrome layer
 * overlays the frame exactly, so preview-local equals layer-local — outlines
 * apply these numbers directly, and pointer events from the frame document are
 * already in this space. No host-offset bookkeeping exists anywhere.
 */
export interface GeometryPorts {
  /** Measure `element` in preview-local coordinates. */
  measure(element: HTMLElement): { x: number; y: number; width: number; height: number };
  /** Point hit-test inside the frame document (preview-local coordinates). */
  hitTest(frameDocument: Document, clientX: number, clientY: number): Element | null;
  /** Frame-rhythm scheduler; returns a cancel function. */
  schedule(callback: () => void): () => void;
  /**
   * The preview viewport's size — the drag session uses it to distinguish
   * "empty area INSIDE the canvas" from "pointer left the canvas entirely"
   * (outside ⇒ no target, release cancels). jsdom reports 0×0, so tests inject.
   */
  viewport(frame: HTMLIFrameElement): { width: number; height: number };
}

export function systemGeometryPorts(): GeometryPorts {
  return {
    measure(element) {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    },
    hitTest(frameDocument, clientX, clientY) {
      // jsdom documents lack elementFromPoint entirely; a layout-less host
      // simply has no hit-testing (tests inject their own port).
      if (typeof frameDocument.elementFromPoint !== 'function') {
        return null;
      }
      return frameDocument.elementFromPoint(clientX, clientY);
    },
    schedule(callback) {
      const handle = requestAnimationFrame(callback);
      return () => {
        cancelAnimationFrame(handle);
      };
    },
    viewport(frame) {
      return { width: frame.clientWidth, height: frame.clientHeight };
    },
  };
}
