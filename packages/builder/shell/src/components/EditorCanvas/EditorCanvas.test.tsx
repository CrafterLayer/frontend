import { isValidElement } from 'react';

import { act, render, screen } from '@testing-library/react';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder, insertedNodeId } from '@craftkit/builder-core';
import { fixedClock, seededIds, stressDocument } from '@craftkit/builder-core/testing';
import { lightTheme } from '@craftkit/builder-renderer';
import {
  defineBlockSchema,
  emptyRichText,
  richText,
  type BlockRenderComponent,
  type BuilderDocument,
  type InlineEditorProps,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { GeometryPorts } from '../../rects';
import { EditorCanvas, type CanvasDragHandle } from './EditorCanvas';

// Pass-through renderers so the whole tree MOUNTS (fixture NullRenders would
// leave slot children unmounted and nothing to attach geometry to).
const PassThrough: BlockRenderComponent = ((props: { slots: Record<string, unknown> }) => (
  <div>{Object.values(props.slots) as React.ReactNode[]}</div>
)) as BlockRenderComponent;

const block = (type: string, description: string, slots?: Record<string, { allow: string[] }>) => ({
  schema: defineBlockSchema({
    type,
    description,
    props: z.object({ label: z.string().default('') }),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: PassThrough,
});

/** Renders its label, so an inline swap is VISIBLE in the frame. */
const LabelRender: BlockRenderComponent = ((props: { props: { label?: unknown } }) => (
  <span data-testid="label">{props.props.label as React.ReactNode}</span>
)) as BlockRenderComponent;

const inlineBlock = (type: string, description: string, editable: boolean) => ({
  schema: defineBlockSchema({
    type,
    description,
    props: z.object({ label: z.string().default('') }),
    ...(editable ? { inlineEditable: 'label' } : {}),
    examples: [],
  }),
  render: LabelRender,
});

const TEST_BLOCKS: TrustedExtensionManifest = {
  tier: 1,
  name: 'shell-test-blocks',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', 'Page', { default: { allow: ['section'] } }),
      block('section', 'Section', { default: { allow: ['text', 'section'] } }),
      block('text', 'Text'),
    ],
  },
};

const TEST_DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['a', 'b', 'c'] } },
    a: { id: 'a', type: 'section', props: {} },
    b: { id: 'b', type: 'section', props: {}, slots: { default: ['b1'] } },
    b1: { id: 'b1', type: 'text', props: {} },
    c: { id: 'c', type: 'section', props: {} },
  },
};

function harness(
  document: BuilderDocument = TEST_DOC,
  options: {
    dirAwareMeasure?: boolean;
    editable?: boolean;
    /** Per-node geometry (preview-local); falls back to the constant box. */
    rects?: Record<string, { x: number; y: number; width: number; height: number }>;
    onDragHandle?: (handle: CanvasDragHandle) => void;
    frameWidth?: number;
  } = {},
) {
  const kernel = createBuilder({
    document,
    extensions: [TEST_BLOCKS],
    ports: { clock: fixedClock(), ids: seededIds('ec') },
  });
  const queue: (() => void)[] = [];
  let hitTarget: Element | null = null;
  const renders: string[] = [];
  // jsdom has no layout, so a dir-aware stub stands in for the real reflow: an
  // RTL document mirrors the box, exactly as a browser would. That makes the
  // COMPOSED chain observable here (setDocMeta → frame root dir → index dir
  // observer → flush → re-track); real geometry stays a Chromium play() proof.
  let measuredDir: 'ltr' | 'rtl' = document.dir;
  const ports: Partial<GeometryPorts> = {
    measure: (element) => {
      const id = element.getAttribute('data-bldr-node');
      const table = options.rects?.[id ?? ''];
      if (table !== undefined) {
        return table;
      }
      return options.dirAwareMeasure === true && measuredDir === 'rtl'
        ? { x: 205, y: 6, width: 50, height: 20 }
        : { x: 5, y: 6, width: 50, height: 20 };
    },
    hitTest: () => hitTarget,
    viewport: () => ({ width: 400, height: 600 }),
    schedule: (callback) => {
      queue.push(callback);
      return () => {
        const at = queue.indexOf(callback);
        if (at >= 0) {
          queue.splice(at, 1);
        }
      };
    },
  };
  const view = render(
    <EditorCanvas
      kernel={kernel}
      theme={lightTheme}
      geometryPorts={ports}
      onBlockRender={(id) => renders.push(id)}
      editable={options.editable ?? false}
      onDragHandle={options.onDragHandle}
      frameWidth={options.frameWidth}
    />,
  );
  const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
  const frameDocument = frame.contentDocument;
  if (frameDocument === null) {
    throw new Error('frame must expose a document in jsdom');
  }
  const tick = () => {
    act(() => {
      const pending = queue.splice(0);
      for (const callback of pending) {
        callback();
      }
    });
  };
  const wrapperOf = (id: string) =>
    frameDocument.querySelector<HTMLElement>(`[data-bldr-node="${id}"]`);
  const pointerMove = (target: Element | null) => {
    hitTarget = target;
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('pointermove', { clientX: 1, clientY: 1 }));
    });
  };
  const click = (target: Element | null) => {
    hitTarget = target;
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 1 }));
    });
  };
  const pointerDown = (target: Element | null, x: number, y: number) => {
    hitTarget = target;
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('pointerdown', { clientX: x, clientY: y }));
    });
  };
  const pointerMoveAt = (target: Element | null, x: number, y: number) => {
    hitTarget = target;
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }));
    });
  };
  const pointerUp = () => {
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('pointerup', {}));
    });
  };
  const outline = (kind: 'hover' | 'selection') =>
    view.container.querySelector<HTMLElement>(`.bldr-outline--${kind}`);
  /** Flip the DOCUMENT direction through the real command door, no interaction. */
  const flipDir = async (next: 'ltr' | 'rtl') => {
    measuredDir = next;
    act(() => {
      kernel.dispatch('setDocMeta', { dir: next });
    });
    // The frame-root dir write and its MutationObserver are async in jsdom.
    await act(async () => {
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(frameDocument.documentElement.getAttribute('dir')).toBe(next);
    });
    tick();
  };
  return {
    kernel,
    view,
    frameDocument,
    tick,
    wrapperOf,
    pointerMove,
    click,
    pointerDown,
    pointerMoveAt,
    pointerUp,
    outline,
    flipDir,
    renders,
  };
}

/** Vertically stacked per-node geometry for band/half math in drag tests. */
const DRAG_RECTS = {
  root: { x: 0, y: 0, width: 400, height: 600 },
  a: { x: 10, y: 10, width: 380, height: 100 },
  b: { x: 10, y: 120, width: 380, height: 100 },
  b1: { x: 20, y: 130, width: 360, height: 40 },
  c: { x: 10, y: 230, width: 380, height: 100 },
};

