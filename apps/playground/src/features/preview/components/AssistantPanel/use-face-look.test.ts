import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFaceLook } from './use-face-look';

/*
  jsdom lays nothing out, so the seat's box is stubbed: a 32 px square whose
  CENTRE sits at (100, 100). Frames are captured rather than waited for, so a
  test states exactly how many the hook asked for and runs them by hand.
*/
function seatBox(): DOMRect {
  return {
    x: 84,
    y: 84,
    left: 84,
    top: 84,
    right: 116,
    bottom: 116,
    width: 32,
    height: 32,
    toJSON: () => ({}),
  };
}

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

function flushFrames(): void {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) {
    callback(performance.now());
  }
}

function move(target: EventTarget, clientX: number, clientY: number): void {
  target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX, clientY }));
}

function look(seat: HTMLElement): readonly [string, string] {
  return [
    seat.style.getPropertyValue('--pg-face-look-x'),
    seat.style.getPropertyValue('--pg-face-look-y'),
  ];
}

/** A media stub: `(hover: hover)` and `(prefers-reduced-motion: reduce)` answered as told. */
function stubMedia(answers: { readonly hover: boolean; readonly reduced: boolean }): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: query.includes('reduced-motion') ? answers.reduced : answers.hover,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}

function mount() {
  let renders = 0;
  const hook = renderHook(() => {
    renders += 1;
    return useFaceLook();
  });
  const zone = document.createElement('div');
  const seat = document.createElement('span');
  seat.getBoundingClientRect = seatBox;
  zone.append(seat);
  document.body.append(zone);
  // React attaches a child's ref before its parent's; the order must not matter.
  hook.result.current.holdSeat(seat);
  hook.result.current.watchZone(zone);
  return {
    zone,
    seat,
    refs: hook.result.current,
    renders: () => renders,
    detach: () => {
      hook.result.current.watchZone(null);
      hook.result.current.holdSeat(null);
      zone.remove();
      hook.unmount();
    },
  };
}

