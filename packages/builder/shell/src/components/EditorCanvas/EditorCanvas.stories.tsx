import { isValidElement } from 'react';

import { expect, userEvent, waitFor, within } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { RichText, darkTheme, lightTheme } from '@craftkit/builder-renderer';
import {
  defineBlockSchema,
  emptyRichText,
  richText,
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

export const ZoomedDeviceWidth: Story = {
  args: {
    kernel: makeKernel(),
    theme: lightTheme,
    frameWidth: 1280,
    breakpoint: 'desktop',
    zoom: 0.5,
  },
  play: async ({ canvasElement }) => {
    const shell = canvasElement.querySelector<HTMLElement>('.bldr-canvas-frame-shell');
    const viewport = canvasElement.querySelector<HTMLElement>('.bldr-canvas-viewport');
    await expect(shell?.style.inlineSize).toBe('1280px');
    await expect(viewport?.style.inlineSize).toBe('640px');
    await expect(shell?.style.transform).toBe('scale(0.5)');
  },
};

// ── B3c: inline editing and the floating toolbars ───────────────────────────
// Browser truth is the point of these three. jsdom has no layout, so it cannot
// answer the questions that decide whether this milestone FEELS right: does the
// editor land on the text, does a toolbar sit over its target, does pressing a
// formatting button leave the caret alone. Chromium can.

const EditableText = ((props: BlockRenderProps<{ label: string }>) => (
  <p
    data-demo-node={props.node.id}
    style={{ font: '600 24px/1.3 system-ui, sans-serif', margin: 0, padding: '16px 20px' }}
  >
    {props.props.label}
  </p>
)) as unknown as BlockRenderComponent;

const editableBlocks = (
  extra?: TrustedExtensionManifest['contributes'],
): TrustedExtensionManifest => ({
  tier: 1,
  name: 'canvas-editable-blocks',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'edit-page',
          description: 'Editable page',
          props: z.object({}),
          slots: { default: { allow: ['edit-text'] } },
          examples: [],
        }),
        render: Root,
      },
      {
        schema: defineBlockSchema({
          type: 'edit-text',
          description: 'Editable text',
          props: z.object({ label: z.string().default('Text') }),
          inlineEditable: 'label',
          examples: [],
        }),
        render: EditableText,
      },
    ],
    ...extra,
  },
});

const editableDocument = (dir: 'ltr' | 'rtl' = 'ltr'): BuilderDocument => ({
  schemaVersion: 1,
  surface: 'site',
  dir,
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'edit-page', props: {}, slots: { default: ['first', 'second'] } },
    first: {
      id: 'first',
      type: 'edit-text',
      props: { label: dir === 'rtl' ? 'حرّر هذا النص' : 'Edit this line' },
    },
    second: {
      id: 'second',
      type: 'edit-text',
      props: { label: dir === 'rtl' ? 'وهذا أيضًا' : 'And this one' },
    },
  },
});

const editableKernel = (
  dir: 'ltr' | 'rtl' = 'ltr',
  extra?: TrustedExtensionManifest['contributes'],
) =>
  createBuilder({
    document: editableDocument(dir),
    extensions: [editableBlocks(extra)],
    ports: { clock: fixedClock(), ids: seededIds('inline-story') },
  });

/** Props are JsonValue: read the label as the string this block declares. */
const labelOf = (kernel: ReturnType<typeof createBuilder>, id: string): string => {
  const value = kernel.getDocument().nodes[id]?.props['label'];
  return typeof value === 'string' ? value : '';
};

/** Renders the swapped-in editor when editing, the stored prose otherwise. */
const Prose = ((props: BlockRenderProps<{ body: unknown }>) => (
  <p
    data-demo-node={props.node.id}
    style={{ font: '400 22px/1.5 Georgia, serif', margin: 0, padding: '20px 24px' }}
  >
    {isValidElement(props.props.body) ? props.props.body : <RichText value={props.props.body} />}
  </p>
)) as unknown as BlockRenderComponent;

const proseBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'canvas-prose-blocks',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'prose-page',
          description: 'Prose page',
          props: z.object({}),
          slots: { default: { allow: ['prose'] } },
          examples: [],
        }),
        render: Root,
      },
      {
        schema: defineBlockSchema({
          type: 'prose',
          description: 'Prose',
          props: z.object({ body: richText().default(emptyRichText() as never) }),
          inlineEditable: 'body',
          examples: [],
        }),
        render: Prose,
      },
    ],
  },
};

const inlineKernel = editableKernel();
export const InlineEditing: Story = {
  args: { kernel: inlineKernel, theme: lightTheme, editable: true },
  play: async ({ canvasElement }) => {
    // BROWSER TRUTH: a double-click inside the preview opens the declared
    // property where the text is drawn — same box, same typography — and a real
    // input event commits through the door. Written relative to the current
    // value so an Interactions rerun proves the same property.
    const frame = frameOf(canvasElement);
    const target = await waitFor(() => {
      const found = frame.contentDocument?.querySelector<HTMLElement>('[data-bldr-node="first"]');
      if (!found) {
        throw new Error('the first block must render');
      }
      return found;
    });
    inlineKernel.setSelection(['first']);
    const box = target.getBoundingClientRect();
    frame.contentDocument?.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
      }),
    );

    const surface = await waitFor(() => {
      const found = frame.contentDocument?.querySelector<HTMLElement>('.bldr-inline-text');
      if (!found) {
        throw new Error('the inline surface must open in place');
      }
      return found;
    });
    // It is EDITABLE on first paint — a keystroke in a not-yet-live frame is
    // dropped by a real browser, and only a browser can catch that.
    await expect(surface).toHaveAttribute('contenteditable', 'plaintext-only');
    // POLISH LAW: the selection outline and its label stand down while the
    // surface is open — one focus ring, never three stacked chromes.
    const outline = canvasElement.querySelector<HTMLElement>('.bldr-outline--selection');
    if (outline !== null) {
      await expect(outline).not.toBeVisible();
    }
    // …and it occupies the text's own box, not a dialog somewhere else.
    const surfaceBox = surface.getBoundingClientRect();
    await expect(Math.abs(surfaceBox.y - box.y)).toBeLessThan(24);

    const before = labelOf(inlineKernel, 'first');
    surface.textContent = `${before}!`;
    surface.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    await waitFor(async () => {
      await expect(inlineKernel.getDocument().nodes['first']?.props['label']).toBe(`${before}!`);
    });
  },
};

const actionKernel = editableKernel();
export const BlockActions: Story = {
  args: { kernel: actionKernel, theme: lightTheme, editable: true },
  play: async ({ canvasElement }) => {
    // BROWSER TRUTH: the bar is MEASURED and placed against the real outline —
    // the one thing the pure placement suite cannot check.
    const frame = frameOf(canvasElement);
    await waitFor(async () => {
      await expect(frame.contentDocument?.querySelector('[data-bldr-node="second"]')).toBeTruthy();
    });
    actionKernel.setSelection(['second']);

    const host = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>('.bldr-floating--actions');
      if (found?.style.visibility !== 'visible') {
        throw new Error('the action bar must be placed and visible');
      }
      return found;
    });
    const bar = host.querySelector<HTMLElement>('.bldr-block-actions');
    await expect(bar).toHaveAttribute('role', 'toolbar');
    await expect(bar).toHaveAccessibleName('Actions for Editable text');

    // It sits BELOW the block and CENTRED on it — the selection outline's name
    // chip owns the top-start corner, so the bar may never be placed there.
    const outline = canvasElement.querySelector<HTMLElement>('.bldr-outline--selection');
    const outlineBox = outline?.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    const centreOf = (box: DOMRect | undefined) =>
      box === undefined ? -999 : box.x + box.width / 2;
    await expect(Math.abs(centreOf(hostBox) - centreOf(outlineBox))).toBeLessThan(8);
    await expect(host.dataset['placement']).toBe('below');
    await expect(hostBox.y).toBeGreaterThan(outlineBox?.y ?? 0);

    // Duplicate is exactly one transaction and leaves the copy selected —
    // asserted RELATIVE to the current document so reruns stay honest.
    const before = actionKernel.getDocument().nodes['root']?.slots?.['default']?.length ?? 0;
    /*
      BY ACTION, not by position: Select parent now leads the bar and dispatches
      nothing, so `querySelector('button')` would silently press a different
      control and this story would assert the wrong thing while looking fine.
    */
    const duplicate = host.querySelector<HTMLButtonElement>('[data-action="duplicate"]');
    duplicate?.click();
    await waitFor(async () => {
      await expect(actionKernel.getDocument().nodes['root']?.slots?.['default']?.length).toBe(
        before + 1,
      );
    });
  },
};

