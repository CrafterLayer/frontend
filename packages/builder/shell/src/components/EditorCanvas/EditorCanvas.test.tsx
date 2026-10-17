import { act, fireEvent, render, screen } from '@testing-library/react';
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

import { EditorCanvas } from './EditorCanvas';
import { TEST_DOC, harness } from './EditorCanvas.test-helpers';

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

  it('R3: consecutive same-named selections produce distinct live-region mutations', async () => {
    const h = harness();
    const region = screen.getByRole('status', { name: 'Selection' });
    const mutations: string[] = [];
    const observer = new MutationObserver(() => {
      mutations.push(region.textContent);
    });
    observer.observe(region, { childList: true, characterData: true, subtree: true });

    act(() => {
      h.kernel.setSelection(['a']);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const first = region.textContent;
    const afterFirst = mutations.length;

    act(() => {
      h.kernel.setSelection(['b']);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const second = region.textContent;
    observer.disconnect();

    expect(first.replaceAll('\u200b', '')).toBe('Section selected');
    expect(second.replaceAll('\u200b', '')).toBe('Section selected');
    expect(second).not.toBe(first);
    expect(mutations.length).toBeGreaterThan(afterFirst);
  });

  it('keyboard traversal walks siblings, steps in and out, then Escape climbs and clears', async () => {
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
    expect(h.kernel.context.store.getState().selection).toEqual(['root']);
    await user.keyboard('{Escape}');
    expect(h.kernel.context.store.getState().selection).toEqual([]);
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent(
      'Selection cleared',
    );
  });

  it('a click on the gutter around the frame, or on the host itself, clears the selection', () => {
    /*
      The owner's words: "when I select blocks there is no option to clear the
      selection". Clicking the page background inside the frame selects the
      ROOT on purpose (its props live in the inspector), so the empty space
      AROUND the frame is the pointer's way out — the one place a click can
      mean "nothing".
    */
    const h = harness();
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    const shell = h.view.container.querySelector<HTMLElement>('.bldr-canvas-frame-shell');
    expect(shell).not.toBeNull();
    if (shell === null) {
      throw new Error('the frame shell did not render');
    }
    act(() => {
      h.kernel.setSelection(['b']);
    });
    h.tick();
    expect(h.outline('selection')?.style.visibility).toBe('visible');

    fireEvent.click(shell); // the gutter beside a narrowed frame
    h.tick();
    expect(h.kernel.context.store.getState().selection).toEqual([]);
    expect(h.outline('selection')?.style.visibility).toBe('hidden');
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent(
      'Selection cleared',
    );

    act(() => {
      h.kernel.setSelection(['c']);
    });
    fireEvent.click(host); // the host's own surface
    expect(h.kernel.context.store.getState().selection).toEqual([]);

    // A click that merely BUBBLES through the host from other chrome is not a
    // gutter click: the overlay layer is a child, not the host or the shell.
    act(() => {
      h.kernel.setSelection(['a']);
    });
    fireEvent.click(screen.getByTestId('bldr-overlay'));
    expect(h.kernel.context.store.getState().selection).toEqual(['a']);
  });

  it('Escape climbs from anywhere NON-EDITABLE inside the host before clearing', () => {
    const h = harness();
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    act(() => {
      h.kernel.setSelection(['b']);
    });
    // Focus on a child of the host (the floating chrome renders inside it):
    // the key bubbles to the host with a target that is not the host.
    fireEvent.keyDown(screen.getByTestId('bldr-overlay'), { key: 'Escape' });
    expect(h.kernel.context.store.getState().selection).toEqual(['root']);
    fireEvent.keyDown(screen.getByTestId('bldr-overlay'), { key: 'Escape' });
    expect(h.kernel.context.store.getState().selection).toEqual([]);
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent(
      'Selection cleared',
    );
    // ...and focus lands on the host, so traversal keeps working afterwards.
    expect(host).toHaveFocus();

    // Every OTHER key from a child stays on the old guard: ArrowDown from
    // chrome must not traverse the canvas.
    fireEvent.keyDown(screen.getByTestId('bldr-overlay'), { key: 'ArrowDown' });
    expect(h.kernel.context.store.getState().selection).toEqual([]);
  });

  it('Escape inside an editable element, or one an inner editor already claimed, leaves the selection alone', () => {
    const h = harness();
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    act(() => {
      h.kernel.setSelection(['b']);
    });

    // The ATTRIBUTE, as a browser reflects it: jsdom implements neither the
    // `contentEditable` property nor `isContentEditable`, which is exactly why
    // the canvas reads the attribute and not the property.
    const contentEditable = () => {
      const region = document.createElement('div');
      region.setAttribute('contenteditable', 'true');
      return region;
    };
    // An input, a textarea, a select, and a contenteditable region each own
    // their Escape (dismiss a picker, cancel a draft); the canvas never
    // second-guesses them by throwing the selection away underneath.
    for (const editable of [
      document.createElement('input'),
      document.createElement('textarea'),
      document.createElement('select'),
      contentEditable(),
    ]) {
      host.appendChild(editable);
      fireEvent.keyDown(editable, { key: 'Escape' });
      expect(h.kernel.context.store.getState().selection).toEqual(['b']);
      editable.remove();
    }
    // A nested target INSIDE an editable region counts as editable too.
    const region = contentEditable();
    const inner = document.createElement('span');
    region.appendChild(inner);
    host.appendChild(region);
    fireEvent.keyDown(inner, { key: 'Escape' });
    expect(h.kernel.context.store.getState().selection).toEqual(['b']);
    region.remove();

    // An Escape a nearer handler has already consumed (the text bubble does
    // this to return focus to its editor) is not the canvas's to act on.
    const claimed = document.createElement('div');
    claimed.addEventListener('keydown', (event) => {
      event.preventDefault();
    });
    host.appendChild(claimed);
    fireEvent.keyDown(claimed, { key: 'Escape' });
    expect(h.kernel.context.store.getState().selection).toEqual(['b']);
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

describe('EditorCanvas device width (007 §6)', () => {
  it('narrows and centers the frame shell, overlay sharing its origin', () => {
    const h = harness(TEST_DOC, { frameWidth: 834 });
    const shell = h.view.container.querySelector<HTMLElement>('.bldr-canvas-frame-shell');
    expect(shell).not.toBeNull();
    expect(shell?.style.inlineSize).toBe('834px');
    expect(shell?.style.maxInlineSize).toBe('');
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

  it('keeps the authored target width exact while zoom changes only its visual footprint', () => {
    const h = harness(TEST_DOC, { frameWidth: 1280, zoom: 0.5 });
    const shell = h.view.container.querySelector<HTMLElement>('.bldr-canvas-frame-shell');
    const viewport = screen.getByTestId('bldr-canvas-viewport');

    expect(shell?.style.inlineSize).toBe('1280px');
    expect(shell?.style.transform).toBe('scale(0.5)');
    expect(viewport.style.inlineSize).toBe('640px');

    h.view.rerender(
      <EditorCanvas kernel={h.kernel} theme={lightTheme} frameWidth={1280} zoom={0.75} />,
    );
    expect(shell?.style.inlineSize).toBe('1280px');
    expect(shell?.style.transform).toBe('scale(0.75)');
    expect(viewport.style.inlineSize).toBe('960px');
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
