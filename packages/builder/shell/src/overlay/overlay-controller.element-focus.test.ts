import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  formatCustomCodePath,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { NodeRect, RectIndex } from '../rects';
import { createOverlayController } from './overlay-controller';

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'overlay-element-focus-test',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['region'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'region',
          description: 'A composed region',
          props: z.object({
            label: z.string().default(''),
            tree: customCodeTree().default(emptyCustomCodeTree()),
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['r1'] } },
    r1: {
      id: 'r1',
      type: 'region',
      props: {
        label: 'CV header',
        tree: {
          kind: 'root',
          children: [
            {
              kind: 'element',
              tag: 'section',
              children: [
                { kind: 'element', tag: 'h1', text: 'Reem' },
                { kind: 'element', tag: 'img', attributes: { src: '/a.jpg', alt: 'A' } },
              ],
            },
          ],
        },
      },
    },
  },
};

function manualScheduler() {
  const queue: (() => void)[] = [];
  return {
    schedule: (callback: () => void) => {
      queue.push(callback);
      return () => {
        const at = queue.indexOf(callback);
        if (at >= 0) queue.splice(at, 1);
      };
    },
    tick: () => {
      for (const callback of queue.splice(0)) callback();
    },
  };
}

/** Node rects by id; element rects by `${id}@${path}` — only stamped paths measure. */
function fakeIndex(
  nodes: Record<string, Partial<NodeRect>>,
  elements: Record<string, Partial<NodeRect>>,
): RectIndex {
  const listeners = new Set<() => void>();
  return {
    attach: vi.fn(),
    detach: vi.fn(),
    rect: (id) =>
      id in nodes
        ? { nodeId: id, x: 0, y: 0, width: 10, height: 10, version: 0, ...nodes[id] }
        : undefined,
    elementRect: (id, path) => {
      const key = `${id}@${formatCustomCodePath(path)}`;
      return key in elements
        ? { nodeId: id, x: 0, y: 0, width: 10, height: 10, version: 0, ...elements[key] }
        : undefined;
    },
    nodeAt: () => undefined,
    has: (id) => id in nodes,
    element: () => undefined,
    version: () => 0,
    onInvalidate: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stats: () => ({ measures: 0, invalidations: 0 }),
    dispose: () => undefined,
  };
}

function setup() {
  const kernel = createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('oef') },
  });
  const layer = document.createElement('div');
  const scheduler = manualScheduler();
  const index = fakeIndex(
    { r1: { x: 0, y: 0, width: 400, height: 200 } },
    {
      'r1@0.1': { x: 40, y: 50, width: 80, height: 80 },
      'r1@0.0': { x: 10, y: 10, width: 200, height: 30 },
    },
  );
  const controller = createOverlayController({
    kernel,
    index,
    layer,
    schedule: scheduler.schedule,
  });
  const outlineOf = (kind: string) => layer.querySelector<HTMLElement>(`.bldr-outline--${kind}`);
  return { kernel, scheduler, controller, outlineOf };
}

describe('overlay controller — element focus inside a composed region', () => {
  it('draws the selection outline around the FOCUSED element, named as a person would name it', () => {
    const { kernel, scheduler, outlineOf } = setup();
    kernel.focusElement('r1', [0, 1]);
    scheduler.tick();
    const outline = outlineOf('selection');
    expect(outline?.style.visibility).toBe('visible');
    expect(outline?.style.transform).toBe('translate(40px, 50px)');
    expect(outline?.style.width).toBe('80px');
    expect(outline?.textContent).toBe('Image');
    expect(outline?.hasAttribute('data-element')).toBe(true);
  });

  it('steps back to the region when the focus is cleared: the region rect and the region name', () => {
    const { kernel, scheduler, outlineOf } = setup();
    kernel.focusElement('r1', [0, 1]);
    scheduler.tick();
    kernel.clearElementFocus();
    scheduler.tick();
    const outline = outlineOf('selection');
    expect(outline?.style.transform).toBe('translate(0px, 0px)');
    expect(outline?.style.width).toBe('400px');
    expect(outline?.textContent).toBe('CV header');
    expect(outline?.hasAttribute('data-element')).toBe(false);
  });

  it('a focus path the canvas cannot resolve degrades to the region instead of vanishing', () => {
    const { kernel, scheduler, outlineOf } = setup();
    kernel.focusElement('r1', [0, 7]); // no such element in the tree
    scheduler.tick();
    expect(outlineOf('selection')?.style.visibility).toBe('visible');
    expect(outlineOf('selection')?.textContent).toBe('CV header');
    // Resolvable in the tree but never stamped on this canvas (no rect): same fallback.
    kernel.focusElement('r1', [0]);
    scheduler.tick();
    expect(outlineOf('selection')?.textContent).toBe('CV header');
  });

  it('hover follows the element under the pointer, and a same-target move is not a frame', () => {
    const { scheduler, controller, outlineOf } = setup();
    controller.setHover('r1', [0, 0]);
    scheduler.tick();
    expect(outlineOf('hover')?.textContent).toBe('Heading');
    expect(outlineOf('hover')?.style.transform).toBe('translate(10px, 10px)');

    controller.setHover('r1', [0, 0]); // same node, same path (a fresh array)
    expect(outlineOf('hover')?.textContent).toBe('Heading');

    controller.setHover('r1'); // the region itself
    scheduler.tick();
    expect(outlineOf('hover')?.textContent).toBe('CV header');
    expect(controller.hoveredId()).toBe('r1');

    controller.setHover(null);
    scheduler.tick();
    expect(outlineOf('hover')?.style.visibility).toBe('hidden');
  });
});
