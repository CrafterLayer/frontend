import { expect, within } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { NodeRect, RectIndex } from '../rects';
import { createOverlayController, type OverlayController } from './overlay-controller';
import './overlay.css';

const NODE_ID = 'edge-block';
const BLOCK_TYPE = 'marketing-cta-banner-with-supporting-copy';
const DISPLAY_NAME = 'Marketing CTA Banner With Supporting Copy';
const LONG_DESCRIPTION =
  'An extensive catalogue description explaining when to use this marketing banner, how its supporting copy should be written, and which campaign contexts it is designed to serve.';
const LABEL_ALLOWANCE_PX = 24;
const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'overlay-overflow-story',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: BLOCK_TYPE,
          description: LONG_DESCRIPTION,
          props: z.object({}),
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
  rootId: NODE_ID,
  nodes: { [NODE_ID]: { id: NODE_ID, type: BLOCK_TYPE, props: {} } },
};

const activeControllers = new WeakMap<HTMLElement, OverlayController>();

const meta = {
  title: 'Builder/Shell/OverlayController',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div
      data-testid="overlay-canvas"
      dir="ltr"
      style={{ blockSize: 160, inlineSize: 240, position: 'relative' }}
    >
      <div className="bldr-overlay" data-testid="overlay-layer" />
    </div>
  ),
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LongDescriptionBadgeContainment: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement).getByTestId('overlay-canvas');
    const layer = within(canvasElement).getByTestId('overlay-layer');
    activeControllers.get(layer)?.dispose();

    let rect: NodeRect = {
      nodeId: NODE_ID,
      x: 160,
      y: 36,
      width: 80,
      height: 64,
      version: 0,
    };
    const listeners = new Set<() => void>();
    const index: RectIndex = {
      attach: () => undefined,
      detach: () => undefined,
      rect: (id) => (id === NODE_ID ? rect : undefined),
      nodeAt: () => NODE_ID,
      has: (id) => id === NODE_ID,
      element: () => undefined,
      version: () => 0,
      onInvalidate: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      stats: () => ({ measures: 0, invalidations: 0 }),
      dispose: () => undefined,
    };
    const queue: (() => void)[] = [];
    const kernel = createBuilder({
      document: DOC,
      extensions: [VOCAB],
      ports: { clock: fixedClock(), ids: seededIds('overlay-story') },
    });
    const description = kernel.context.registry.block(BLOCK_TYPE)?.schema.description;
    if (description === undefined) {
      throw new Error('expected the long-description block to be registered');
    }
    const controller = createOverlayController({
      kernel,
      index,
      layer,
      schedule: (callback) => {
        queue.push(callback);
        return () => {
          const at = queue.indexOf(callback);
          if (at >= 0) {
            queue.splice(at, 1);
          }
        };
      },
    });
    activeControllers.set(layer, controller);

    controller.setHover(NODE_ID);
    queue.splice(0).forEach((callback) => {
      callback();
    });

    const label = layer.querySelector<HTMLElement>('.bldr-outline--hover .bldr-outline__label');
    const outline = layer.querySelector<HTMLElement>('.bldr-outline--hover');
    if (label === null || outline === null) {
      throw new Error('expected visible hover outline and label');
    }

    // Fixture and rendered content are both deliberately long: the geometry
    // gate cannot pass because either one was shortened accidentally.
    await expect(description.length).toBeGreaterThan(100);
    await expect(label.textContent.length).toBeGreaterThan(30);
    await expect(label.textContent).toBe(DISPLAY_NAME);
    await expect(label.textContent).not.toBe(description);
    await expect(label.clientWidth).toBeGreaterThan(0);
    await expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);

    const resolved = label.ownerDocument.defaultView?.getComputedStyle(label);
    await expect(resolved?.overflow).toBe('hidden');
    await expect(resolved?.textOverflow).toBe('ellipsis');

    const canvasBox = canvas.getBoundingClientRect();
    const outlineBox = outline.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();
    await expect(labelBox.left).toBeGreaterThanOrEqual(canvasBox.left - 0.5);
    await expect(labelBox.right).toBeLessThanOrEqual(canvasBox.right + 0.5);
    await expect(labelBox.width).toBeGreaterThanOrEqual(outlineBox.width - 0.5);
    await expect(labelBox.width).toBeLessThanOrEqual(outlineBox.width + LABEL_ALLOWANCE_PX + 0.5);
    await expect(labelBox.width).toBeLessThanOrEqual(canvasBox.width + 0.5);

    // The overlay stores physical x coordinates while the label uses logical
    // positioning. Exercise the opposite edge under RTL in the same gate.
    canvas.setAttribute('dir', 'rtl');
    rect = { ...rect, x: 0, version: 1 };
    for (const listener of listeners) {
      listener();
    }
    queue.splice(0).forEach((callback) => {
      callback();
    });

    const rtlOutlineBox = outline.getBoundingClientRect();
    const rtlLabelBox = label.getBoundingClientRect();
    await expect(label.clientWidth).toBeGreaterThan(0);
    await expect(rtlLabelBox.left).toBeGreaterThanOrEqual(canvasBox.left - 0.5);
    await expect(rtlLabelBox.right).toBeLessThanOrEqual(canvasBox.right + 0.5);
    await expect(rtlLabelBox.width).toBeGreaterThanOrEqual(rtlOutlineBox.width - 0.5);
    await expect(rtlLabelBox.width).toBeLessThanOrEqual(
      rtlOutlineBox.width + LABEL_ALLOWANCE_PX + 0.5,
    );
    await expect(rtlLabelBox.width).toBeLessThanOrEqual(canvasBox.width + 0.5);
  },
};

/**
 * The chrome layer must not be scrollable — not even programmatically.
 */
export const TheLayerCannotBeScrolledOutOfRegister: Story = {
  ...LongDescriptionBadgeContainment,
  play: async ({ canvasElement }) => {
    /*
      Measured in the running product: `.bldr-overlay` carried `overflow: hidden`,
      which makes an element a SCROLL CONTAINER even with no scrollbar. With the
      last block selected its action bar was clipped, and the browser's own
      scroll-into-view on focus then moved the whole layer — one Tab took
      scrollTop from 0 to 22, and nothing ever put it back. From that moment
      every selection outline, hover outline, name chip and drop indicator
      pointed 22px away from the content it described: the outline sat at host
      y 866.4 against a block at 888.4, for the rest of the session.

      `overflow: clip` clips the same and creates no scroll container, so there
      is nothing for focus — or for this test — to scroll.
    */
    const layer = canvasElement.querySelector('[data-testid="overlay-layer"]');
    if (layer === null) {
      throw new Error('the overlay layer did not render');
    }

    await expect(getComputedStyle(layer).overflow).toBe('clip');

    // Non-vacuous: content must actually exceed the box, or a zero scrollTop
    // would prove nothing at all.
    const overflowing = document.createElement('div');
    overflowing.style.blockSize = '4000px';
    overflowing.style.inlineSize = '10px';
    layer.appendChild(overflowing);
    await expect(layer.scrollHeight).toBeGreaterThan(layer.clientHeight + 100);

    layer.scrollTop = 500;
    await expect(layer.scrollTop).toBe(0);

    overflowing.remove();
  },
};
