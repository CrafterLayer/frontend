import { expect, waitFor } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { darkTheme, lightTheme } from '@craftkit/builder-renderer';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BlockRenderProps,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { EditorCanvas } from './EditorCanvas';

// Self-contained demo vocabulary: the shell may not depend on layer-4 block
// extensions (layer law), so the stories carry their own tiny blocks.
const Panel = ((props: BlockRenderProps<{ label: string; tone: string }>) => (
  <section
    data-demo-node={props.node.id}
    style={{
      background:
        props.props.tone === 'accent' ? 'var(--t-accent, #4f46e5)' : 'var(--t-surface, #fff)',
      color: props.props.tone === 'accent' ? 'var(--t-accent-text, #fff)' : 'var(--t-text, #111)',
      borderRadius: 8,
      marginBlockEnd: 12,
      minBlockSize: 64,
      paddingBlock: 16,
      paddingInline: 20,
    }}
  >
    <strong>{props.props.label}</strong>
    <div>{props.slots['default']}</div>
  </section>
)) as unknown as BlockRenderComponent;

const Root = ((props: BlockRenderProps) => (
  <main style={{ padding: 16 }}>{props.slots['default']}</main>
)) as unknown as BlockRenderComponent;

const demoBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'canvas-demo-blocks',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'demo-page',
          description: 'Demo page',
          props: z.object({}),
          slots: { default: { allow: ['demo-panel'] } },
          examples: [],
        }),
        render: Root,
      },
      {
        schema: defineBlockSchema({
          type: 'demo-panel',
          description: 'Demo panel',
          props: z.object({
            label: z.string().default('Panel'),
            tone: z.enum(['plain', 'accent']).default('plain'),
          }),
          slots: { default: { allow: ['demo-panel'] } },
          examples: [],
        }),
        render: Panel,
      },
    ],
  },
};

const demoDocument = (dir: 'ltr' | 'rtl'): BuilderDocument => ({
  schemaVersion: 1,
  surface: 'site',
  dir,
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'demo-page', props: {}, slots: { default: ['one', 'two', 'three'] } },
    one: { id: 'one', type: 'demo-panel', props: { label: dir === 'rtl' ? 'الأول' : 'First' } },
    two: {
      id: 'two',
      type: 'demo-panel',
      props: { label: dir === 'rtl' ? 'الثاني' : 'Second', tone: 'accent' },
    },
    three: {
      id: 'three',
      type: 'demo-panel',
      props: { label: dir === 'rtl' ? 'الثالث' : 'Third' },
    },
  },
});

const makeKernel = (dir: 'ltr' | 'rtl' = 'ltr') =>
  createBuilder({
    document: demoDocument(dir),
    extensions: [demoBlocks],
    ports: { clock: fixedClock(), ids: seededIds('story') },
  });

