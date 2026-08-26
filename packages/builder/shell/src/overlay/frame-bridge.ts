import type { FloatingBox } from './floating-position';

/**
 * The ONE place host space and frame space meet (006 contract p3, 009 §7 c1).
 *
 * Two documents, two coordinate spaces: the preview content lives inside the
 * iframe, the chrome lives in the host. Everything that crosses does it here —
 * so there is exactly one function to audit, one place a future zoom or device
 * scale multiplies, and no chance of a second, subtly different conversion
 * appearing somewhere else (the failure mode visible in the prior art, where
 * frame offset, scroll, and zoom are folded in by hand across several files).
 *
 * Layer-local coordinates ARE preview-local (005 §1): the overlay layer shares
 * the frame's origin. That is why anchors never convert — only DECISIONS that
 * depend on the host viewport (does a toolbar fit above?) consult `frameBox`.
 */
export interface FrameBridge {
  /** Host viewport coordinates → frame (and therefore layer-local) coordinates. */
  toFrame: (hostX: number, hostY: number) => { x: number; y: number };
  /** Frame/layer-local coordinates → host viewport coordinates. */
  toHost: (frameX: number, frameY: number) => { x: number; y: number };
  /** The frame's own box in host space (position + size). */
  frameBox: () => FloatingBox;
  /** The host viewport, for collision decisions. */
  hostViewport: () => { width: number; height: number };
  /** The frame's visible content area in layer-local space. */
  visibleArea: () => { width: number; height: number };
}

export function createFrameBridge(frame: HTMLIFrameElement): FrameBridge {
  const box = () => frame.getBoundingClientRect();
  return {
    toFrame: (hostX, hostY) => {
      const rect = box();
      return { x: hostX - rect.x, y: hostY - rect.y };
    },
    toHost: (frameX, frameY) => {
      const rect = box();
      return { x: frameX + rect.x, y: frameY + rect.y };
    },
    frameBox: () => {
      const rect = box();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    },
    hostViewport: () => {
      const view = frame.ownerDocument.defaultView;
      /* v8 ignore next 3 -- a mounted iframe always has a defaultView. */
      if (view === null) {
        return { width: 0, height: 0 };
      }
      return { width: view.innerWidth, height: view.innerHeight };
    },
    visibleArea: () => {
      const rect = box();
      return { width: rect.width, height: rect.height };
    },
  };
}