describe('EditorCanvas (005 US1)', () => {
  it('sweep, hover, select, and clear cause ZERO content re-renders (SC-001)', () => {
    const h = harness();
    h.tick();
    h.renders.length = 0;

    h.pointerMove(h.wrapperOf('a'));
    h.tick();
    expect(h.outline('hover')?.style.visibility).toBe('visible');
    expect(h.outline('hover')?.textContent).toBe('Section');

    h.pointerMove(h.wrapperOf('b'));
    h.pointerMove(h.wrapperOf('c'));
    h.tick();
    h.click(h.wrapperOf('b'));
    h.tick();
    expect(h.outline('selection')?.style.visibility).toBe('visible');
    expect(h.kernel.context.store.getState().selection).toEqual(['b']);

    h.click(null); // empty canvas clears
    h.tick();
    expect(h.kernel.context.store.getState().selection).toEqual([]);
    expect(h.outline('selection')?.style.visibility).toBe('hidden');

    expect(h.renders).toEqual([]); // the whole interaction storm re-rendered nothing
  });

  it('programmatic selection renders identically — single source of truth (FR-004)', () => {
    const h = harness();
    act(() => {
      h.kernel.setSelection(['c']);
    });
    h.tick();
    expect(h.outline('selection')?.style.visibility).toBe('visible');
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent('Section selected');
  });

  it('keyboard traversal walks siblings, steps in and out, and Escape clears (US3/SC-004)', async () => {
    const h = harness();
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    host.focus();

    await user.keyboard('{ArrowDown}');
    expect(h.kernel.context.store.getState().selection).toEqual(['a']);
    await user.keyboard('{ArrowDown}');
    expect(h.kernel.context.store.getState().selection).toEqual(['b']);
    await user.keyboard('{ArrowRight}'); // into b's slot
    expect(h.kernel.context.store.getState().selection).toEqual(['b1']);
    await user.keyboard('{ArrowLeft}'); // back out
    expect(h.kernel.context.store.getState().selection).toEqual(['b']);
    await user.keyboard('{Escape}');
    expect(h.kernel.context.store.getState().selection).toEqual([]);
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent(
      'Selection cleared',
    );
  });

  it('an undo that removes the selected node hides its chrome (FR-007/SC-003)', () => {
    const h = harness();
    let inserted: string | undefined;
    act(() => {
      const tx = h.kernel.dispatch('insertNode', { type: 'section', parentId: 'root' });
      inserted = insertedNodeId(tx.patches);
    });
    expect(inserted).toBeDefined();
    act(() => {
      h.kernel.setSelection([inserted ?? '']);
    });
    h.tick();
    expect(h.outline('selection')?.style.visibility).toBe('visible');

    act(() => {
      h.kernel.undo();
    });
    h.tick();
    expect(h.outline('selection')?.style.visibility).toBe('hidden');
    // The kernel itself pruned the dangling id, so every surface agrees: the
    // announcer says "cleared" instead of reading a raw internal id aloud.
    expect(h.kernel.context.store.getState().selection).toEqual([]);
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent(
      'Selection cleared',
    );
  });

  it('a click inside the frame returns focus to the canvas so traversal keeps working', async () => {
    const h = harness();
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    // Focus starts elsewhere; the in-frame click must pull it back to the host.
    h.click(h.wrapperOf('b'));
    expect(h.kernel.context.store.getState().selection).toEqual(['b']);
    expect(document.activeElement).toBe(host);

    await user.keyboard('{ArrowDown}');
    expect(h.kernel.context.store.getState().selection).toEqual(['c']);
  });

  it('traversal also works when focus sits INSIDE the frame (belt and braces)', () => {
    const h = harness();
    act(() => {
      h.kernel.setSelection(['a']);
    });
    act(() => {
      h.frameDocument.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
    });
    expect(h.kernel.context.store.getState().selection).toEqual(['b']);
  });

  it('holds the zero-render law on the 1,000-node stress document (FR-015/US1-AC5)', () => {
    const h = harness(stressDocument(1000));
    h.tick();
    h.renders.length = 0;

    // The counter is only meaningful if the sweep actually resolved to nodes:
    // assert live hover chrome per step (label = the block's schema description).
    // Transforms are NOT asserted here — this harness injects one constant
    // measurement for every node, so real geometry is a Chromium play() proof.
    for (const [id, label] of [
      ['txt-1-1', 'Text'],
      ['txt-5-5', 'Text'],
      ['sec-9', 'Section'],
      ['txt-10-9', 'Text'],
    ] as const) {
      h.pointerMove(h.wrapperOf(id));
      h.tick();
      expect(h.outline('hover')?.style.visibility).toBe('visible');
      expect(h.outline('hover')?.textContent).toBe(label);
    }

    h.click(h.wrapperOf('txt-5-5'));
    h.tick();
    expect(h.kernel.context.store.getState().selection).toEqual(['txt-5-5']);
    expect(h.outline('selection')?.style.visibility).toBe('visible');

    h.click(null); // empty canvas clears, at stress scale too
    h.tick();
    expect(h.kernel.context.store.getState().selection).toEqual([]);
    expect(h.outline('selection')?.style.visibility).toBe('hidden');

    expect(h.renders).toEqual([]); // …and none of it re-rendered any content
  });

  it('a LIVE direction flip re-tracks chrome with zero interaction (FR-011/SC-002/US2-AC4)', async () => {
    // The composed chain, end to end: setDocMeta (through the real command door)
    // → CanvasFrame writes dir on the frame root → the rect index's dir observer
    // invalidates → the controller flushes → the outline lands on the new box.
    const h = harness(TEST_DOC, { dirAwareMeasure: true });
    act(() => {
      h.kernel.setSelection(['b']);
    });
    h.tick();
    expect(h.outline('selection')?.style.transform).toBe('translate(5px, 6px)');

    await h.flipDir('rtl');
    expect(h.kernel.getDocument().dir).toBe('rtl');
    expect(h.outline('selection')?.style.visibility).toBe('visible');
    expect(h.outline('selection')?.style.transform).toBe('translate(205px, 6px)');

    await h.flipDir('ltr'); // and back — the channel is not one-way
    expect(h.outline('selection')?.style.transform).toBe('translate(5px, 6px)');
  });

  it('Law-S: the 1:1 change↔transaction audit holds with the canvas mounted (FR-017)', () => {
    const h = harness();
    let stateChanges = 0;
    let txApplied = 0;
    h.kernel.context.store.subscribe(() => {
      stateChanges += 1;
    });
    h.kernel.context.events.on('tx.applied', () => {
      txApplied += 1;
    });

    act(() => {
      h.kernel.dispatch('setProp', { id: 'a', key: 'label', value: 'audited' });
    });
    act(() => {
      expect(() => h.kernel.dispatch('insertNode', { type: 'text', parentId: 'ghost' })).toThrow();
    });
    act(() => {
      h.kernel.undo();
    });
    act(() => {
      h.kernel.setSelection(['a']);
    });

    expect(txApplied).toBe(1);
    expect(stateChanges).toBe(3); // command + undo + selection — nothing extra from the canvas
  });
});