/**
 * The bubble story runs on the BUILT-IN rich surface (009 §15) — no contributed
 * editor, no editing engine — so what you see here is what the builder does out
 * of the box: select a word, press Bold, and exactly that word is marked and
 * STORED. Nothing about this demo is painted on.
 */
const bubbleKernel = createBuilder({
  document: {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'prose-page', props: {}, slots: { default: ['intro'] } },
      intro: {
        id: 'intro',
        type: 'prose',
        props: {
          body: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Select a word in this line and press Bold.' }],
              },
            ],
          },
        },
      },
    },
  },
  extensions: [proseBlocks],
  ports: { clock: fixedClock(), ids: seededIds('bubble-story') },
});

export const FormattingBubble: Story = {
  args: { kernel: bubbleKernel, theme: lightTheme, editable: true },
  play: async ({ canvasElement }) => {
    // BROWSER TRUTH for the headline behaviour: select ONE WORD, press Bold,
    // and exactly that word is marked — in the stored document, not in CSS.
    // jsdom cannot do this at all: it has no layout and no real selection.
    const frame = frameOf(canvasElement);
    const target = await waitFor(() => {
      const found = frame.contentDocument?.querySelector<HTMLElement>('[data-bldr-node="intro"]');
      if (!found) {
        throw new Error('the prose block must render');
      }
      return found;
    });
    bubbleKernel.setSelection(['intro']);
    const box = target.getBoundingClientRect();
    frame.contentDocument?.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
      }),
    );

    const surface = await waitFor(() => {
      const found = frame.contentDocument?.querySelector<HTMLElement>('.bldr-inline-rich');
      if (!found) {
        throw new Error('the built-in rich surface must open in place');
      }
      return found;
    });
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (frameDocument === null || frameWindow === null) {
      throw new Error('the preview frame must expose its document and window');
    }

    // Select the word "word" through a REAL DOM range in the frame's own
    // selection — the same thing a double-click by hand produces.
    const applyWordSelection = () => {
      const walker = frameDocument.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
      const first = walker.nextNode();
      if (first === null) {
        throw new Error('the surface must render text');
      }
      const text = first.textContent ?? '';
      const at = text.indexOf('word');
      const range = frameDocument.createRange();
      range.setStart(first, at);
      range.setEnd(first, at + 'word'.length);
      const selection = frameWindow.getSelection();
      if (selection === null) {
        throw new Error('the preview frame must expose its selection');
      }
      selection.removeAllRanges();
      selection.addRange(range);
    };
    surface.focus();
    applyWordSelection();

    const host = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>('.bldr-floating--bubble');
      if (found?.style.visibility !== 'visible') {
        applyWordSelection(); // a focus race, not a failure — re-apply and wait
        throw new Error('the bubble must be placed and visible');
      }
      return found;
    });
    await expect(host.querySelector('.bldr-text-bubble')).toHaveAccessibleName('Formatting');

    // POLISH LAW: the surface's own focus ring is the only chrome while
    // editing — the selection outline and its name label stand down.
    const outline = canvasElement.querySelector<HTMLElement>('.bldr-outline--selection');
    if (outline !== null) {
      await expect(outline).not.toBeVisible();
    }

    // RISK 2, in a real browser: pressing an action must not move focus, or
    // Bold would destroy the very selection it formats.
    const bold = within(host).getByRole('button', { name: 'Bold' });
    // KEYBOARD TRUTH: once an iframe descendant owns focus, the HOST document's
    // active element is the iframe while the FRAME document's active element is
    // the editor. Storybook's direct `userEvent.tab()` is host-scoped, so it
    // would simulate tabbing FROM the iframe element and never deliver a key to
    // the editor. Scope the keyboard to the frame document, exactly where a real
    // user's Tab keydown is delivered, and prove that native listener fired.
    await expect(canvasElement.ownerDocument.activeElement).toBe(frame);
    await expect(frameDocument.activeElement).toBe(surface);
    const delivery: { event: KeyboardEvent | null } = { event: null };
    const observeFrameTab = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        delivery.event = event;
      }
    };
    surface.addEventListener('keydown', observeFrameTab, { capture: true, once: true });
    await userEvent.keyboard('{Tab}', { document: frameDocument });
    surface.removeEventListener('keydown', observeFrameTab, true);
    await expect(delivery.event).not.toBeNull();
    await expect(delivery.event?.defaultPrevented).toBe(true);
    await expect(bold).toHaveFocus();
    await expect(frameWindow.getSelection()?.toString()).toBe('word');

    const press = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    bold.dispatchEvent(press);
    await expect(press.defaultPrevented).toBe(true);

    // THE HEADLINE — asserted RELATIVE to the current state, so a rerun in the
    // Interactions panel proves the same property from wherever it starts.
    const beforeTx = bubbleKernel.transactions().length;
    const wasBold = bold.getAttribute('aria-pressed') === 'true';
    await userEvent.keyboard('{Enter}', { document: bold.ownerDocument });
    await waitFor(async () => {
      await expect(bubbleKernel.transactions().length).toBe(beforeTx + 1);
    });
    const strong = frame.contentDocument?.querySelector('.bldr-inline-rich strong');
    if (wasBold) {
      await expect(strong).toBeNull(); // toggled OFF — and nothing else changed
    } else {
      await expect(strong?.textContent).toBe('word'); // exactly the selection
    }
    // The paragraph's text is untouched either way: formatting marks it, never
    // rewrites it.
    await expect(frame.contentDocument?.querySelector('.bldr-inline-rich')?.textContent).toBe(
      'Select a word in this line and press Bold.',
    );

    // Escape from HOST chrome returns to the frame editor first, preserving the
    // semantic selection; a SECOND Escape from the editor keeps the established
    // session-exit path and restores the stable canvas continuation target.
    const continuation = canvasElement.querySelector<HTMLElement>('.bldr-canvas-host');
    if (continuation === null) {
      throw new Error('the canvas continuation region must stay mounted');
    }
    await expect(bold).toHaveFocus();
    await userEvent.keyboard('{Escape}', { document: bold.ownerDocument });
    await expect(surface).toHaveFocus();
    await expect(frameWindow.getSelection()?.toString()).toBe('word');
    await expect(frameDocument.querySelector('.bldr-inline-rich')).not.toBeNull();
    await expect(canvasElement.ownerDocument.activeElement).toBe(frame);
    await expect(frameDocument.activeElement).toBe(surface);

    await userEvent.keyboard('{Escape}', { document: frameDocument });
    await waitFor(async () => {
      await expect(frameDocument.querySelector('.bldr-inline-rich')).toBeNull();
      await expect(continuation).toHaveFocus();
    });
  },
};
