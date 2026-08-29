import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';
import { lightTheme } from '@craftkit/builder-renderer';

import { EditorCanvas } from './components/EditorCanvas';
import { createOverlayController } from './overlay/overlay-controller';
import { createToolHost, defineCanvasTool } from './overlay/tool-host';
import { createRectIndex, type GeometryPorts, type RectIndex } from './rects';

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function makeKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('cg') },
  });
}

function stubIndex(rectFor?: (id: string) => boolean): RectIndex {
  return {
    attach: () => undefined,
    detach: () => undefined,
    rect: (id) =>
      rectFor === undefined || rectFor(id)
        ? { nodeId: id, x: 0, y: 0, width: 5, height: 5, version: 0 }
        : undefined,
    nodeAt: () => undefined,
    has: () => true,
    element: () => undefined,
    version: () => 0,
    onInvalidate: () => () => undefined,
    stats: () => ({ measures: 0, invalidations: 0 }),
    dispose: () => undefined,
  };
}

describe('branch coverage — defensive paths', () => {
  it('rect-index tolerates same-element re-attach, element swap, and unknown detach', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const index = createRectIndex({
      frame,
      ports: { measure: () => ({ x: 0, y: 0, width: 1, height: 1 }) },
    });
    const doc = frame.contentDocument;
    if (doc === null) {
      throw new Error('unreachable');
    }
    const first = doc.createElement('div');
    const second = doc.createElement('div');

    index.attach('n', first);
    const version = index.version();
    index.attach('n', first); // same element — a no-op, no invalidation
    expect(index.version()).toBe(version);

    index.attach('n', second); // element swap re-registers and invalidates
    expect(index.version()).toBe(version + 1);

    index.detach('ghost'); // unknown id — a no-op
    expect(index.version()).toBe(version + 1);

    expect(() => createRectIndex({ frame: document.createElement('iframe') })).toThrow(
      /mounted same-origin frame/,
    );
    index.dispose();
    frame.remove();
  });

  it('overlay hides hover for a node that lost its rect, and ignores same-id hovers', () => {
    const kernel = makeKernel();
    const layer = document.createElement('div');
    const queue: (() => void)[] = [];
    const controller = createOverlayController({
      kernel,
      index: stubIndex((id) => id !== 'gone'),
      layer,
      schedule: (callback) => {
        queue.push(callback);
        return () => undefined;
      },
    });
    controller.setHover('gone');
    controller.setHover('gone'); // same id — early return branch
    queue.splice(0).forEach((callback) => {
      callback();
    });
    expect(layer.querySelector<HTMLElement>('.bldr-outline--hover')?.style.visibility).not.toBe(
      'visible',
    );
    // Label fallback for a node that is not in the document at all:
    controller.setHover('never-existed');
    queue.splice(0).forEach((callback) => {
      callback();
    });
    controller.dispose();
  });

  it('tool-host default error sink reports, cleanup throws are contained, and stale loads skip', async () => {
    const kernel = makeKernel();
    const layer = document.createElement('div');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const host = createToolHost({ kernel, index: stubIndex(), layer }); // default onToolError

    kernel.extensions.register({
      tier: 1,
      name: 'gap-tools',
      version: '1.0.0',
      contributes: {
        canvasTools: [
          defineCanvasTool({
            id: 'throwing-cleanup',
            on: 'selection',
            mount: () => () => {
              throw new Error('cleanup boom');
            },
          }),
        ],
      },
    });

    host.notifySelection('p1');
    // Stale-generation race: retarget BEFORE the first load's microtask lands.
    host.notifySelection('hero1');
    await flushMicrotasks();
    host.notifySelection(null); // runs the mounted cleanup, which throws — contained
    await flushMicrotasks();
    expect(consoleError).toHaveBeenCalled();

    host.dispose();
    consoleError.mockRestore();
  });

  it('EditorCanvas ignores non-traversal keys and clears hover on pointerleave', () => {
    const kernel = makeKernel();
    const ports: Partial<GeometryPorts> = {
      measure: () => ({ x: 0, y: 0, width: 1, height: 1 }),
      hitTest: () => null,
      schedule: (callback) => {
        callback();
        return () => undefined;
      },
    };
    render(<EditorCanvas kernel={kernel} theme={lightTheme} geometryPorts={ports} />);
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    act(() => {
      host.focus();
    });
    const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
    act(() => {
      frame.contentDocument?.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 0, clientY: 0 }),
      );
      frame.contentDocument?.dispatchEvent(new Event('pointerleave'));
    });
    const before = kernel.context.store.getState().selection;
    act(() => {
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    });
    expect(kernel.context.store.getState().selection).toEqual(before);
  });
});