describe('EditorCanvas drag editing (006 US1)', () => {
  const dragHarness = () => harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });

  it('AC1+AC6: a gap drop reorders in ONE transaction with ZERO pre-drop re-renders', () => {
    const h = dragHarness();
    h.tick();
    h.renders.length = 0;

    h.pointerDown(h.wrapperOf('c'), 200, 280);
    h.pointerMoveAt(h.wrapperOf('c'), 205, 270); // crosses the threshold
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125); // b's top quarter → BEFORE b
    h.tick();
    expect(h.renders).toEqual([]); // chrome-only so far (FR-002/SC-001)
    const indicator = h.view.container.querySelector<HTMLElement>('.bldr-drop-indicator');
    expect(indicator?.style.visibility).toBe('visible');

    h.pointerUp();
    expect(h.kernel.transactions()).toHaveLength(1);
    expect(h.kernel.getDocument().nodes['root']?.slots?.['default']).toEqual(['a', 'c', 'b']);
    expect(h.kernel.context.store.getState().selection).toEqual(['c']);

    act(() => {
      h.kernel.undo(); // one undoable step
    });
    expect(h.kernel.getDocument().nodes['root']?.slots?.['default']).toEqual(['a', 'b', 'c']);
  });

  it('AC2: the indicator flips before/after with the pointer half', () => {
    const h = dragHarness();
    h.tick();
    h.pointerDown(h.wrapperOf('c'), 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125); // top quarter → before
    h.tick();
    const indicator = h.view.container.querySelector<HTMLElement>('.bldr-drop-indicator');
    const beforeY = indicator?.style.transform;
    h.pointerMoveAt(h.wrapperOf('b'), 200, 215); // bottom quarter → after
    h.tick();
    expect(indicator?.style.transform).not.toBe(beforeY);
    h.pointerUp();
  });

  it('AC3+AC5: no valid target anywhere ⇒ release is a zero-trace cancel', () => {
    const h = dragHarness();
    h.tick();
    const before = h.kernel.getDocument();
    // b1 is a TEXT: root rejects text, so empty-canvas hover offers nothing.
    h.pointerDown(h.wrapperOf('b1'), 200, 150);
    h.pointerMoveAt(h.wrapperOf('b1'), 208, 158);
    h.pointerMoveAt(null, 200, 590);
    h.tick();
    expect(
      h.view.container.querySelector<HTMLElement>('.bldr-drop-indicator')?.style.visibility,
    ).not.toBe('visible');
    h.pointerUp();
    expect(h.kernel.getDocument()).toBe(before);
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(screen.getByRole('status', { name: 'Gesture' })).toHaveTextContent('No valid target');
  });

  it('AC5: Escape mid-drag cancels with zero trace and keeps the selection', () => {
    const h = dragHarness();
    h.tick();
    act(() => {
      h.kernel.setSelection(['a']);
    });
    const before = h.kernel.getDocument();
    h.pointerDown(h.wrapperOf('c'), 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);
    h.tick();
    act(() => {
      h.frameDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(h.kernel.getDocument()).toBe(before);
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(h.kernel.context.store.getState().selection).toEqual(['a']); // Escape ate by the session
    expect(h.view.container.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility).toBe(
      'hidden',
    );
  });

  it('a sub-threshold press stays a plain click (selection, no drag chrome)', () => {
    const h = dragHarness();
    h.tick();
    h.pointerDown(h.wrapperOf('b'), 200, 150);
    h.pointerMoveAt(h.wrapperOf('b'), 201, 151);
    h.pointerUp();
    h.click(h.wrapperOf('b'));
    expect(h.kernel.context.store.getState().selection).toEqual(['b']);
    expect(h.kernel.transactions()).toHaveLength(0);
  });

  it('FR-014: the Law-S audit holds across a full drag interaction', () => {
    const h = dragHarness();
    h.tick();
    let stateChanges = 0;
    let txApplied = 0;
    h.kernel.context.store.subscribe(() => {
      stateChanges += 1;
    });
    h.kernel.context.events.on('tx.applied', () => {
      txApplied += 1;
    });

    // A cancelled drag contributes ZERO…
    h.pointerDown(h.wrapperOf('c'), 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);
    h.tick();
    act(() => {
      h.frameDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(stateChanges).toBe(0);

    // …a committed one contributes exactly one transaction + one selection write.
    h.pointerDown(h.wrapperOf('c'), 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);
    h.tick();
    h.pointerUp();
    expect(txApplied).toBe(1);
    expect(stateChanges).toBe(2); // tx write + selection bookkeeping write
  });

  it('FR-012: without editable, pointer presses never start a session', () => {
    const h = harness(TEST_DOC, { rects: DRAG_RECTS }); // editable absent
    h.tick();
    const before = h.kernel.getDocument();
    h.pointerDown(h.wrapperOf('c'), 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);
    h.tick();
    h.pointerUp();
    expect(h.kernel.getDocument()).toBe(before);
    expect(h.view.container.querySelector<HTMLElement>('.bldr-drag-ghost')).toBeNull(); // the chrome does not even exist
  });

  it('FR-015: the stress document drags with zero pre-drop re-renders', () => {
    const h = harness(stressDocument(1000), { editable: true });
    h.tick();
    h.renders.length = 0;
    h.pointerDown(h.wrapperOf('txt-5-5'), 10, 10);
    h.pointerMoveAt(h.wrapperOf('txt-7-3'), 18, 18);
    h.pointerMoveAt(h.wrapperOf('txt-9-1'), 30, 7); // top quarter of the constant box
    h.tick();
    expect(h.renders).toEqual([]);
    act(() => {
      h.frameDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(h.kernel.transactions()).toHaveLength(0);
  });
});

describe('EditorCanvas keyboard arrangement (006 US4)', () => {
  it('Alt+Down/Up reorder in one transaction each; edges clamp with announcements', async () => {
    const h = harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    act(() => {
      h.kernel.setSelection(['b']);
    });
    host.focus();

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(h.kernel.getDocument().nodes['root']?.slots?.['default']).toEqual(['a', 'c', 'b']);
    expect(h.kernel.transactions()).toHaveLength(1);
    expect(h.kernel.context.store.getState().selection).toEqual(['b']);
    expect(screen.getByRole('status', { name: 'Gesture' })).toHaveTextContent('later');

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}'); // already last — clamp
    expect(h.kernel.transactions()).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Gesture' })).toHaveTextContent('Already last');
  });

  it('Alt+ArrowLeft moves out only when rules accept; rejection announces the reason', async () => {
    const h = harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    act(() => {
      h.kernel.setSelection(['b1']); // a TEXT inside b — root rejects text
    });
    host.focus();

    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(screen.getByRole('status', { name: 'Gesture' })).toHaveTextContent('Cannot move out');
  });

  it('plain arrows still traverse when Alt is not held (no regression)', async () => {
    const h = harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    host.focus();
    await user.keyboard('{ArrowDown}');
    expect(h.kernel.context.store.getState().selection).toEqual(['a']);
    expect(h.kernel.transactions()).toHaveLength(0);
  });
});

describe('Palette insert-drag through the canvas handle (006 US2/T010)', () => {
  it('bridges host coordinates, resolves a gap, and dispatches ONE insertNode', () => {
    let handle: CanvasDragHandle | undefined;
    const h = harness(TEST_DOC, {
      editable: true,
      rects: DRAG_RECTS,
      onDragHandle: (received) => {
        handle = received;
      },
    });
    h.tick();
    expect(handle).toBeDefined();

    // The jsdom frame reports a zero rect, so host≡frame coordinates here; the
    // bridge math itself is exercised (subtraction of the frame box).
    act(() => {
      handle?.beginInsert('section', 200, 300);
    });
    // A palette CLICK (no movement) must stay pending — the session activates
    // only after real host movement crosses the threshold:
    const hostDoc = h.frameDocument.defaultView?.frameElement?.ownerDocument;
    act(() => {
      hostDoc?.dispatchEvent(new PointerEvent('pointermove', { clientX: 212, clientY: 312 }));
    });
    // Aim at b's top quarter via the injected hit-test (frame-local 200,125):
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);
    h.tick();

    const hostDocument = h.frameDocument.defaultView?.frameElement?.ownerDocument;
    act(() => {
      hostDocument?.dispatchEvent(new PointerEvent('pointerup', {}));
    });
    expect(h.kernel.transactions()).toHaveLength(1);
    const children = h.kernel.getDocument().nodes['root']?.slots?.['default'];
    expect(children).toHaveLength(4);
    const insertedAt = children?.indexOf(h.kernel.context.store.getState().selection[0] ?? '');
    expect(insertedAt).toBe(1); // BEFORE b
    expect(h.kernel.getDocument().nodes[children?.[1] ?? '']?.type).toBe('section');
  });

  it('a palette drag released over nothing valid cancels with zero trace', () => {
    let handle: CanvasDragHandle | undefined;
    const h = harness(TEST_DOC, {
      editable: true,
      rects: DRAG_RECTS,
      onDragHandle: (received) => {
        handle = received;
      },
    });
    h.tick();
    const before = h.kernel.getDocument();
    act(() => {
      handle?.beginInsert('text', 200, 300); // root rejects text everywhere
    });
    act(() => {
      h.frameDocument.defaultView?.frameElement?.ownerDocument.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 212, clientY: 312 }),
      );
    });
    h.pointerMoveAt(null, 200, 590);
    h.tick();
    const hostDocument = h.frameDocument.defaultView?.frameElement?.ownerDocument;
    act(() => {
      hostDocument?.dispatchEvent(new PointerEvent('pointerup', {}));
    });
    expect(h.kernel.getDocument()).toBe(before);
    expect(h.kernel.transactions()).toHaveLength(0);
  });
});

describe('cross-document gesture safety (006 review Criticals)', () => {
  it('a canvas drag released on the HOST still commits — and the next click is NOT swallowed', () => {
    const h = harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });
    h.tick();
    h.pointerDown(h.wrapperOf('c'), 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125); // before b
    h.tick();

    // The pointer left the iframe; the release arrives on the HOST document.
    const hostDocument = h.frameDocument.defaultView?.frameElement?.ownerDocument;
    act(() => {
      hostDocument?.dispatchEvent(new PointerEvent('pointerup', {}));
    });
    expect(h.kernel.transactions()).toHaveLength(1); // the session is NOT stuck
    expect(h.kernel.getDocument().nodes['root']?.slots?.['default']).toEqual(['a', 'c', 'b']);

    // No suppress-flag leak: the next legitimate canvas click still selects.
    h.click(h.wrapperOf('a'));
    expect(h.kernel.context.store.getState().selection).toEqual(['a']);
  });

  it('host pointer positions OUTSIDE the viewport hide the target; a host release there cancels', () => {
    const h = harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });
    h.tick();
    const before = h.kernel.getDocument();
    h.pointerDown(h.wrapperOf('c'), 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);
    h.tick();

    // Drag out of the canvas: host coordinates bridge to out-of-viewport frame
    // space (jsdom frame box is 0,0 — host 200,900 → frame 200,900 ≥ height 600).
    const hostDocument = h.frameDocument.defaultView?.frameElement?.ownerDocument;
    act(() => {
      hostDocument?.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 900 }));
    });
    h.tick();
    expect(
      h.view.container.querySelector<HTMLElement>('.bldr-drop-indicator')?.style.visibility,
    ).not.toBe('visible');

    act(() => {
      hostDocument?.dispatchEvent(new PointerEvent('pointerup', {}));
    });
    expect(h.kernel.getDocument()).toBe(before); // zero-trace cancel
    expect(h.kernel.transactions()).toHaveLength(0);
  });

  it('a window blur mid-drag cancels with zero trace (events are gone for good)', () => {
    const h = harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });
    h.tick();
    const before = h.kernel.getDocument();
    h.pointerDown(h.wrapperOf('c'), 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);
    act(() => {
      h.frameDocument.defaultView?.frameElement?.ownerDocument.defaultView?.dispatchEvent(
        new Event('blur'),
      );
    });
    expect(h.kernel.getDocument()).toBe(before);
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(h.view.container.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility).toBe(
      'hidden',
    );
  });

  it('a REPEATED gesture outcome still mutates the live region (AT announcement)', async () => {
    const h = harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    act(() => {
      h.kernel.setSelection(['a']); // first sibling — Alt+Up clamps
    });
    host.focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    const region = screen.getByRole('status', { name: 'Gesture' });
    const firstText = region.textContent;
    expect(firstText).toContain('Already first');

    await user.keyboard('{Alt>}{ArrowUp}{/Alt}'); // SAME outcome again
    // The text node must have mutated (zero-width toggle) or AT hears nothing.
    expect(region.textContent).not.toBe(firstText);
    expect(region.textContent).toContain('Already first');
  });
});

