import { useRef } from 'react';
import type { PointerEvent } from 'react';

/** The modifier keys a scrub or click was made with (the box-model rules). */
export interface ScrubModifiers {
  /** Shift: apply to all sides. */
  readonly all: boolean;
  /** Alt: apply to the opposite pair too. */
  readonly pair: boolean;
}

export interface ScrubDelta {
  /** Pointer travel along the inline axis of the screen, in CSS pixels (rightwards positive). */
  readonly dx: number;
  /** Pointer travel downwards, in CSS pixels. */
  readonly dy: number;
}

export interface ScrubHandlers {
  /** Live preview while dragging. Never a document write. */
  readonly onPreview: (delta: ScrubDelta, modifiers: ScrubModifiers) => void;
  /** Called ONCE on pointerup after a real drag. */
  readonly onCommit: (delta: ScrubDelta, modifiers: ScrubModifiers) => void;
  /** Called when the drag is abandoned (pointercancel) so the preview can be undone. */
  readonly onCancel: () => void;
}

/** Travel below this is a click, not a drag. */
const DRAG_THRESHOLD = 3;

interface Session {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  dragging: boolean;
}

function modifiersOf(event: { shiftKey: boolean; altKey: boolean }): ScrubModifiers {
  return { all: event.shiftKey, pair: event.altKey };
}

/**
 * Pointer scrubbing for a value button: drag previews on every move and
 * commits once on release; a press without travel stays a click (the
 * element's own onClick still fires). The handlers are spread on the button.
 */
export function useScrub(handlers: ScrubHandlers): {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  /** True right after a drag, so the click that follows pointerup can be ignored. */
  readonly consumeDrag: () => boolean;
} {
  const session = useRef<Session | null>(null);
  const justDragged = useRef(false);

  return {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      session.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dragging: false,
      };
      justDragged.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      const active = session.current;
      if (active?.pointerId !== event.pointerId) return;
      const delta = { dx: event.clientX - active.x, dy: event.clientY - active.y };
      if (!active.dragging && Math.max(Math.abs(delta.dx), Math.abs(delta.dy)) < DRAG_THRESHOLD) {
        return;
      }
      active.dragging = true;
      handlers.onPreview(delta, modifiersOf(event));
    },
    onPointerUp: (event) => {
      const active = session.current;
      if (active?.pointerId !== event.pointerId) return;
      session.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (!active.dragging) return;
      justDragged.current = true;
      handlers.onCommit(
        { dx: event.clientX - active.x, dy: event.clientY - active.y },
        modifiersOf(event),
      );
    },
    onPointerCancel: (event) => {
      const active = session.current;
      if (active?.pointerId !== event.pointerId) return;
      session.current = null;
      if (active.dragging) handlers.onCancel();
    },
    consumeDrag: () => {
      const dragged = justDragged.current;
      justDragged.current = false;
      return dragged;
    },
  };
}
