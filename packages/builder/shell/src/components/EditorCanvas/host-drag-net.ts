import type { DragSession } from '../../overlay/drag-session';
import type { CanvasDragHandle } from './EditorCanvas.types';

interface Ref<T> {
  current: T;
}

export interface HostDragNetInputs {
  session: DragSession;
  frame: HTMLIFrameElement;
  /** The frame bridge's host→frame mapping. */
  toFrame: (hostX: number, hostY: number) => { x: number; y: number };
  onDragHandleRef: Ref<((handle: CanvasDragHandle) => void) | undefined>;
}

/**
 * Host-side safety net (PERMANENT listeners, removed by the machinery's own
 * cleanup — no per-gesture attachment can leak). Cross-document routing is
 * the whole story here: once the pointer leaves the iframe, the FRAME
 * document stops receiving the gesture and the HOST receives it instead —
 * without this net a drag that leaves the canvas would stay `active`
 * forever and hijack the next unrelated gesture. Coordinates are bridged in
 * toFrame — the ONE place the two spaces meet (006 contract p3); out-of-
 * viewport values are the session's own no-target signal (s6).
 *
 * Attached only on editable canvases (the only ones with a drag session).
 * Returns the detach function.
 */
export function attachHostDragNet({
  session,
  frame,
  toFrame,
  onDragHandleRef,
}: HostDragNetInputs): () => void {
  const hostDocument = frame.ownerDocument;
  const hostWindow = hostDocument.defaultView;
  const onHostPointerMove = (event: PointerEvent) => {
    if (session.phase() !== 'idle') {
      const at = toFrame(event.clientX, event.clientY);
      session.move(at.x, at.y);
    }
  };
  const onHostPointerUp = () => {
    // NO suppress flag here: a host-side release never synthesizes a frame
    // click, and setting it would swallow the next legitimate canvas click.
    if (session.phase() !== 'idle') {
      session.release();
    }
  };
  const onHostBlur = () => {
    if (session.phase() === 'idle') {
      return;
    }
    /*
      Only a blur that takes focus OUT OF THE APP cancels a drag.

      The canvas lives in an iframe, so pressing a block moves focus into that
      iframe and the host document fires `blur` — every real internal drag,
      every time. This handler cancelled on that, so a person could pick a
      block up, watch the ghost and the drop indicator follow their pointer,
      release, and have nothing happen. Measured in a browser: ghost shown,
      indicator on target, release announced "Drag cancelled", zero
      transactions.

      No test caught it because the drag stories dispatch synthetic events
      straight at the frame document — synthetic events move no focus, so the
      blur never fired in a test.

      `hasFocus()` is the distinction the spec already draws: it stays true
      while focus is anywhere inside this document OR a descendant browsing
      context, and goes false when the window or tab loses focus — which is
      the case this cancel was written for.
    */
    if (!hostDocument.hasFocus()) {
      session.cancel(); // the gesture's events are gone for good — zero trace
    }
  };
  hostDocument.addEventListener('pointermove', onHostPointerMove);
  hostDocument.addEventListener('pointerup', onHostPointerUp);
  hostWindow?.addEventListener('blur', onHostBlur);
  // The palette's entry point rides the same net — press only; activation
  // still requires crossing the threshold (a palette CLICK stays a click).
  onDragHandleRef.current?.({
    beginInsert(type, hostX, hostY, onDrop) {
      const start = toFrame(hostX, hostY);
      session.press({ kind: 'insert', type, onDrop }, start.x, start.y, 'handle');
      return { didActivate: () => session.lastGestureActivated() };
    },
    beginTreeInsert(node, label, hostX, hostY, options) {
      const start = toFrame(hostX, hostY);
      session.press({ kind: 'tree-insert', node, label, ...options }, start.x, start.y, 'handle');
      return { didActivate: () => session.lastGestureActivated() };
    },
  });
  return () => {
    hostDocument.removeEventListener('pointermove', onHostPointerMove);
    hostDocument.removeEventListener('pointerup', onHostPointerUp);
    hostWindow?.removeEventListener('blur', onHostBlur);
  };
}