describe('convergence: post-drop render scope + hand-built flow (006 audit)', () => {
  it('SC-001 second clause: the drop itself re-renders ONLY the affected parents', () => {
    const h = harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });
    h.tick();
    h.pointerDown(h.wrapperOf('c'), 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125); // before b (same parent: root)
    h.tick();
    h.renders.length = 0;
    h.pointerUp();
    // moveNode within root touches ONLY nodes/root — the memoized children
    // must not re-render; the mutated parent is the whole render set.
    expect(new Set(h.renders)).toEqual(new Set(['root']));
  });

  it('SC-001 second clause at stress scale: a cross-parent drop re-renders exactly both parents', () => {
    const h = harness(stressDocument(1000), { editable: true });
    h.tick();
    h.pointerDown(h.wrapperOf('txt-5-5'), 10, 10);
    h.pointerMoveAt(h.wrapperOf('txt-7-3'), 30, 7); // top quarter → before, in sec-7
    h.tick();
    h.renders.length = 0;
    h.pointerUp();
    expect(h.kernel.transactions()).toHaveLength(1);
    // Source parent (sec-5) lost a child, target parent (sec-7) gained one,
    // and the moved node itself remounts across parents (a REAL unmount+mount,
    // keyed identity cannot bridge two parents) — and NOTHING else re-rendered
    // on a 1,000-node document.
    expect(new Set(h.renders)).toEqual(new Set(['sec-5', 'sec-7', 'txt-5-5']));
  });

  it('SC-004 literally: palette inserts + a DRAG arrangement reproduce a declared target structure', () => {
    let handle: CanvasDragHandle | undefined;
    const h = harness(
      {
        schemaVersion: 1,
        surface: 'site',
        dir: 'ltr',
        rootId: 'root',
        nodes: { root: { id: 'root', type: 'page', props: {} } },
      },
      {
        editable: true,
        onDragHandle: (received) => {
          handle = received;
        },
      },
    );
    h.tick();
    const hostDoc = h.frameDocument.defaultView?.frameElement?.ownerDocument;
    const dragInsert = (type: string, hovered: string | null, frameY: number) => {
      act(() => {
        handle?.beginInsert(type, 200, 300);
      });
      act(() => {
        hostDoc?.dispatchEvent(new PointerEvent('pointermove', { clientX: 212, clientY: 312 }));
      });
      h.pointerMoveAt(hovered === null ? null : h.wrapperOf(hovered), 10, frameY);
      h.tick();
      h.pointerUp(); // frame release commits the insert
    };

    // Build: two sections dragged in from the palette, then a text into the first.
    dragInsert('section', null, 590); // empty canvas → into root (s#1)
    const first = h.kernel.getDocument().nodes['root']?.slots?.['default']?.[0] ?? '';
    dragInsert('section', first, 8); // first section's TOP quarter → BEFORE it (s#2)
    const top = h.kernel.getDocument().nodes['root']?.slots?.['default']?.[0] ?? '';
    dragInsert('text', top, 15); // middle band → INTO the top section

    // Arrange BY DRAG: move the bottom section above the top one.
    const order = h.kernel.getDocument().nodes['root']?.slots?.['default'] ?? [];
    const bottom = order[1] ?? '';
    h.pointerDown(h.wrapperOf(bottom), 10, 15);
    h.pointerMoveAt(h.wrapperOf(bottom), 18, 22);
    h.pointerMoveAt(h.wrapperOf(top), 10, 7); // top's upper quarter → before
    h.tick();
    h.pointerUp();

    // N inserts + M moves = N+M transactions, and the FINAL STRUCTURE equals
    // the declared target exactly: root → [bottom, top(text)], types checked.
    expect(h.kernel.transactions()).toHaveLength(4);
    const doc = h.kernel.getDocument();
    expect(doc.nodes['root']?.slots?.['default']).toEqual([bottom, top]);
    expect(doc.nodes[bottom]?.type).toBe('section');
    expect(doc.nodes[top]?.type).toBe('section');
    const innerText = doc.nodes[top]?.slots?.['default']?.[0] ?? '';
    expect(doc.nodes[innerText]?.type).toBe('text');
    expect(doc.nodes[top]?.slots?.['default']).toHaveLength(1);
  });

  it('an insert drag released ON THE FRAME never swallows the next canvas click (§9.3 mirror)', () => {
    let handle: CanvasDragHandle | undefined;
    const h = harness(TEST_DOC, {
      editable: true,
      rects: DRAG_RECTS,
      onDragHandle: (received) => {
        handle = received;
      },
    });
    h.tick();
    act(() => {
      handle?.beginInsert('section', 200, 300);
    });
    act(() => {
      h.frameDocument.defaultView?.frameElement?.ownerDocument.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 212, clientY: 312 }),
      );
    });
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);
    h.tick();
    h.pointerUp(); // FRAME release commits the insert…
    expect(h.kernel.transactions()).toHaveLength(1);

    // …and the very next legitimate frame click still selects (no stale flag).
    h.click(h.wrapperOf('a'));
    expect(h.kernel.context.store.getState().selection).toEqual(['a']);
  });

  it('a dir flip during an ACTIVE drag re-tracks the indicator without pointer movement', async () => {
    const h = harness(TEST_DOC, { editable: true, dirAwareMeasure: true });
    h.tick();
    h.pointerDown(h.wrapperOf('c'), 30, 15);
    h.pointerMoveAt(h.wrapperOf('b'), 30, 7); // before b (constant box: top quarter)
    h.tick();
    const indicator = h.view.container.querySelector<HTMLElement>('.bldr-drop-indicator');
    const before = indicator?.style.transform;
    expect(indicator?.style.visibility).toBe('visible');

    await h.flipDir('rtl'); // observation channel fires; the pointer never moved
    expect(indicator?.style.visibility).toBe('visible');
    expect(indicator?.style.transform).not.toBe(before); // re-resolved geometry
    act(() => {
      h.frameDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
  });
});

describe('EditorCanvas device width (007 §6)', () => {
  it('narrows and centers the frame shell, overlay sharing its origin', () => {
    const h = harness(TEST_DOC, { frameWidth: 834 });
    const shell = h.view.container.querySelector<HTMLElement>('.bldr-canvas-frame-shell');
    expect(shell).not.toBeNull();
    expect(shell?.style.inlineSize).toBe('834px');
    expect(shell?.style.maxInlineSize).toBe('100%');
    // The overlay layer lives INSIDE the shell: a centered frame keeps chrome
    // aligned by construction — no coordinate translation anywhere.
    const overlay = screen.getByTestId('bldr-overlay');
    expect(overlay.parentElement).toBe(shell);
    const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
    expect(frame.parentElement).toBe(shell);
  });

  it('absent frameWidth keeps the 005/006 full-width contract byte-compatible', () => {
    const h = harness();
    const shell = h.view.container.querySelector<HTMLElement>('.bldr-canvas-frame-shell');
    expect(shell?.getAttribute('style')).toBeNull();
  });
});

