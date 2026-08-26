import { act, render, screen } from '@testing-library/react';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder, insertedNodeId } from '@craftkit/builder-core';
import { fixedClock, seededIds, stressDocument } from '@craftkit/builder-core/testing';
import { lightTheme } from '@craftkit/builder-renderer';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
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
        inlineBlock('headline', 'Headline', true),
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
    const doubleClick = (id: string) => {
      hitTarget = wrapperOf(id);
      act(() => {
        frameDocument.dispatchEvent(new MouseEvent('dblclick', { clientX: 10, clientY: 10 }));
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

  it('AC1: Enter opens the SELECTED node — keyboard parity with the pointer', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    h.frameKey('Enter');
    expect(h.surface()).not.toBeNull();
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
