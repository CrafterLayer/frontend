import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScrollTracker, scrollProgress } from './scroll';
import { createPointerTracker } from './pointer';
import type { SceneApp } from './types';

const originalHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');

afterEach(() => {
  if (originalHeight !== undefined) Object.defineProperty(window, 'innerHeight', originalHeight);
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function fixture(options: { nested?: boolean; calm?: boolean; scrub?: boolean } = {}) {
  const parent = document.createElement('main');
  const root = document.createElement('section');
  const canvas = document.createElement('canvas');
  parent.append(root);
  root.append(canvas);
  document.body.append(parent);
  root.style.minHeight = '400px';
  canvas.style.top = '0px';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  const geometry = { top: 0, width: 800, viewport: 600 };
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    get: () => geometry.viewport,
  });
  Object.defineProperty(root, 'clientWidth', { get: () => geometry.width });
  Object.defineProperty(parent, 'clientHeight', { get: () => 500 });
  Object.defineProperty(parent, 'scrollHeight', {
    get: () => (options.nested === true ? 2400 : 500),
  });
  const parentBox = vi
    .spyOn(parent, 'getBoundingClientRect')
    .mockImplementation(() => ({ top: 50 }) as DOMRect);
  if (options.nested === true) parent.style.overflowY = 'auto';
  vi.spyOn(root, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        top: geometry.top,
        left: 0,
        width: geometry.width,
        height: Math.max(400, parseFloat(root.style.minHeight) || 0),
      }) as DOMRect,
  );
  const screen = { width: 800, height: 400 };
  vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        top: geometry.top + (parseFloat(canvas.style.top) || 0),
        left: 0,
        width: screen.width,
        height: screen.height,
      }) as DOMRect,
  );
  const resize = vi.fn((width: number, height: number) => Object.assign(screen, { width, height }));
  const app = {
    screen,
    renderer: { resize },
    resizeTo: root,
    resize: vi.fn(),
  } as unknown as SceneApp;
  const tracker = createScrollTracker(root, window, {
    canvas,
    app,
    calm: options.calm === true,
    scrub: options.scrub === true,
  });
  const move = (top: number) => {
    geometry.top = top;
    (options.nested === true ? parent : window).dispatchEvent(new Event('scroll'));
  };
  return { parent, parentBox, root, canvas, geometry, screen, app, tracker, move, resize };
}

describe('native narrative scrolling', () => {
  it('keeps ordinary progress compatible without changing layout', () => {
    const f = fixture();
    expect(f.tracker.scroll.progress).toBe(scrollProgress(0, 400, 600));
    expect(f.root.style.minHeight).toBe('400px');
    f.move(-400);
    expect(f.tracker.scroll.progress).toBe(1);
    expect(f.resize).not.toHaveBeenCalled();
    f.tracker.dispose();
  });

  it('holds first, middle and final frames in view, releases then reverses using native scroll', () => {
    const f = fixture();
    const release = f.tracker.scroll.pin();
    expect(f.root.style.minHeight).toBe('2200px');
    expect(f.tracker.scroll.progress).toBe(0);
    expect(f.canvas.getAttribute('data-ck-scroll-pinned')).toBe('true');
    f.move(-855);
    expect(f.tracker.scroll.progress).toBe(0.5);
    expect(f.canvas.getBoundingClientRect().top).toBe(0);
    f.move(-1710);
    expect(f.tracker.scroll.progress).toBe(1);
    expect(f.canvas.getBoundingClientRect().top).toBe(0);
    f.move(-2000);
    expect(f.canvas.getBoundingClientRect().top).toBe(-200);
    f.move(0);
    expect(f.tracker.scroll.progress).toBe(0);
    const wheel = new WheelEvent('wheel', { cancelable: true, bubbles: true });
    f.canvas.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(document.body.style.overflow).toBe('');
    release();
    expect(f.root.style.minHeight).toBe('400px');
    expect(f.canvas.style.width).toBe('100%');
    expect(f.canvas.style.top).toBe('0px');
    expect(f.canvas.hasAttribute('data-ck-scroll-pinned')).toBe(false);
    expect(f.app.resizeTo).toBe(f.root);
    expect(f.canvas.parentElement).toBe(f.root);
    f.tracker.dispose();
  });

  it('tracks a nested scroll root, its velocity, responsive dimensions and visible pointer', () => {
    const f = fixture({ nested: true, scrub: true });
    expect(f.root.style.minHeight).toBe('1900px');
    f.move(-662.5);
    expect(f.tracker.scroll.progress).toBe(0.5);
    expect(f.canvas.getBoundingClientRect().top).toBe(50);
    f.tracker.update(0.1);
    expect(f.tracker.scroll.velocity).toBeGreaterThan(0);
    const pointer = createPointerTracker(
      f.root,
      window,
      undefined,
      undefined,
      f.tracker.pointerElement,
    );
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 400, clientY: 250 }));
    expect(pointer.pointer.ny).toBe(0.5);
    expect(pointer.pointer.inside).toBe(true);
    f.geometry.width = 350;
    f.geometry.viewport = 300;
    window.dispatchEvent(new Event('resize'));
    expect(f.screen).toEqual({ width: 350, height: 300 });
    expect(f.root.style.minHeight).toBe('1200px');
    pointer.dispose();
    f.tracker.dispose();
  });

  it('ignores clipping wrappers and leaves later authored edits intact on disposal', () => {
    const f = fixture();
    f.parent.style.overflowY = 'hidden';
    f.tracker.scroll.pin();
    expect(f.root.style.minHeight).toBe('2200px');
    f.root.style.minHeight = '2400px';
    f.canvas.style.top = '7px';
    f.tracker.dispose();
    expect(f.root.style.minHeight).toBe('2400px');
    expect(f.canvas.style.top).toBe('7px');
    const progress = f.tracker.scroll.progress;
    f.move(-900);
    f.tracker.scroll.pin();
    expect(f.tracker.scroll.progress).toBe(progress);
    expect(f.root.style.minHeight).toBe('2400px');
  });

  it('uses page scroll through an unconstrained overflow-auto wrapper', () => {
    const f = fixture();
    f.parent.style.overflowY = 'auto';
    f.parentBox.mockImplementation(() => ({ top: f.geometry.top }) as DOMRect);
    f.tracker.scroll.pin();
    f.move(-1710);
    expect(f.tracker.scroll.progress).toBe(1);
    expect(f.canvas.getBoundingClientRect().top).toBe(0);
    f.tracker.dispose();
  });

  it('never adds a runway in calm mode, even for legacy scrub params', () => {
    const f = fixture({ calm: true, scrub: true });
    f.tracker.scroll.pin(8);
    expect(f.root.style.minHeight).toBe('400px');
    expect(f.resize).not.toHaveBeenCalled();
    f.tracker.dispose();
  });

  it.each([
    [Infinity, 2200],
    [0, 1000],
    [100, 5200],
  ])('bounds span input %s', (screens, height) => {
    const f = fixture();
    f.tracker.scroll.pin(screens);
    expect(f.root.style.minHeight).toBe(`${String(height)}px`);
    f.tracker.dispose();
  });
});