describe('EditorCanvas breakpoint rendering (007 review C1)', () => {
  it('renders responsive overrides at the given breakpoint THROUGH the real canvas', async () => {
    // The device width must drive one authority end-to-end: the same surface
    // the editor drags on must show the override being authored.
    const LabelRender: BlockRenderComponent = ((props: { props: { label?: string } }) => (
      <span data-testid="bp-label">{props.props.label ?? ''}</span>
    )) as BlockRenderComponent;
    const vocab: TrustedExtensionManifest = {
      tier: 1,
      name: 'bp-vocab',
      version: '1.0.0',
      contributes: {
        blocks: [
          {
            schema: defineBlockSchema({
              type: 'chip',
              description: 'Chip',
              props: z.object({ label: z.string().default('') }),
              examples: [],
            }),
            render: LabelRender,
          },
        ],
      },
    };
    const doc: BuilderDocument = {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'n1',
      nodes: {
        n1: {
          id: 'n1',
          type: 'chip',
          props: { label: 'Base' },
          responsive: { tablet: { label: 'Tablet' } },
        },
      },
    };
    const kernel = createBuilder({
      document: doc,
      extensions: [vocab],
      ports: { clock: fixedClock(), ids: seededIds('bp') },
    });
    const view = render(
      <EditorCanvas kernel={kernel} theme={lightTheme} breakpoint="tablet" frameWidth={834} />,
    );
    const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
    await vi.waitFor(() => {
      expect(frame.contentDocument?.querySelector('[data-testid="bp-label"]')?.textContent).toBe(
        'Tablet',
      );
    });

    view.rerender(<EditorCanvas kernel={kernel} theme={lightTheme} breakpoint="desktop" />);
    await vi.waitFor(() => {
      expect(frame.contentDocument?.querySelector('[data-testid="bp-label"]')?.textContent).toBe(
        'Base',
      );
    });
  });
});

describe('convergence fixes (007 §11)', () => {
  // The US4 edge case "Preview entered while a drag session is somehow pending:
  // the session cancels first" — preview entry unmounts the canvas, so THE
  // proof is unmount-mid-session: zero transactions, zero chrome traces, and
  // detached listeners (T021; the T012 record was structurally true, unbacked).
  it('T021: unmount mid-PENDING drag leaves zero trace and inert listeners', () => {
    const h = harness(TEST_DOC, { editable: true });
    h.tick();
    h.pointerDown(h.wrapperOf('c'), 30, 15); // pressed, below the 4px threshold
    const tx = h.kernel.transactions().length;

    expect(() => {
      h.view.unmount();
    }).not.toThrow();
    expect(h.kernel.transactions().length).toBe(tx);
    expect(document.querySelector('.bldr-overlay')).toBeNull();

    // A late frame gesture must be inert — every listener detached.
    act(() => {
      h.frameDocument.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 60 }));
      h.frameDocument.dispatchEvent(new MouseEvent('pointerup', {}));
    });
    expect(h.kernel.transactions().length).toBe(tx);
  });

  it('T021: unmount mid-ACTIVE drag removes ALL chrome and commits nothing', () => {
    const h = harness(TEST_DOC, { editable: true });
    h.tick();
    h.pointerDown(h.wrapperOf('c'), 30, 15);
    h.pointerMoveAt(h.wrapperOf('b'), 30, 7); // crossed the threshold — ACTIVE
    h.tick();
    expect(h.view.container.querySelector('.bldr-drop-indicator')).not.toBeNull();
    const tx = h.kernel.transactions().length;

    expect(() => {
      h.view.unmount();
    }).not.toThrow();
    expect(h.kernel.transactions().length).toBe(tx); // never a phantom move
    expect(document.querySelector('.bldr-drop-indicator')).toBeNull();
    expect(document.querySelector('.bldr-overlay')).toBeNull();

    act(() => {
      h.frameDocument.dispatchEvent(new MouseEvent('pointerup', {}));
    });
    expect(h.kernel.transactions().length).toBe(tx);
  });
});

