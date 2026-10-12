import { act, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CANVAS_VIEWPORT_HEIGHT_PROPERTY, lightTheme } from '@craftkit/builder-renderer';
import type { CustomCodeRoot } from '@craftkit/builder-schema';

import type { GeometryPorts } from '../../rects';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { permissiveUtilityOracle, treeKernel } from '../../overlay/tree-test-kit';
import { CANVAS_ZOOM_PROPERTY } from './canvas-zoom';
import { EditorCanvas } from './EditorCanvas';

/*
  Canvas zoom must not shrink the chrome. The overlay layer shares the frame's
  scale(zoom); the canvas publishes the zoom to it (CSS compensation) and the
  floating hosts counter-scale their toolbars — through the REAL canvas here.
*/

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [{ kind: 'element', tag: 'h2', text: 'Our story' }],
};

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = permissiveUtilityOracle();
});
afterAll(() => {
  restoreOracle();
});

function harness(zoom: number) {
  const kernel = treeKernel([TREE]);
  const queue: (() => void)[] = [];
  const ports: Partial<GeometryPorts> = {
    measure: () => ({ x: 40, y: 200, width: 300, height: 60 }),
    hitTest: () => null,
    viewport: () => ({ width: 1200, height: 900 }),
    schedule: (callback) => {
      queue.push(callback);
      return () => undefined;
    },
  };
  const element = (at: number) => (
    <EditorCanvas
      kernel={kernel}
      theme={lightTheme}
      geometryPorts={ports}
      floatingPorts={{
        measure: () => ({ width: 120, height: 32 }),
        observe: () => () => undefined,
      }}
      editable
      zoom={at}
    />
  );
  const view = render(element(zoom));
  const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
  frame.getBoundingClientRect = () => ({ x: 0, y: 0, width: 800, height: 600 }) as DOMRect;
  const tick = () => {
    act(() => {
      for (const callback of queue.splice(0)) callback();
    });
  };
  return {
    kernel,
    tick,
    frame,
    unmount: () => {
      view.unmount();
    },
    layer: () => screen.getByTestId('bldr-overlay'),
    actions: () => view.container.querySelector<HTMLElement>('.bldr-floating--actions'),
    rerender: (at: number) => {
      view.rerender(element(at));
      tick();
    },
  };
}

describe('EditorCanvas — chrome keeps its own size under zoom', () => {
  it('publishes the zoom to the overlay layer, and follows it', () => {
    const h = harness(0.5);
    expect(h.layer().style.getPropertyValue(CANVAS_ZOOM_PROPERTY)).toBe('0.5');
    h.rerender(0.75);
    expect(h.layer().style.getPropertyValue(CANVAS_ZOOM_PROPERTY)).toBe('0.75');
    h.rerender(1);
    expect(h.layer().style.getPropertyValue(CANVAS_ZOOM_PROPERTY)).toBe('1');
  });

  it('counter-scales the block action bar, and drops it at 100%', () => {
    const h = harness(0.5);
    h.tick();
    act(() => {
      h.kernel.setSelection(['r1']);
    });
    h.tick();
    // Below-centre on the block in LAYER px, with the 120×32 bar covering
    // 240×64 of them: 40 + 150 - 120 = 70, 200 + 60 + 16 = 276.
    expect(h.actions()?.style.transform).toBe('translate(70px, 276px) scale(2)');

    h.rerender(1);
    expect(h.actions()?.style.transform).toBe('translate(130px, 268px)');
  });
});

/*
  preview-fix (2026-10-12): the frame is `100 / zoom` percent tall, so its own `vh` grew with
  zoom-out (a 70vh story stage: 999px at 57%, 604px in Preview). The canvas publishes the zoom-1
  viewport height — the frame's height times the zoom — and custom regions read vh through it.
*/
describe('EditorCanvas — the page keeps its viewport height under zoom', () => {
  const published = (frame: HTMLIFrameElement) =>
    frame.contentDocument?.documentElement.style.getPropertyValue(CANVAS_VIEWPORT_HEIGHT_PROPERTY);

  it('sets --ck-vh to a hundredth of the zoom-1 frame height, follows zoom and resize, and clears it', () => {
    const h = harness(0.5);
    const view = h.frame.contentWindow;
    if (view === null) throw new Error('no frame window');
    const height = view.innerHeight;
    expect(published(h.frame)).toBe(`${String((height * 0.5) / 100)}px`);
    h.rerender(0.25);
    expect(published(h.frame)).toBe(`${String((height * 0.25) / 100)}px`);

    Object.defineProperty(view, 'innerHeight', { configurable: true, value: 1600 });
    act(() => {
      view.dispatchEvent(new Event('resize'));
    });
    expect(published(h.frame)).toBe('4px');

    const frame = h.frame;
    h.unmount();
    expect(published(frame)).toBe('');
  });
});
