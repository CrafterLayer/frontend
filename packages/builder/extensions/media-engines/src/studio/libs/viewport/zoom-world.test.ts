import { Viewport } from 'pixi-viewport';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createViewportLibrary } from '../viewport-entry';
import { fitDesign, type DesignZoomHost } from '../../kit/design';
import { createZoomWorld } from './zoom-world';

afterEach(() => {
  document.body.innerHTML = '';
});

/** The real pixi-viewport over a structural app: its EventSystem's canvas and a manual ticker. */
function setup(overrides: Partial<DesignZoomHost> = {}) {
  const root = document.createElement('section');
  const canvas = document.createElement('canvas');
  root.append(canvas);
  document.body.append(root);
  const ticks = new Set<() => void>();
  const app = {
    renderer: {
      events: {
        domElement: canvas,
        mapPositionToPoint(point: { x: number; y: number }, x: number, y: number) {
          point.x = x;
          point.y = y;
        },
      },
    },
    ticker: {
      elapsedMS: 16,
      add(fn: () => void) {
        ticks.add(fn);
      },
      remove(fn: () => void) {
        ticks.delete(fn);
      },
    },
  };
  const render = vi.fn();
  const camera = createZoomWorld(Viewport, {
    app,
    canvas,
    root,
    width: 1280,
    height: 720,
    interactive: true,
    calm: false,
    render,
    ...overrides,
  });
  const view = camera.world as Viewport;
  const fit = (width: number, height: number) => {
    const placed = fitDesign(width, height, 1280, 720, 'contain', overrides.align ?? 'center');
    camera.fit(placed.scale, placed.x, placed.y, width, height);
    return placed;
  };
  const wheel = (init: WheelEventInit) => {
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 195,
      clientY: 160,
      deltaY: -200,
      ...init,
    });
    canvas.dispatchEvent(event);
    return event;
  };
  return { root, canvas, camera, view, fit, wheel, render, ticks };
}

describe('zoomWorld — the design-mode camera (design.zoom)', () => {
  it('starts fitted like a plain design world and clamps zoom between the fit and maxZoom', () => {
    const { view, fit } = setup({ maxZoom: 3 });
    const placed = fit(390, 320);
    expect(view.scale.x).toBeCloseTo(placed.scale, 9);
    expect(view.y).toBeCloseTo(placed.y, 9);
    view.setZoom(placed.scale / 4);
    expect(view.scale.x).toBeCloseTo(placed.scale, 9);
    view.setZoom(placed.scale * 10);
    expect(view.scale.x).toBeCloseTo(placed.scale * 3, 9);
  });

  it('never traps the page: a plain wheel scrolls it, ctrl/⌘ + wheel zooms the world', () => {
    const { view, fit, wheel, canvas } = setup();
    const placed = fit(390, 320);
    const plain = wheel({});
    expect(plain.defaultPrevented).toBe(false);
    expect(view.scale.x).toBeCloseTo(placed.scale, 9);
    const pinch = wheel({ ctrlKey: true });
    expect(pinch.defaultPrevented).toBe(true);
    expect(view.scale.x).toBeGreaterThan(placed.scale);
    const meta = view.scale.x;
    expect(wheel({ metaKey: true }).defaultPrevented).toBe(true);
    expect(view.scale.x).toBeGreaterThan(meta);
    // One finger scrolls the page on touch; two pan and pinch.
    expect(canvas.style.touchAction).toBe('pan-x pan-y');
    expect(canvas.style.pointerEvents).toBe('auto');
  });

  it('keeps the visitor’s zoom and focus across a resize', () => {
    const { view, fit } = setup();
    const first = fit(1280, 720);
    view.setZoom(first.scale * 2);
    view.moveCenter(400, 300);
    const next = fit(2560, 1440);
    expect(view.scale.x).toBeCloseTo(next.scale * 2, 9);
    expect(view.center.x).toBeCloseTo(400, 6);
    expect(view.center.y).toBeCloseTo(300, 6);
    // …and stays clamped to the design: a focus past its edge comes back inside.
    view.moveCenter(100, 100);
    fit(1280, 720);
    expect(view.center.x).toBeCloseTo(320, 6);
    expect(view.center.y).toBeCloseTo(180, 6);
  });

  it('adds no inertia under reduced motion and renders every move itself', () => {
    const { view, fit, render } = setup({ calm: true });
    fit(1280, 720);
    expect(view.plugins.get('decelerate')).toBeFalsy();
    render.mockClear();
    view.emit('moved', { viewport: view, type: 'drag' });
    expect(render).toHaveBeenCalledOnce();
  });

  it('gives the editor canvas the fitted world and no gestures', () => {
    const { view, fit, wheel, canvas } = setup({ interactive: false });
    const placed = fit(390, 320);
    expect(view.plugins.get('drag')).toBeFalsy();
    expect(wheel({ ctrlKey: true }).defaultPrevented).toBe(false);
    expect(view.scale.x).toBeCloseTo(placed.scale, 9);
    expect(canvas.style.touchAction).toBe('');
  });

  it('releases its listeners and the viewport on dispose', () => {
    const { camera, view, fit, wheel, ticks } = setup();
    fit(1280, 720);
    expect(ticks.size).toBe(1);
    camera.dispose();
    expect(view.destroyed).toBe(true);
    expect(ticks.size).toBe(0);
    expect(wheel({ ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it('is what ck-lib-viewport.js hands the kit, beside the Viewport class', () => {
    const library = createViewportLibrary();
    expect(library.Viewport).toBe(Viewport);
    expect(typeof library.zoomWorld).toBe('function');
  });
});