describe('EditorCanvas inline editing (009 US1)', () => {
  const INLINE_BLOCKS: TrustedExtensionManifest = {
    tier: 1,
    name: 'inline-blocks',
    version: '1.0.0',
    contributes: {
      blocks: [
        block('page', 'Page', { default: { allow: ['headline', 'plain'] } }),
        {
          schema: defineBlockSchema({
            type: 'headline',
            description: 'Headline',
            props: z.object({ label: z.string().min(1).max(80) }),
            inlineEditable: 'label',
            examples: [],
          }),
          render: LabelRender,
        },
        inlineBlock('plain', 'Plain', false),
      ],
    },
  };

  const INLINE_DOC: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['h1', 'p1'] } },
      h1: { id: 'h1', type: 'headline', props: { label: 'Editable title' } },
      p1: { id: 'p1', type: 'plain', props: { label: 'Not editable' } },
    },
  };

  function inlineHarness() {
    const kernel = createBuilder({
      document: INLINE_DOC,
      extensions: [INLINE_BLOCKS],
      ports: { clock: fixedClock(), ids: seededIds('inline') },
    });
    let hitTarget: Element | null = null;
    const renders: string[] = [];
    const queue: (() => void)[] = [];
    const ports: Partial<GeometryPorts> = {
      measure: () => ({ x: 5, y: 6, width: 50, height: 20 }),
      hitTest: () => hitTarget,
      viewport: () => ({ width: 400, height: 600 }),
      schedule: (callback) => {
        queue.push(callback);
        return () => undefined;
      },
    };
    const view = render(
      <EditorCanvas
        kernel={kernel}
        theme={lightTheme}
        geometryPorts={ports}
        onBlockRender={(id) => renders.push(id)}
        editable
      />,
    );
    const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
    const frameDocument = frame.contentDocument;
    if (frameDocument === null) {
      throw new Error('frame must expose a document');
    }
    const wrapperOf = (id: string) =>
      frameDocument.querySelector<HTMLElement>(`[data-bldr-node="${id}"]`);
    const surface = () => frameDocument.querySelector<HTMLElement>('.bldr-inline-text');
    const doubleClick = (id: string, clientX = 10, clientY = 10) => {
      hitTarget = wrapperOf(id);
      act(() => {
        frameDocument.dispatchEvent(new MouseEvent('dblclick', { clientX, clientY }));
      });
    };
    const frameKey = (key: string) => {
      act(() => {
        frameDocument.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    };
    return { kernel, view, frameDocument, wrapperOf, surface, doubleClick, frameKey, renders };
  }

  const labelOf = (kernel: ReturnType<typeof createBuilder>, id: string) =>
    kernel.getDocument().nodes[id]?.props['label'];

  it('AC1: a double-click opens the declared property in place — and dispatches NOTHING', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    const before = h.kernel.transactions().length;

    h.doubleClick('h1');
    const editable = h.surface();
    expect(editable).not.toBeNull();
    expect(editable?.getAttribute('role')).toBe('textbox');
    expect(editable?.getAttribute('aria-label')).toBe('label');
    expect(h.kernel.transactions().length).toBe(before); // entering is not an edit
    expect(h.kernel.context.store.getState().selection).toEqual(['h1']); // still selected
  });

  it('AC1: pointer entry restores the caret at the double-click coordinates', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    const caretPositionFromPoint = vi.fn(() => {
      const text = h.surface()?.firstChild;
      return text === null || text === undefined ? null : { offsetNode: text, offset: 4 };
    });
    Object.defineProperty(h.frameDocument, 'caretPositionFromPoint', {
      configurable: true,
      value: caretPositionFromPoint,
    });

    h.doubleClick('h1', 37, 19);

    expect(caretPositionFromPoint).toHaveBeenCalledWith(37, 19);
    expect(h.frameDocument.getSelection()?.anchorNode).toBe(h.surface()?.firstChild);
    expect(h.frameDocument.getSelection()?.anchorOffset).toBe(4);
  });

  it('AC1: Enter opens the SELECTED node — keyboard parity with the pointer', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    h.frameKey('Enter');
    expect(h.surface()).not.toBeNull();
    expect(h.surface()).toHaveFocus();
    expect(h.frameDocument.getSelection()?.anchorNode).toBe(h.surface());
    expect(h.frameDocument.getSelection()?.anchorOffset).toBe(h.surface()?.childNodes.length);
  });

  it('AC2: typing is ONE transaction per commit and the canvas follows', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    h.doubleClick('h1');
    const editable = h.surface();
    const before = h.kernel.transactions().length;

    act(() => {
      editable!.textContent = 'Edited title';
      editable!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(h.kernel.transactions().length).toBe(before + 1);
    expect(labelOf(h.kernel, 'h1')).toBe('Edited title');
  });

  it('FR-003: a door rejection stays control-adjacent and editing continues', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    h.doubleClick('h1');
    const editable = h.surface();
    const before = h.kernel.transactions().length;

    act(() => {
      if (editable !== null) {
        editable.textContent = '';
        editable.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(h.kernel.transactions()).toHaveLength(before);
    expect(labelOf(h.kernel, 'h1')).toBe('Editable title');
    expect(editable?.textContent).toBe('');
    expect(editable).toHaveFocus();
    const describedBy = editable?.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    const rejection = h.frameDocument.getElementById(describedBy ?? '');
    expect(rejection?.textContent.length ?? 0).toBeGreaterThan(0);
    expect(h.wrapperOf('h1')?.contains(rejection ?? null)).toBe(true);

    act(() => {
      if (editable !== null) {
        editable.textContent = 'Corrected';
        editable.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    expect(labelOf(h.kernel, 'h1')).toBe('Corrected');
    expect(h.frameDocument.querySelector('[data-bldr-inline-rejection]')).toBeNull();
    expect(editable?.getAttribute('aria-describedby')).toBeNull();
  });

  it('AC3: Escape ends editing, keeps the selection, and commits nothing further', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    h.doubleClick('h1');
    expect(h.surface()).not.toBeNull();
    const before = h.kernel.transactions().length;

    h.frameKey('Escape');
    expect(h.surface()).toBeNull();
    expect(h.kernel.context.store.getState().selection).toEqual(['h1']);
    expect(h.kernel.transactions().length).toBe(before);
  });

  it('AC4: selecting another block ends the session', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    h.doubleClick('h1');
    expect(h.surface()).not.toBeNull();

    act(() => {
      h.kernel.setSelection(['p1']);
    });
    expect(h.surface()).toBeNull();
  });

  it('AC5: document truth — undo restores the text in the canvas AND the surface', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    h.doubleClick('h1');
    const editable = h.surface();
    act(() => {
      editable!.textContent = 'Changed';
      editable!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(labelOf(h.kernel, 'h1')).toBe('Changed');

    act(() => {
      h.kernel.undo();
    });
    expect(labelOf(h.kernel, 'h1')).toBe('Editable title');
    expect(h.surface()?.textContent).toBe('Editable title');
  });

  it('AC6: a block declaring nothing inline-editable is INERT', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['p1']);
    h.doubleClick('p1');
    expect(h.surface()).toBeNull();
    h.frameKey('Enter');
    expect(h.surface()).toBeNull();
    expect(h.kernel.context.store.getState().selection).toEqual(['p1']);
  });

  it('FR-009: an inline commit re-renders ONLY the edited node', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    h.doubleClick('h1');
    h.renders.length = 0;

    const editable = h.surface();
    act(() => {
      editable!.textContent = 'Scoped';
      editable!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(new Set(h.renders)).toEqual(new Set(['h1']));
  });

  it('the selection chrome STANDS DOWN while the text is edited in place (polish law)', () => {
    // The double-chrome defect: selection outline + name label + the surface's
    // own focus ring stacked three borders on one paragraph. While a session is
    // open the layer carries the editing class and the outline yields.
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    const layer = h.view.container.querySelector<HTMLElement>('.bldr-overlay');
    expect(layer?.classList.contains('bldr-overlay--editing')).toBe(false);

    h.doubleClick('h1');
    expect(h.surface()).not.toBeNull();
    expect(layer?.classList.contains('bldr-overlay--editing')).toBe(true);

    h.frameKey('Escape');
    expect(h.surface()).toBeNull();
    expect(layer?.classList.contains('bldr-overlay--editing')).toBe(false);
  });

  it('the session ends when the edited node VANISHES beneath the caret', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    h.doubleClick('h1');
    expect(h.surface()).not.toBeNull();

    act(() => {
      h.kernel.dispatch('removeNode', { id: 'h1' }, 'user');
    });
    expect(h.surface()).toBeNull();
  });
});

describe('EditorCanvas floating toolbars (009 US2/US3)', () => {
  /**
   * A contributed inline editor with NO editing engine behind it. The canvas's
   * contract with an editor is exactly four callbacks, so testing the seam
   * against a real engine would test the engine — the rich editor has its own
   * suite, and Chromium proves the two together.
   */
  interface FakeHandle {
    anchor: InlineEditorProps['onAnchor'];
    actions: InlineEditorProps['onActions'];
    commit: InlineEditorProps['onCommit'];
    exit: InlineEditorProps['onExit'];
  }
  let fake: FakeHandle | null = null;
  const loads = { count: 0 };

  function FakeInlineEditor({
    value,
    label,
    onCommit,
    onExit,
    onAnchor,
    onActions,
  }: InlineEditorProps) {
    fake = { anchor: onAnchor, actions: onActions, commit: onCommit, exit: onExit };
    return (
      <span data-testid="fake-inline" aria-label={label}>
        {typeof value === 'string' ? value : 'rich'}
      </span>
    );
  }

  const FAKE_EDITOR: TrustedExtensionManifest = {
    tier: 1,
    name: 'fake-inline-editor',
    version: '1.0.0',
    contributes: {
      inlineEditors: [
        {
          id: 'fake.rich',
          kind: 'rich',
          load: () => {
            loads.count += 1;
            return Promise.resolve({ default: FakeInlineEditor });
          },
        },
      ],
    },
  };

  /** Renders the swapped element when editing, a placeholder otherwise. */
  const BodyRender: BlockRenderComponent = ((props: { props: { body?: unknown } }) => (
    <span data-testid="body">
      {isValidElement(props.props.body) ? props.props.body : 'rich text'}
    </span>
  )) as BlockRenderComponent;

  const FLOAT_BLOCKS: TrustedExtensionManifest = {
    tier: 1,
    name: 'float-blocks',
    version: '1.0.0',
    contributes: {
      blocks: [
        block('page', 'Page', { default: { allow: ['headline', 'prose', 'plain'] } }),
        inlineBlock('headline', 'Headline', true),
        inlineBlock('plain', 'Plain', false),
        {
          schema: defineBlockSchema({
            type: 'prose',
            description: 'Prose',
            props: z.object({ body: richText().default(emptyRichText() as never) }),
            inlineEditable: 'body',
            examples: [],
          }),
          render: BodyRender,
        },
      ],
    },
  };

  const FLOAT_DOC: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['h1', 'pr', 'p1'] } },
      h1: { id: 'h1', type: 'headline', props: { label: 'Editable title' } },
      pr: { id: 'pr', type: 'prose', props: {} },
      p1: { id: 'p1', type: 'plain', props: { label: 'Not editable' } },
    },
  };

  function floatingHarness(
    options: {
      editable?: boolean;
      /** The stress document swaps in the shared fixture blocks (T015). */
      document?: BuilderDocument;
      blocks?: TrustedExtensionManifest;
      /** Per-node geometry; one constant box unless a test needs room to mirror. */
      rect?: { x: number; y: number; width: number; height: number };
    } = {},
  ) {
    fake = null;
    loads.count = 0;
    const kernel = createBuilder({
      document: options.document ?? FLOAT_DOC,
      extensions: [options.blocks ?? FLOAT_BLOCKS, FAKE_EDITOR],
      ports: { clock: fixedClock(), ids: seededIds('float') },
    });
    let hitTarget: Element | null = null;
    const renders: string[] = [];
    const queue: (() => void)[] = [];
    const ports: Partial<GeometryPorts> = {
      measure: () => options.rect ?? { x: 5, y: 6, width: 50, height: 20 },
      hitTest: () => hitTarget,
      viewport: () => ({ width: 400, height: 600 }),
      schedule: (callback) => {
        queue.push(callback);
        return () => undefined;
      },
    };
    const view = render(
      <EditorCanvas
        kernel={kernel}
        theme={lightTheme}
        geometryPorts={ports}
        floatingPorts={{
          measure: () => ({ width: 120, height: 32 }),
          observe: () => () => undefined,
        }}
        onBlockRender={(id) => renders.push(id)}
        editable={options.editable ?? true}
      />,
    );
    const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
    let frameBox = { x: 0, y: 100, width: 400, height: 600 };
    frame.getBoundingClientRect = () => frameBox as DOMRect;
    const frameDocument = frame.contentDocument;
    if (frameDocument === null) {
      throw new Error('frame must expose a document');
    }
    let selectionBox = { x: 10, y: 40, width: 60, height: 18 };
    const tick = () => {
      act(() => {
        for (const callback of queue.splice(0)) {
          callback();
        }
      });
    };
    const wrapperOf = (id: string) =>
      frameDocument.querySelector<HTMLElement>(`[data-bldr-node="${id}"]`);
    const doubleClick = (id: string) => {
      hitTarget = wrapperOf(id);
      act(() => {
        frameDocument.dispatchEvent(new MouseEvent('dblclick', { clientX: 10, clientY: 10 }));
      });
    };
    const pressOn = (id: string, x: number, y: number) => {
      hitTarget = wrapperOf(id);
      frameDocument.dispatchEvent(new MouseEvent('pointerdown', { clientX: x, clientY: y }));
    };
    const dragTo = (x: number, y: number) => {
      frameDocument.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }));
    };
    /** The contributed editor arrives through a promise; let it land. */
    const settle = async () => {
      await act(async () => {
        await Promise.resolve();
      });
      tick();
    };
    const openRich = async () => {
      kernel.setSelection(['pr']);
      doubleClick('pr');
      await settle();
    };
    const report = (actions: Parameters<InlineEditorProps['onActions']>[0]) => {
      act(() => {
        const text = frameDocument.querySelector('[data-testid="fake-inline"]')?.firstChild;
        if (text !== null && text !== undefined) {
          const range = frameDocument.createRange();
          range.selectNodeContents(text);
          Object.defineProperties(range, {
            getBoundingClientRect: {
              configurable: true,
              value: () => selectionBox,
            },
            getClientRects: {
              configurable: true,
              value: () => [selectionBox],
            },
          });
          const selection = frameDocument.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
        fake?.anchor(actions.length === 0 ? null : { box: selectionBox });
        fake?.actions(actions);
      });
      tick();
    };
    return {
      kernel,
      view,
      frameDocument,
      renders,
      tick,
      settle,
      hover: (id: string | null) => {
        hitTarget = id === null ? null : wrapperOf(id);
        act(() => {
          frameDocument.dispatchEvent(new MouseEvent('pointermove', { clientX: 3, clientY: 4 }));
        });
      },
      doubleClick,
      pressOn,
      dragTo,
      openRich,
      report,
      setFrameBox: (next: typeof frameBox) => {
        frameBox = next;
      },
      setSelectionBox: (next: typeof selectionBox) => {
        selectionBox = next;
      },
      host: (kind: 'bubble' | 'actions') =>
        view.container.querySelector<HTMLElement>(`.bldr-floating--${kind}`),
      bubble: () => view.container.querySelector<HTMLElement>('.bldr-text-bubble'),
      bar: () => view.container.querySelector<HTMLElement>('.bldr-block-actions'),
    };
  }

  const BOLD = [{ id: 'bold', label: 'Bold', pressed: false, run: () => undefined }];

  it('D2: a contributed rich editor resolves before the ONE editing surface mounts', async () => {
    const h = floatingHarness();
    h.kernel.setSelection(['pr']);
    h.doubleClick('pr');

    // The contribution is still in its promise turn: ordinary block output
    // stays mounted, and the built-in surface must never flash in first.
    expect(h.frameDocument.querySelector('[data-testid="fake-inline"]')).toBeNull();
    expect(h.frameDocument.querySelector('.bldr-inline-rich')).toBeNull();
    expect(h.frameDocument.querySelector('[data-testid="body"]')).toHaveTextContent('rich text');

    await h.settle();
    expect(h.frameDocument.querySelector('[data-testid="fake-inline"]')).not.toBeNull();
    expect(h.frameDocument.querySelector('.bldr-inline-rich')).toBeNull();
  });

  it('US2/AC1: a live selection inside the contributed editor raises the bubble', async () => {
    const h = floatingHarness();
    await h.openRich();
    // The editor lives in the PREVIEW document — the canvas portals it there.
    expect(h.frameDocument.querySelector('[data-testid="fake-inline"]')).not.toBeNull();
    expect(loads.count).toBe(1); // the engine loads ONCE, and only for this session
    expect(h.bubble()).toBeNull(); // …and not before there is anything to format

    h.report(BOLD);
    const bubble = h.bubble();
    expect(bubble).not.toBeNull();
    expect(bubble?.getAttribute('role')).toBe('group');
    expect(bubble?.getAttribute('aria-label')).toBe('Formatting');
    expect(h.host('bubble')?.style.visibility).toBe('visible');
  });

  it('US2/AC2: a bubble action is ONE transaction, and the session survives it', async () => {
    const h = floatingHarness();
    await h.openRich();
    let applied = 0;
    h.kernel.context.events.on('tx.applied', () => {
      applied += 1;
    });
    h.report([
      {
        id: 'bold',
        label: 'Bold',
        pressed: false,
        run: () => {
          fake?.commit(emptyRichText());
        },
      },
    ]);

    act(() => {
      h.view.container.querySelector<HTMLButtonElement>('.bldr-text-bubble button')?.click();
    });
    expect(applied).toBe(1);
    // The editor is still open and still selected — formatting must never end
    // the edit it was invoked from.
    expect(h.frameDocument.querySelector('[data-testid="fake-inline"]')).not.toBeNull();
    expect(h.kernel.context.store.getState().selection).toEqual(['pr']);
  });

  it('US2/AC3: the bubble goes when the selection collapses, and when the edit exits', async () => {
    const h = floatingHarness();
    await h.openRich();
    h.report(BOLD);
    expect(h.bubble()).not.toBeNull();

    h.report([]); // collapsed — nothing to format
    expect(h.bubble()).toBeNull();

    h.report(BOLD);
    expect(h.bubble()).not.toBeNull();
    act(() => {
      fake?.exit();
    });
    h.tick();
    // Ending the session retires the bubble WITHOUT trusting the editor to
    // report its own farewell.
    expect(h.bubble()).toBeNull();
    expect(h.host('bubble')?.style.visibility).toBe('hidden');
  });

  it('US2/AC4: the bubble RE-MEASURES its selection when the frame scrolls', async () => {
    const h = floatingHarness();
    await h.openRich();
    h.report(BOLD);
    expect(h.host('bubble')?.dataset['placement']).toBe('above');
    const initialTransform = h.host('bubble')?.style.transform;

    // The selection itself reflowed without another editor callback. A frozen
    // anchor would replay y=40 here; the live range moves the host instead.
    h.setSelectionBox({ x: 24, y: 240, width: 90, height: 18 });
    act(() => {
      h.frameDocument.dispatchEvent(new Event('scroll'));
    });
    h.tick();
    expect(h.host('bubble')?.style.transform).not.toBe(initialTransform);

    // The frame scrolls to the top of the host viewport: there is no longer room
    // above the anchor, so the bubble flips below it.
    // The canvas scrolls the frame under the selection: no pointer, no key, no
    // React state — the index invalidates and the channel re-places the bubble.
    h.setSelectionBox({ x: 10, y: 40, width: 60, height: 18 });
    h.setFrameBox({ x: 0, y: -20, width: 400, height: 600 });
    act(() => {
      h.frameDocument.dispatchEvent(new Event('scroll'));
    });
    h.tick();
    expect(h.host('bubble')?.dataset['placement']).toBe('below');

    // …and a host resize is the same channel, not a second mechanism.
    h.setFrameBox({ x: 0, y: 300, width: 400, height: 600 });
    act(() => {
      h.frameDocument.defaultView?.dispatchEvent(new Event('resize'));
    });
    h.tick();
    expect(h.host('bubble')?.dataset['placement']).toBe('above');

    // When live selection geometry leaves the visible frame area, the host
    // hides even though the editor has not emitted a collapse callback.
    h.setSelectionBox({ x: 24, y: 700, width: 90, height: 18 });
    act(() => {
      h.frameDocument.dispatchEvent(new Event('scroll'));
    });
    h.tick();
    expect(h.host('bubble')?.style.visibility).toBe('hidden');
  });

  it('US2/AC5: a plain-text surface never raises a bubble', async () => {
    const h = floatingHarness();
    h.kernel.setSelection(['h1']);
    h.doubleClick('h1');
    await h.settle();

    expect(h.frameDocument.querySelector('.bldr-inline-text')).not.toBeNull();
    expect(loads.count).toBe(0); // plain text is the canvas's own surface
    expect(h.bubble()).toBeNull();
  });

  it('US4/T015: the toolbars position on the 1,000-node stress document at ZERO content renders', () => {
    const h = floatingHarness({ document: stressDocument(1000), blocks: TEST_BLOCKS });
    h.tick();
    h.renders.length = 0;

    // Select a node deep in the document: the action bar appears…
    act(() => {
      h.kernel.setSelection(['txt-5-5']);
    });
    h.tick();
    expect(h.bar()).not.toBeNull();

    // …and now the expensive part — the frame scrolls repeatedly under it. Each
    // scroll re-measures and re-writes the bar's transform through the channel.
    for (let step = 0; step < 30; step += 1) {
      h.setFrameBox({ x: 0, y: 100 - step * 10, width: 400, height: 600 });
      act(() => {
        h.frameDocument.dispatchEvent(new Event('scroll'));
      });
      h.tick();
    }
    expect(h.host('actions')?.style.visibility).toBe('visible');

    // Hovering a different node moves the hover chrome, not the content.
    h.hover('txt-1-1');
    h.tick();
    h.hover(null);
    h.tick();

    // THE LAW: none of that rendered a single block (SC-002).
    expect(h.renders).toEqual([]);
    // …and no editing engine was fetched, because nothing rich was edited.
    expect(loads.count).toBe(0);
  });

  it('US4/T015: an inline commit re-renders exactly ONE node, on the stress document', async () => {
    // A stress document made of ordinary blocks plus one editable headline: the
    // commit path must not widen just because the document is large.
    const big = stressDocument(1000);
    const doc: BuilderDocument = {
      ...big,
      nodes: {
        ...big.nodes,
        headline: { id: 'headline', type: 'headline', props: { label: 'Edit me' } },
        [big.rootId]: {
          ...big.nodes[big.rootId]!,
          slots: {
            default: ['headline', ...(big.nodes[big.rootId]?.slots?.['default'] ?? [])],
          },
        },
      },
    };
    const BLOCKS: TrustedExtensionManifest = {
      tier: 1,
      name: 'stress-plus-inline',
      version: '1.0.0',
      contributes: {
        blocks: [
          block('page', 'Page', { default: { allow: ['section', 'headline'] } }),
          block('section', 'Section', { default: { allow: ['text', 'section'] } }),
          block('text', 'Text'),
          inlineBlock('headline', 'Headline', true),
        ],
      },
    };
    const h = floatingHarness({ document: doc, blocks: BLOCKS });
    h.tick();

    act(() => {
      h.kernel.setSelection(['headline']);
    });
    h.renders.length = 0;
    h.doubleClick('headline');
    await h.settle();
    const surface = h.frameDocument.querySelector<HTMLElement>('.bldr-inline-text');
    expect(surface).not.toBeNull();
    // D5: opening the seam reaches only the named node; the other 999 nodes
    // never receive a changing prop or a broad subscription notification.
    expect(h.renders).toEqual(['headline']);
    h.renders.length = 0;

    act(() => {
      if (surface !== null) {
        surface.textContent = 'Edited in place';
        surface.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    expect(new Set(h.renders)).toEqual(new Set(['headline']));
    expect(h.kernel.getDocument().nodes['headline']?.props['label']).toBe('Edited in place');
  });

  it('US4/T016: the bar sits BELOW-CENTRE — off the name chip, stable under RTL', () => {
    const h = floatingHarness({ rect: { x: 40, y: 200, width: 300, height: 60 } });
    act(() => {
      h.kernel.setSelection(['pr']);
    });
    h.tick();
    // Below the block (200 + 60 + 8), centred on it (40 + 150 - 60): the
    // selection outline's name chip owns the top-start corner, so the bar may
    // never sit there.
    expect(h.host('actions')?.style.transform).toBe('translate(130px, 268px)');
    expect(h.host('actions')?.dataset['placement']).toBe('below');

    act(() => {
      h.kernel.dispatch('setDocMeta', { dir: 'rtl' });
    });
    h.tick();
    // A centred bar is direction-stable BY CONSTRUCTION — that is the RTL
    // statement for this surface (start-aligned mirroring is proven in the
    // pure suite). The flip still re-placed through the explicit refresh.
    expect(h.host('actions')?.style.transform).toBe('translate(130px, 268px)');
    expect(h.host('actions')?.dataset['placement']).toBe('below');
  });

  it('US3/AC1: selecting a block raises its action bar, named after the block', () => {
    const h = floatingHarness();
    h.tick();
    expect(h.bar()).toBeNull();

    act(() => {
      h.kernel.setSelection(['pr']);
    });
    h.tick();
    const bar = h.bar();
    expect(bar?.getAttribute('role')).toBe('toolbar');
    expect(bar?.getAttribute('aria-label')).toBe('Actions for Prose');
    expect(h.host('actions')?.style.visibility).toBe('visible');
  });

  it('US3/AC2: an action is ONE transaction with the defined resulting selection', () => {
    const h = floatingHarness();
    act(() => {
      h.kernel.setSelection(['pr']);
    });
    h.tick();
    let applied = 0;
    h.kernel.context.events.on('tx.applied', () => {
      applied += 1;
    });
    const before = h.kernel.getDocument().nodes['root']?.slots?.['default']?.length ?? 0;

    act(() => {
      h.view.container.querySelector<HTMLButtonElement>('.bldr-block-actions button')?.click();
    });
    expect(applied).toBe(1);
    expect(h.kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(before + 1);
    // Duplicate leaves the DUPLICATE selected — the bar follows the new node.
    const selected = h.kernel.context.store.getState().selection[0];
    expect(selected).not.toBe('pr');
    expect(selected === undefined ? undefined : h.kernel.getDocument().nodes[selected]?.type).toBe(
      'prose',
    );
  });

  it('US3/AC3: what cannot apply is DISABLED, never missing (stable layout)', () => {
    const h = floatingHarness();
    act(() => {
      h.kernel.setSelection(['h1']); // first child: nothing earlier to move to
    });
    h.tick();
    const labels = [...(h.bar()?.querySelectorAll('button') ?? [])].map((button) => [
      button.textContent,
      button.disabled,
    ]);
    expect(labels).toEqual([
      ['Duplicate', false],
      ['Delete', false],
      ['Move earlier', true],
      ['Move later', false],
      ['Edit text', false],
    ]);

    act(() => {
      h.kernel.setSelection(['root']); // the root can be none of these things
    });
    h.tick();
    expect(
      [...(h.bar()?.querySelectorAll('button') ?? [])].every((button) => button.disabled),
    ).toBe(true);
  });

  it('US3/a1: Edit text opens the inline session with ZERO dispatches', () => {
    const h = floatingHarness();
    act(() => {
      h.kernel.setSelection(['h1']);
    });
    h.tick();
    const before = h.kernel.transactions().length;
    const editText = [...(h.bar()?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === 'Edit text',
    );

    act(() => {
      editText?.click();
    });

    expect(h.kernel.transactions()).toHaveLength(before);
    expect(h.frameDocument.querySelector('.bldr-inline-text')).not.toBeNull();
    expect(h.bar()).toBeNull();
  });

  it('US3/AC4: the bar is absent during a drag, and absent on a read-only canvas', () => {
    const h = floatingHarness();
    act(() => {
      h.kernel.setSelection(['pr']);
    });
    h.tick();
    expect(h.bar()).not.toBeNull();

    // A press that crosses the threshold suppresses hover chrome and the bar.
    act(() => {
      h.pressOn('pr', 10, 10);
      h.dragTo(60, 90);
    });
    h.tick();
    expect(h.bar()).toBeNull();

    act(() => {
      h.frameDocument.dispatchEvent(new MouseEvent('pointerup', {}));
    });
    h.tick();
    expect(h.bar()).not.toBeNull(); // and back, without a second gesture
  });

  it('US3: a read-only canvas has no action bar at all (B2a stays byte-compatible)', () => {
    const h = floatingHarness({ editable: false });
    act(() => {
      h.kernel.setSelection(['pr']);
    });
    h.tick();
    expect(h.bar()).toBeNull();
  });

  it('US3: the bar stands down while the block is being edited in place', async () => {
    const h = floatingHarness();
    await h.openRich();
    // Two toolbars over one block is noise: the bubble owns this moment.
    expect(h.bar()).toBeNull();

    act(() => {
      fake?.exit();
    });
    h.tick();
    expect(h.bar()).not.toBeNull();
  });
});