describe('useFaceLook', () => {
  beforeEach(() => {
    frames.clear();
    nextFrame = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = nextFrame;
      nextFrame += 1;
      frames.set(id, callback);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    // jsdom ships no matchMedia; a test that stubbed one puts the room back.
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('writes the clamped look onto the seat once per frame while the pointer crosses the zone', () => {
    const { zone, seat, detach } = mount();

    move(zone, 300, 100);
    expect(look(seat)).toEqual(['', '']);
    expect(frames.size).toBe(1);
    flushFrames();
    expect(look(seat)).toEqual(['1.4px', '0px']);

    // Far to the other side and below: both axes clamp to their range.
    move(zone, -1000, 1000);
    flushFrames();
    expect(look(seat)).toEqual(['-1.4px', '1px']);

    // A quarter of the way across four seat widths: a proportional glance.
    move(zone, 132, 100);
    flushFrames();
    expect(look(seat)).toEqual(['0.35px', '0px']);

    detach();
  });

  it('coalesces a burst of moves into one frame, reading the last position', () => {
    const { zone, seat, detach } = mount();

    move(zone, 300, 100);
    move(zone, 100, 100);
    move(zone, 100, 300);
    expect(frames.size).toBe(1);
    flushFrames();
    expect(look(seat)).toEqual(['0px', '1px']);

    detach();
  });

  it('returns the eyes to centre when the pointer leaves or the gesture is cancelled', () => {
    const { zone, seat, detach } = mount();

    move(zone, 300, 100);
    flushFrames();
    expect(look(seat)).toEqual(['1.4px', '0px']);

    zone.dispatchEvent(new PointerEvent('pointerleave'));
    expect(look(seat)).toEqual(['0px', '0px']);

    move(zone, 300, 100);
    // A frame still pending when the pointer leaves is dropped, not applied late.
    zone.dispatchEvent(new PointerEvent('pointercancel'));
    expect(frames.size).toBe(0);
    expect(look(seat)).toEqual(['0px', '0px']);

    detach();
  });

  it('attaches no move listener under reduced motion or without a hovering pointer', () => {
    for (const answers of [
      { hover: true, reduced: true },
      { hover: false, reduced: false },
    ]) {
      stubMedia(answers);
      const { zone, seat, detach } = mount();
      const listen = vi.spyOn(zone, 'addEventListener');

      move(zone, 300, 100);
      expect(frames.size).toBe(0);
      expect(look(seat)).toEqual(['', '']);
      expect(listen).not.toHaveBeenCalled();

      detach();
      Reflect.deleteProperty(window, 'matchMedia');
    }
  });

  it('follows the pointer when the room can hover and asks for no stillness', () => {
    stubMedia({ hover: true, reduced: false });
    const { zone, seat, detach } = mount();

    move(zone, 300, 100);
    flushFrames();
    expect(look(seat)).toEqual(['1.4px', '0px']);

    detach();
  });

  it('stamps the press on the seat and clears it when the pointer lifts anywhere', () => {
    const { seat, detach } = mount();

    seat.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(seat).toHaveAttribute('data-press', '');

    window.dispatchEvent(new PointerEvent('pointerup'));
    expect(seat).not.toHaveAttribute('data-press');

    seat.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(seat).toHaveAttribute('data-press', '');
    window.dispatchEvent(new PointerEvent('pointercancel'));
    expect(seat).not.toHaveAttribute('data-press');

    detach();
  });

  it('never leaves a press stuck: a lift that never arrives times out', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { seat, detach } = mount();

    seat.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(seat).toHaveAttribute('data-press', '');
    vi.advanceTimersByTime(599);
    expect(seat).toHaveAttribute('data-press', '');
    vi.advanceTimersByTime(1);
    expect(seat).not.toHaveAttribute('data-press');

    detach();
  });

  it('keeps the caret where it is: a mousedown on the seat is default-prevented', () => {
    const { seat, detach } = mount();

    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    seat.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);

    detach();
  });

  it('never re-renders the component that holds it', () => {
    const { zone, seat, renders, detach } = mount();
    const settled = renders();

    move(zone, 300, 100);
    flushFrames();
    zone.dispatchEvent(new PointerEvent('pointerleave'));
    seat.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup'));

    expect(renders()).toBe(settled);
    detach();
  });

  it('hands back the same two callbacks on every render', () => {
    const hook = renderHook(() => useFaceLook());
    const first = hook.result.current;
    hook.rerender();
    expect(hook.result.current.watchZone).toBe(first.watchZone);
    expect(hook.result.current.holdSeat).toBe(first.holdSeat);
    hook.unmount();
  });

  it('removes its listeners and properties when the seat leaves, and survives a StrictMode re-attach', () => {
    const { zone, seat, refs, detach } = mount();

    move(zone, 300, 100);
    flushFrames();
    seat.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(look(seat)).toEqual(['1.4px', '0px']);
    expect(seat).toHaveAttribute('data-press');

    // null → el → null → el is exactly what StrictMode does to a ref callback.
    refs.watchZone(null);
    refs.holdSeat(null);
    expect(look(seat)).toEqual(['', '']);
    expect(seat).not.toHaveAttribute('data-press');
    move(zone, 300, 100);
    expect(frames.size).toBe(0);
    seat.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(seat).not.toHaveAttribute('data-press');

    refs.holdSeat(seat);
    refs.watchZone(zone);
    move(zone, 300, 100);
    flushFrames();
    expect(look(seat)).toEqual(['1.4px', '0px']);

    detach();
  });

  it('writes nothing when the seat has no box yet', () => {
    const { zone, seat, detach } = mount();
    seat.getBoundingClientRect = () =>
      ({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }) as DOMRect;

    move(zone, 300, 100);
    flushFrames();
    expect(look(seat)).toEqual(['0px', '0px']);

    detach();
  });
});
