import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { stressDocument } from '@craftkit/builder-core/testing';

import type { CanvasDragHandle } from './EditorCanvas';
import { DRAG_RECTS, TEST_DOC, harness } from './EditorCanvas.test-helpers';

describe('cross-document gesture safety (006 review Criticals)', () => {
  it('a canvas drag released on the HOST still commits — and the next click is NOT swallowed', () => {
    const h = harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });
    h.tick();
    h.dragHandleDown('c', 200, 280);
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
    h.dragHandleDown('c', 200, 280);
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
    h.dragHandleDown('c', 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);
    /*
      The window genuinely losing focus is what this cancel is for, and
      `hasFocus()` is how the platform says so — jsdom reports true by default,
      which would make the blur look like the in-app one below.
    */
    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    act(() => {
      h.frameDocument.defaultView?.frameElement?.ownerDocument.defaultView?.dispatchEvent(
        new Event('blur'),
      );
    });
    hasFocus.mockRestore();
    expect(h.kernel.getDocument()).toBe(before);
    expect(h.kernel.transactions()).toHaveLength(0);
    expect(h.view.container.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility).toBe(
      'hidden',
    );
  });

  it('a blur that only moved focus INTO the canvas leaves the drag alive', () => {
    /*
      The defect this pins, measured in a browser before it was fixed: the canvas
      lives in an iframe, so pressing a block moves focus into that iframe and
      the host document fires `blur` — on EVERY real internal drag. The handler
      cancelled on it, so a person could pick a block up, watch the ghost and the
      indicator follow their pointer, release, and have nothing happen at all.

      No test caught it because the drag tests and stories dispatch synthetic
      events straight at the frame document, and synthetic events move no focus.
      So this one asserts the CONDITION rather than the focus mechanics:
      `hasFocus()` stays true while focus is anywhere in this document or a
      descendant browsing context.
    */
    const h = harness(TEST_DOC, { editable: true, rects: DRAG_RECTS });
    h.tick();
    h.dragHandleDown('c', 200, 280);
    h.pointerMoveAt(h.wrapperOf('b'), 200, 125);

    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    act(() => {
      h.frameDocument.defaultView?.frameElement?.ownerDocument.defaultView?.dispatchEvent(
        new Event('blur'),
      );
    });
    hasFocus.mockRestore();

    // Still dragging: the ghost is up and the drop can still land.
    expect(h.view.container.querySelector<HTMLElement>('.bldr-drag-ghost')?.style.visibility).toBe(
      'visible',
    );

    act(() => {
      h.frameDocument.defaultView?.parent.document.dispatchEvent(new PointerEvent('pointerup', {}));
    });
    expect(h.kernel.transactions()).toHaveLength(1);
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
    h.dragHandleDown('c', 200, 280);
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
    h.dragHandleDown('txt-5-5', 10, 10);
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
    h.dragHandleDown(bottom, 10, 15);
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
    h.dragHandleDown('c', 30, 15);
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

describe('convergence fixes (007 §11)', () => {
  // The US4 edge case "Preview entered while a drag session is somehow pending:
  // the session cancels first" — preview entry unmounts the canvas, so THE
  // proof is unmount-mid-session: zero transactions, zero chrome traces, and
  // detached listeners (T021; the T012 record was structurally true, unbacked).
  it('T021: unmount mid-PENDING drag leaves zero trace and inert listeners', () => {
    const h = harness(TEST_DOC, { editable: true });
    h.tick();
    h.dragHandleDown('c', 30, 15); // pressed, below the 8px threshold
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
    h.dragHandleDown('c', 30, 15);
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
