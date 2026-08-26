import { describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import type { NodeRect, RectIndex } from '../rects';
import { createOverlayController } from './overlay-controller';

/** Manual scheduler: flushes run only when the test ticks the frame. */
function manualScheduler() {
  const queue: (() => void)[] = [];
  return {
    schedule: (callback: () => void) => {
      queue.push(callback);
      return () => {
        const at = queue.indexOf(callback);
        if (at >= 0) {
          queue.splice(at, 1);
        }
      };
    },
    tick: () => {
      const pending = queue.splice(0);
      for (const callback of pending) {
        callback();
      }
    },
    pending: () => queue.length,
  };
}

function fakeIndex(rects: Record<string, Partial<NodeRect>>): RectIndex & {
  invalidateNow: () => void;
} {
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    attach: vi.fn(),
    detach: vi.fn(),
    rect: (id) =>
      id in rects
        ? { nodeId: id, x: 0, y: 0, width: 10, height: 10, version, ...rects[id] }
        : undefined,
    nodeAt: () => undefined,
    has: (id) => id in rects,
    version: () => version,
    onInvalidate: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stats: () => ({ measures: 0, invalidations: version }),
    dispose: () => undefined,
    invalidateNow: () => {
      version += 1;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function setup(rects: Record<string, Partial<NodeRect>> = { p1: {}, hero1: { x: 5, y: 6 } }) {
  const kernel = createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('ov') },
  });
  const layer = document.createElement('div');
  const scheduler = manualScheduler();
  const index = fakeIndex(rects);
  const controller = createOverlayController({
    kernel,
    index,
    layer,
    schedule: scheduler.schedule,
  });
  const outlineOf = (kind: string) => layer.querySelector<HTMLElement>(`.bldr-outline--${kind}`);
  return { kernel, layer, scheduler, index, controller, outlineOf };
}

describe('createOverlayController (005 R6/R7)', () => {
  it('coalesces changes into ONE flush per frame and shows hover chrome with the display name', () => {
    const { scheduler, controller, outlineOf } = setup();
    controller.setHover('p1');
    controller.setHover('hero1'); // same frame — last wins
    expect(scheduler.pending()).toBe(1);
    scheduler.tick();
    const hover = outlineOf('hover');
    expect(hover?.style.visibility).toBe('visible');
    expect(hover?.style.transform).toBe('translate(5px, 6px)');
    expect(hover?.textContent).not.toBe(''); // display name from the schema
  });

  it('renders selection FROM the kernel — programmatic selection shows identically (FR-004)', () => {
    const { kernel, scheduler, outlineOf } = setup();
    kernel.setSelection(['p1']);
    scheduler.tick();
    expect(outlineOf('selection')?.style.visibility).toBe('visible');

    kernel.setSelection([]);
    scheduler.tick();
    expect(outlineOf('selection')?.style.visibility).toBe('hidden');
  });

  it('an undo that removes the selected node hides its chrome on the next flush (FR-007)', () => {
    const { kernel, scheduler, index, outlineOf } = setup({ p1: {} });
    const inserted = kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
    void inserted;
    kernel.setSelection(['p1']);
    scheduler.tick();
    expect(outlineOf('selection')?.style.visibility).toBe('visible');

    kernel.dispatch('removeNode', { id: 'p1' });
    // the fake index no longer reports p1 once the document dropped it
    delete (index as unknown as { rect: unknown }).rect;
    (index as unknown as { rect: (id: string) => undefined }).rect = () => undefined;
    scheduler.tick();
    expect(outlineOf('selection')?.style.visibility).toBe('hidden');
  });

  it('geometry invalidation repositions visible chrome with zero interactions (FR-002/SC-002)', () => {
    const rects: Record<string, Partial<NodeRect>> = { p1: { x: 1, y: 1 } };
    const { kernel, scheduler, index, outlineOf } = setup(rects);
    kernel.setSelection(['p1']);
    scheduler.tick();
    expect(outlineOf('selection')?.style.transform).toBe('translate(1px, 1px)');

    rects['p1'] = { x: 42, y: 7 }; // layout moved…
    index.invalidateNow(); // …and the OBSERVER reported it
    scheduler.tick();
    expect(outlineOf('selection')?.style.transform).toBe('translate(42px, 7px)');
  });

  it('dispose removes chrome and silences every input', () => {
    const { kernel, scheduler, controller, layer } = setup();
    controller.dispose();
    expect(layer.querySelector('.bldr-outline')).toBeNull();
    kernel.setSelection(['p1']);
    controller.setHover('p1');
    expect(scheduler.pending()).toBe(0);
  });
});