const meta = {
  title: 'Builder/Shell/EditorCanvas',
  component: EditorCanvas,
  parameters: { layout: 'fullscreen' },
  // The canvas host fills its parent; without an explicit height the iframe's
  // viewport is 0px tall and in-frame hit-testing (elementFromPoint) is blind.
  decorators: [
    (Story) => (
      <div style={{ blockSize: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EditorCanvas>;
export default meta;

type Story = StoryObj<typeof meta>;

const frameOf = (canvasElement: HTMLElement): HTMLIFrameElement => {
  const frame = canvasElement.querySelector('iframe');
  if (frame === null) {
    throw new Error('EditorCanvas must render its preview frame');
  }
  return frame;
};

export const Default: Story = {
  args: { kernel: makeKernel(), theme: lightTheme },
};

const selectionKernel = makeKernel();
export const Selection: Story = {
  args: { kernel: selectionKernel, theme: lightTheme },
  play: async ({ canvasElement }) => {
    // Browser-truth Lane-A proof (R10): a real Chromium layout, a programmatic
    // selection, and an outline that actually covers its target.
    const frame = frameOf(canvasElement);
    await waitFor(async () => {
      await expect(frame.contentDocument?.querySelector('[data-bldr-node="two"]')).toBeTruthy();
    });
    selectionKernel.setSelection(['two']);
    const outline = canvasElement.querySelector<HTMLElement>('.bldr-outline--selection');
    await waitFor(async () => {
      await expect(outline?.style.visibility).toBe('visible');
    });
    const target = frame.contentDocument?.querySelector('[data-bldr-node="two"]');
    const targetBox = target?.getBoundingClientRect();
    const outlineBox = outline?.getBoundingClientRect();
    await expect(Math.abs((outlineBox?.width ?? 0) - (targetBox?.width ?? -1))).toBeLessThan(2);

    // Programmatic layout change with ZERO interactions: the observer channel
    // repositions the chrome (SC-002). Sized RELATIVE to the current box so a
    // play() rerun on an already-grown mount still proves growth (determinism).
    const heightBefore = outline?.getBoundingClientRect().height ?? 0;
    (target as HTMLElement).style.minBlockSize = `${String(Math.round(heightBefore) + 120)}px`;
    await waitFor(async () => {
      await expect(outline?.getBoundingClientRect().height ?? 0).toBeGreaterThan(heightBefore + 40);
    });
  },
};

const rtlKernel = makeKernel('rtl');
export const RightToLeft: Story = {
  args: { kernel: rtlKernel, theme: lightTheme },
  play: async ({ canvasElement }) => {
    const frame = frameOf(canvasElement);
    await waitFor(async () => {
      await expect(frame.contentDocument?.documentElement.getAttribute('dir')).toBe('rtl');
    });
    rtlKernel.setSelection(['one']);
    const outline = canvasElement.querySelector<HTMLElement>('.bldr-outline--selection');
    await waitFor(async () => {
      await expect(outline?.style.visibility).toBe('visible');
    });
    const target = frame.contentDocument?.querySelector('[data-bldr-node="one"]');
    await expect(
      Math.abs(
        (outline?.getBoundingClientRect().x ?? 0) - (target?.getBoundingClientRect().x ?? -1),
      ),
    ).toBeLessThan(2);
  },
};

const flipKernel = makeKernel();
export const DirectionFlip: Story = {
  args: { kernel: flipKernel, theme: lightTheme },
  play: async ({ canvasElement }) => {
    // Browser-truth proof of FR-011's LIVE flip clause (contract §7 "RTL flip
    // correct"): real Chromium layout, a flip through the real command door,
    // ZERO pointer interaction, and chrome that re-tracks its target's NEW box.
    // Written idempotently — it flips to the opposite of whatever the current
    // direction is — so an Interactions-panel rerun proves the same property.
    const frame = frameOf(canvasElement);
    await waitFor(async () => {
      await expect(frame.contentDocument?.querySelector('[data-bldr-node="two"]')).toBeTruthy();
    });
    flipKernel.setSelection(['two']);
    const outline = canvasElement.querySelector<HTMLElement>('.bldr-outline--selection');
    await waitFor(async () => {
      await expect(outline?.style.visibility).toBe('visible');
    });

    const before = flipKernel.getDocument().dir;
    const next = before === 'rtl' ? 'ltr' : 'rtl';
    flipKernel.dispatch('setDocMeta', { dir: next });

    await waitFor(async () => {
      await expect(frame.contentDocument?.documentElement.getAttribute('dir')).toBe(next);
    });
    // The outline must land on the target's post-reflow box, not its old one.
    await waitFor(async () => {
      const target = frame.contentDocument?.querySelector('[data-bldr-node="two"]');
      const targetBox = target?.getBoundingClientRect();
      const outlineBox = outline?.getBoundingClientRect();
      await expect(Math.abs((outlineBox?.x ?? 0) - (targetBox?.x ?? -999))).toBeLessThan(2);
      await expect(Math.abs((outlineBox?.width ?? 0) - (targetBox?.width ?? -999))).toBeLessThan(2);
    });
  },
};

const dragKernel = makeKernel();
export const DragRearrange: Story = {
  args: { kernel: dragKernel, theme: lightTheme, editable: true },
  play: async ({ canvasElement }) => {
    // Browser-truth drag (006 SC-001/SC-002): real Chromium layout, dispatched
    // PointerEvents, one transaction, committed order. Idempotent — "take the
    // LAST child, drag it BEFORE the first" holds on every rerun.
    const frame = frameOf(canvasElement);
    const frameDocument = frame.contentDocument;
    if (frameDocument === null) {
      throw new Error('no frame document');
    }
    await waitFor(async () => {
      await expect(frameDocument.querySelector('[data-bldr-node="one"]')).toBeTruthy();
    });
    const order = () => dragKernel.getDocument().nodes['root']?.slots?.['default'] ?? [];
    const before = [...order()];
    const lastId = before.at(-1);
    const firstId = before[0];
    if (lastId === undefined || firstId === undefined) {
      throw new Error('demo document must have children');
    }
    const source = frameDocument.querySelector(`[data-bldr-node="${lastId}"]`);
    const target = frameDocument.querySelector(`[data-bldr-node="${firstId}"]`);
    const sourceBox = source?.getBoundingClientRect();
    const targetBox = target?.getBoundingClientRect();
    if (sourceBox === undefined || targetBox === undefined) {
      throw new Error('demo blocks must have geometry');
    }
    const txBefore = dragKernel.transactions().length;

    const fire = (type: string, x: number, y: number) => {
      frameDocument.dispatchEvent(
        new PointerEvent(type, { clientX: x, clientY: y, bubbles: true }),
      );
    };
    fire('pointerdown', sourceBox.x + 20, sourceBox.y + 10);
    fire('pointermove', sourceBox.x + 30, sourceBox.y + 20); // cross the threshold
    fire('pointermove', targetBox.x + 30, targetBox.y + 4); // first target's TOP quarter
    await waitFor(async () => {
      const indicator = canvasElement.querySelector<HTMLElement>('.bldr-drop-indicator');
      await expect(indicator?.style.visibility).toBe('visible');
      // The indicator sits at the target's top edge — the "before" gap.
      const box = indicator?.getBoundingClientRect();
      await expect(Math.abs((box?.y ?? -99) - targetBox.y)).toBeLessThan(6);
    });
    fire('pointerup', targetBox.x + 30, targetBox.y + 4);

    await waitFor(async () => {
      await expect(order()[0]).toBe(lastId); // the last child became first
    });
    await expect(dragKernel.transactions().length).toBe(txBefore + 1); // exactly one
  },
};

const dragRtlKernel = makeKernel('rtl');
export const DragRearrangeRtl: Story = {
  args: { kernel: dragRtlKernel, theme: lightTheme, editable: true },
  play: async ({ canvasElement }) => {
    // Browser-truth RTL drag (FR-011): identical gesture semantics under RTL
    // content — take the LAST child, drop it BEFORE the first (idempotent).
    const frame = frameOf(canvasElement);
    const frameDocument = frame.contentDocument;
    if (frameDocument === null) {
      throw new Error('no frame document');
    }
    await waitFor(async () => {
      await expect(frameDocument.documentElement.getAttribute('dir')).toBe('rtl');
      await expect(frameDocument.querySelector('[data-bldr-node="one"]')).toBeTruthy();
    });
    const order = () => dragRtlKernel.getDocument().nodes['root']?.slots?.['default'] ?? [];
    const lastId = order().at(-1);
    const firstId = order()[0];
    if (lastId === undefined || firstId === undefined) {
      throw new Error('demo document must have children');
    }
    const sourceBox = frameDocument
      .querySelector(`[data-bldr-node="${lastId}"]`)
      ?.getBoundingClientRect();
    const targetBox = frameDocument
      .querySelector(`[data-bldr-node="${firstId}"]`)
      ?.getBoundingClientRect();
    if (sourceBox === undefined || targetBox === undefined) {
      throw new Error('blocks must have geometry');
    }
    const txBefore = dragRtlKernel.transactions().length;
    const fire = (type: string, x: number, y: number) => {
      frameDocument.dispatchEvent(
        new PointerEvent(type, { clientX: x, clientY: y, bubbles: true }),
      );
    };
    fire('pointerdown', sourceBox.x + 20, sourceBox.y + 10);
    fire('pointermove', sourceBox.x + 30, sourceBox.y + 20);
    fire('pointermove', targetBox.x + 30, targetBox.y + 4);
    await waitFor(async () => {
      const indicator = canvasElement.querySelector<HTMLElement>('.bldr-drop-indicator');
      await expect(indicator?.style.visibility).toBe('visible');
    });
    fire('pointerup', targetBox.x + 30, targetBox.y + 4);
    await waitFor(async () => {
      await expect(order()[0]).toBe(lastId);
    });
    await expect(dragRtlKernel.transactions().length).toBe(txBefore + 1);
  },
};

export const DarkTheme: Story = {
  args: { kernel: makeKernel(), theme: darkTheme },
};

export const DeviceWidth: Story = {
  args: { kernel: makeKernel(), theme: lightTheme, frameWidth: 834, breakpoint: 'tablet' },
  play: async ({ canvasElement }) => {
    // Browser truth (007 contract §7): the device switch narrows the REAL
    // frame — the shell measures 834px and the iframe fills it exactly.
    const shell = canvasElement.querySelector<HTMLElement>('.bldr-canvas-frame-shell');
    await expect(shell).not.toBeNull();
    const width = shell?.getBoundingClientRect().width ?? 0;
    await expect(width).toBe(834);
    const frame = frameOf(canvasElement);
    await expect(frame.getBoundingClientRect().width).toBe(width);
  },
};
