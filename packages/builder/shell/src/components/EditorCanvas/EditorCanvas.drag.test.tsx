import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { stressDocument } from '@craftkit/builder-core/testing';

import type { CanvasDragHandle } from './EditorCanvas';
import { DRAG_RECTS, TEST_DOC, harness } from './EditorCanvas.test-helpers';

describe('EditorCanvas drag editing (006 US1)', () => {
  const dragHarness = () => harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });

  it('FR-010: text surfaces and context actions stay inert; only the handle starts movement', () => {
    const h = dragHarness();
    h.tick();

    // A long press/move across ordinary page content remains available to the
    // browser for text selection. No structural session is armed by the frame.
    h.pointerDown(h.wrapperOf('b1'), 200, 150);
    h.pointerMoveAt(h.wrapperOf('c'), 220, 280);
    h.tick();
    expect(
      h.view.container.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility,
    ).not.toBe('visible');
    h.pointerUp();
    expect(h.kernel.transactions()).toHaveLength(0);

    // The floating context toolbar contains the grip, but its ordinary actions
    // cannot accidentally lend their pointerdown to the drag session.
    h.click(h.wrapperOf('c'));
    const duplicate = h.view.container.querySelector<HTMLElement>('[data-action="duplicate"]');
    expect(duplicate).not.toBeNull();
    fireEvent.pointerDown(duplicate!, {
      clientX: 200,
      clientY: 280,
    });
    h.pointerMoveAt(h.wrapperOf('b'), 220, 125);
    h.tick();
    expect(
      h.view.container.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility,
    ).not.toBe('visible');
    h.pointerUp();
    expect(h.kernel.transactions()).toHaveLength(0);

    h.dragHandleDown('c', 200, 280);
    h.pointerMoveAt(h.wrapperOf('c'), 207, 280);
    h.tick();
    expect(
      h.view.container.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility,
    ).not.toBe('visible');
    h.pointerMoveAt(h.wrapperOf('c'), 208, 280);
    h.tick();
    expect(h.view.container.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility).toBe(
      'visible',
    );
    act(() => {
      h.frameDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
  });

  it('AC1+AC6: a gap drop reorders in ONE transaction with ZERO pre-drop re-renders', () => {
    const h = dragHarness();
    h.tick();
    h.renders.length = 0;

    h.dragHandleDown('c', 200, 280);
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
    h.dragHandleDown('c', 200, 280);
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
    h.dragHandleDown('b1', 200, 150);
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
      h.kernel.setSelection(['c']);
    });
    const before = h.kernel.getDocument();
    h.dragHandleDown('c', 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);
    h.tick();
    act(() => {
      h.frameDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(h.kernel.getDocument()).toBe(before);
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(h.kernel.context.store.getState().selection).toEqual(['c']); // Escape ate by the session
    expect(h.view.container.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility).toBe(
      'hidden',
    );
  });

  it('a sub-threshold press stays a plain click (selection, no drag chrome)', () => {
    const h = dragHarness();
    h.tick();
    h.dragHandleDown('b', 200, 150);
    h.pointerMoveAt(h.wrapperOf('b'), 201, 151);
    h.pointerUp();
    h.click(h.wrapperOf('b'));
    expect(h.kernel.context.store.getState().selection).toEqual(['b']);
    expect(h.kernel.transactions()).toHaveLength(0);
  });

  it('FR-014: the Law-S audit holds across a full drag interaction', async () => {
    const h = dragHarness();
    h.tick();
    h.click(h.wrapperOf('c'));
    let stateChanges = 0;
    let txApplied = 0;
    h.kernel.context.store.subscribe(() => {
      stateChanges += 1;
    });
    h.kernel.context.events.on('tx.applied', () => {
      txApplied += 1;
    });

    // A cancelled drag contributes ZERO…
    h.dragHandleDown('c', 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);
    h.tick();
    act(() => {
      h.frameDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    h.tick();
    expect(stateChanges).toBe(0);
    await vi.waitFor(() => {
      expect(h.view.container.querySelector('[data-bldr-drag-handle]')).not.toBeNull();
    });

    // …a committed one contributes exactly one transaction + one selection write.
    h.dragHandleDown('c', 200, 280);
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
    h.dragHandleDown('txt-5-5', 10, 10);
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
