/*
  s.pointer for the scene kit (pixi-studio §B.2).

  Passive WINDOW listeners, coordinates relative to the region, so a scene follows the pointer
  even with `pointer: false` (the canvas then takes no clicks and the page underneath keeps
  working). Touch is included: pointer events cover it, and a touch fallback is attached only
  where PointerEvent does not exist. Nothing here ever calls preventDefault or captures input,
  which is also what the editor canvas needs.
*/

export type PointerListener = (pointer: ScenePointer) => void;

export interface ScenePointer {
  /** CSS px relative to the region's top-left. Starts at the centre. */
  x: number;
  y: number;
  /** x / width and y / height (0..1 inside the region). */
  nx: number;
  ny: number;
  /** Smoothed velocity, CSS px per second; decays when the pointer rests. */
  vx: number;
  vy: number;
  down: boolean;
  /** The pointer is over the region's box. */
  inside: boolean;
  /** A pointer event arrived in the last 2.5 s (use it for idle wandering). */
  active: boolean;
  onDown(fn: PointerListener): void;
  onUp(fn: PointerListener): void;
  onMove(fn: PointerListener): void;
}

export interface PointerTracker {
  pointer: ScenePointer;
  /** Per tick: decay velocity, refresh `active`. */
  update(dtSeconds: number): void;
  dispose(): void;
}

const ACTIVE_MS = 2500;

interface ClientPoint {
  clientX: number;
  clientY: number;
}

export function createPointerTracker(
  el: Element,
  win: Window,
  now: () => number = () => Date.now(),
): PointerTracker {
  const downFns: PointerListener[] = [];
  const upFns: PointerListener[] = [];
  const moveFns: PointerListener[] = [];
  let lastEventAt = -Infinity;
  let lastMoveAt = -Infinity;

  function box(): { left: number; top: number; width: number; height: number } {
    try {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    } catch {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
  }

  const initial = box();
  const pointer: ScenePointer = {
    x: initial.width / 2,
    y: initial.height / 2,
    nx: 0.5,
    ny: 0.5,
    vx: 0,
    vy: 0,
    down: false,
    inside: false,
    active: false,
    onDown(fn) {
      if (typeof fn === 'function') downFns.push(fn);
    },
    onUp(fn) {
      if (typeof fn === 'function') upFns.push(fn);
    },
    onMove(fn) {
      if (typeof fn === 'function') moveFns.push(fn);
    },
  };

  function emit(list: readonly PointerListener[]): void {
    for (const fn of list) {
      try {
        fn(pointer);
      } catch (error) {
        // A throwing listener must not stop the others; surface it like a script error.
        setTimeout(() => {
          throw error;
        }, 0);
      }
    }
  }

  function locate(point: ClientPoint, moving: boolean): void {
    const rect = box();
    const x = point.clientX - rect.left;
    const y = point.clientY - rect.top;
    const time = now();
    if (moving && Number.isFinite(lastMoveAt)) {
      const dt = Math.max(1, time - lastMoveAt) / 1000;
      // Exponential smoothing keeps one jittery event from spiking the velocity.
      pointer.vx = pointer.vx * 0.6 + ((x - pointer.x) / dt) * 0.4;
      pointer.vy = pointer.vy * 0.6 + ((y - pointer.y) / dt) * 0.4;
    }
    if (moving) lastMoveAt = time;
    lastEventAt = time;
    pointer.x = x;
    pointer.y = y;
    pointer.nx = rect.width > 0 ? x / rect.width : 0.5;
    pointer.ny = rect.height > 0 ? y / rect.height : 0.5;
    pointer.inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    pointer.active = true;
  }

  const options: AddEventListenerOptions = { passive: true };
  const listeners: [string, EventListener][] = [];
  function listen(type: string, handler: (event: Event) => void): void {
    win.addEventListener(type, handler, options);
    listeners.push([type, handler]);
  }

  function firstTouch(event: Event): ClientPoint | undefined {
    const touches = (event as TouchEvent).changedTouches;
    const touch = touches !== undefined && touches.length > 0 ? touches[0] : undefined;
    return touch === undefined ? undefined : { clientX: touch.clientX, clientY: touch.clientY };
  }

  const hasPointerEvents = typeof (win as unknown as { PointerEvent?: unknown }).PointerEvent === 'function';
  if (hasPointerEvents) {
    listen('pointermove', (event) => {
      locate(event as PointerEvent, true);
      emit(moveFns);
    });
    listen('pointerdown', (event) => {
      locate(event as PointerEvent, false);
      if (!pointer.inside) return;
      pointer.down = true;
      emit(downFns);
    });
    const release = (event: Event): void => {
      locate(event as PointerEvent, false);
      if (!pointer.down) return;
      pointer.down = false;
      emit(upFns);
    };
    listen('pointerup', release);
    listen('pointercancel', release);
  } else {
    listen('touchmove', (event) => {
      const point = firstTouch(event);
      if (point === undefined) return;
      locate(point, true);
      emit(moveFns);
    });
    listen('touchstart', (event) => {
      const point = firstTouch(event);
      if (point === undefined) return;
      locate(point, false);
      if (!pointer.inside) return;
      pointer.down = true;
      emit(downFns);
    });
    listen('touchend', (event) => {
      const point = firstTouch(event);
      if (point !== undefined) locate(point, false);
      if (!pointer.down) return;
      pointer.down = false;
      emit(upFns);
    });
    listen('mousemove', (event) => {
      locate(event as MouseEvent, true);
      emit(moveFns);
    });
  }

  return {
    pointer,
    update(dtSeconds: number): void {
      const decay = Math.exp(-Math.max(0, dtSeconds) * 6);
      pointer.vx *= decay;
      pointer.vy *= decay;
      if (Math.abs(pointer.vx) < 0.01) pointer.vx = 0;
      if (Math.abs(pointer.vy) < 0.01) pointer.vy = 0;
      pointer.active = now() - lastEventAt < ACTIVE_MS;
    },
    dispose(): void {
      for (const [type, handler] of listeners) {
        win.removeEventListener(type, handler, options);
      }
      listeners.length = 0;
      downFns.length = 0;
      upFns.length = 0;
      moveFns.length = 0;
    },
  };
}
