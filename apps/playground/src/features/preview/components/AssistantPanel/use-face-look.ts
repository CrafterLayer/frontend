import { useState, type RefCallback } from 'react';

/**
 * The seat contract, from the panel's side.
 *
 * The face is stateless and reads two custom properties and one attribute
 * from the element that holds it (its "seat"): `--pg-face-look-x` and
 * `--pg-face-look-y` (px, |x| ≤ 1.4, |y| ≤ 1) move his eyes toward the
 * pointer, and `data-press` boops the disc. This hook writes them straight
 * onto the DOM — no React state, no re-render, no prop — because a pointer
 * moves sixty times a second and a face that re-renders the panel for each
 * frame is a face nobody keeps.
 *
 * Two elements take part: the ZONE the pointer is watched over (the header,
 * or the empty state) and the SEAT inside it. He watches you cross the header,
 * not while you type: the composer is outside every zone.
 */
export interface FaceLookRefs {
  readonly watchZone: RefCallback<HTMLElement>;
  readonly holdSeat: RefCallback<HTMLElement>;
}

const LOOK_X = '--pg-face-look-x';
const LOOK_Y = '--pg-face-look-y';
const PRESS = 'data-press';
const PRESS_TIMEOUT_MS = 600;
/** Full glance at four seat widths / three seat heights from the centre. */
const REACH_X = 4;
const REACH_Y = 3;
const RANGE_X = 1.4;
const RANGE_Y = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A length that prints as a person would write it: `0.35px`, never `0.35000000000000003px`. */
function px(value: number): string {
  return `${String(Number(value.toFixed(3)))}px`;
}

/**
 * Whether the room can hover and has not asked for stillness. A missing
 * `matchMedia` (jsdom) counts as hover-capable and not reduced.
 */
function canFollow(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return (
    window.matchMedia('(hover: hover)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface Controller {
  zone: HTMLElement | null;
  seat: HTMLElement | null;
  frame: number | null;
  pointer: { x: number; y: number } | null;
  pressTimeout: ReturnType<typeof setTimeout> | null;
  detachZone: (() => void) | null;
  detachSeat: (() => void) | null;
}

function createController(): Controller {
  return {
    zone: null,
    seat: null,
    frame: null,
    pointer: null,
    pressTimeout: null,
    detachZone: null,
    detachSeat: null,
  };
}

function writeLook(seat: HTMLElement, x: number, y: number): void {
  seat.style.setProperty(LOOK_X, px(x));
  seat.style.setProperty(LOOK_Y, px(y));
}

function lookAt(seat: HTMLElement, clientX: number, clientY: number): void {
  const box = seat.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) {
    writeLook(seat, 0, 0);
    return;
  }
  const centreX = box.left + box.width / 2;
  const centreY = box.top + box.height / 2;
  const x = clamp((clientX - centreX) / (REACH_X * box.width), -1, 1) * RANGE_X;
  const y = clamp((clientY - centreY) / (REACH_Y * box.height), -1, 1) * RANGE_Y;
  writeLook(seat, x, y);
}

function cancelFrame(controller: Controller): void {
  if (controller.frame !== null) {
    cancelAnimationFrame(controller.frame);
    controller.frame = null;
  }
  controller.pointer = null;
}

function clearPress(controller: Controller): void {
  if (controller.pressTimeout !== null) {
    clearTimeout(controller.pressTimeout);
    controller.pressTimeout = null;
  }
  controller.seat?.removeAttribute(PRESS);
}

function attachZone(controller: Controller, zone: HTMLElement): void {
  controller.zone = zone;
  if (!canFollow()) return;

  const onMove = (event: PointerEvent): void => {
    // One write per frame, reading the LAST position the pointer reached.
    controller.pointer = { x: event.clientX, y: event.clientY };
    if (controller.frame !== null) return;
    controller.frame = requestAnimationFrame(() => {
      controller.frame = null;
      const seat = controller.seat;
      const pointer = controller.pointer;
      controller.pointer = null;
      if (seat === null || pointer === null) return;
      lookAt(seat, pointer.x, pointer.y);
    });
  };
  const onLeave = (): void => {
    // A frame still pending when the pointer leaves is dropped, not applied late.
    cancelFrame(controller);
    if (controller.seat !== null) writeLook(controller.seat, 0, 0);
  };

  zone.addEventListener('pointermove', onMove);
  zone.addEventListener('pointerleave', onLeave);
  zone.addEventListener('pointercancel', onLeave);
  controller.detachZone = () => {
    zone.removeEventListener('pointermove', onMove);
    zone.removeEventListener('pointerleave', onLeave);
    zone.removeEventListener('pointercancel', onLeave);
  };
}

function detachZone(controller: Controller): void {
  controller.detachZone?.();
  controller.detachZone = null;
  cancelFrame(controller);
  if (controller.seat !== null) {
    controller.seat.style.removeProperty(LOOK_X);
    controller.seat.style.removeProperty(LOOK_Y);
  }
  controller.zone = null;
}

function attachSeat(controller: Controller, seat: HTMLElement): void {
  controller.seat = seat;

  // Pressing him must never move the composer's caret: a mousedown that is
  // not prevented would take focus from the textarea.
  const onMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
  };
  const release = (): void => {
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
    clearPress(controller);
  };
  const onPointerDown = (): void => {
    seat.setAttribute(PRESS, '');
    window.addEventListener('pointerup', release, { once: true });
    window.addEventListener('pointercancel', release, { once: true });
    if (controller.pressTimeout !== null) clearTimeout(controller.pressTimeout);
    // A lift that never arrives (the pointer left the window) still lets go.
    controller.pressTimeout = setTimeout(release, PRESS_TIMEOUT_MS);
  };

  seat.addEventListener('mousedown', onMouseDown);
  seat.addEventListener('pointerdown', onPointerDown);
  controller.detachSeat = () => {
    seat.removeEventListener('mousedown', onMouseDown);
    seat.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
  };
}

function detachSeat(controller: Controller): void {
  controller.detachSeat?.();
  controller.detachSeat = null;
  clearPress(controller);
  cancelFrame(controller);
  if (controller.seat !== null) {
    controller.seat.style.removeProperty(LOOK_X);
    controller.seat.style.removeProperty(LOOK_Y);
  }
  controller.seat = null;
}

/**
 * Two ref callbacks, stable for the life of the component. Attach `watchZone`
 * to the element the pointer is watched over and `holdSeat` to the element that
 * wraps the face. Either may attach first, and React's StrictMode
 * null → el → null → el dance is handled: every detach removes what its attach
 * added, properties included.
 */
export function useFaceLook(): FaceLookRefs {
  // Lazy state, never updated: one controller per component, no ref read
  // during render, and the two callbacks keep their identity for good.
  const [refs] = useState<FaceLookRefs>(() => {
    const controller = createController();
    return {
      watchZone: (zone) => {
        detachZone(controller);
        if (zone !== null) attachZone(controller, zone);
      },
      holdSeat: (seat) => {
        detachSeat(controller);
        if (seat !== null) attachSeat(controller, seat);
      },
    };
  });
  return refs;
}
