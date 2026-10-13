import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { stressDocument } from '@craftkit/builder-core/testing';
import {
  emptyRichText,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { TEST_BLOCKS, block, inlineBlock } from './EditorCanvas.test-helpers';
import {
  BOLD,
  FLOAT_DOC,
  fake,
  floatingHarness,
  loads,
} from './EditorCanvas.floating.test-helpers';

describe('EditorCanvas floating toolbars (009 US2/US3)', () => {
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

  it('T036: built-in selection geometry is read once per coalesced anchor flush', async () => {
    const documentWithText: BuilderDocument = {
      ...FLOAT_DOC,
      nodes: {
        ...FLOAT_DOC.nodes,
        pr: {
          id: 'pr',
          type: 'prose',
          props: {
            body: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Select rapidly' }],
                },
              ],
            },
          },
        },
      },
    };
    const h = floatingHarness({ contributedEditor: false, document: documentWithText });
    await h.openRich();
    const surface = h.frameDocument.querySelector<HTMLElement>('.bldr-inline-rich');
    if (surface === null) {
      throw new Error('the built-in rich surface must render');
    }
    expect(h.frameDocument.activeElement).toBe(surface);

    const originalCreateRange = h.frameDocument.createRange.bind(h.frameDocument);
    let clientRectReads = 0;
    let boundingRectReads = 0;
    Object.defineProperty(h.frameDocument, 'createRange', {
      configurable: true,
      value: () => {
        const range = originalCreateRange();
        Object.defineProperties(range, {
          getClientRects: {
            configurable: true,
            value: () => {
              clientRectReads += 1;
              return [new DOMRect(10, 40, 60, 18)] as unknown as DOMRectList;
            },
          },
          getBoundingClientRect: {
            configurable: true,
            value: () => {
              boundingRectReads += 1;
              return new DOMRect(10, 40, 60, 18);
            },
          },
        });
        return range;
      },
    });

    try {
      const text = h.frameDocument.createTreeWalker(surface, NodeFilter.SHOW_TEXT).nextNode();
      if (text === null) {
        throw new Error('the built-in rich surface must render selectable text');
      }
      const selection = h.frameDocument.getSelection();
      if (selection === null) {
        throw new Error('the frame must expose a selection');
      }

      const interactionEndpoints = [1, 2, 3, 4, 5, 6];
      act(() => {
        for (const to of interactionEndpoints) {
          const range = h.frameDocument.createRange();
          range.setStart(text, 0);
          range.setEnd(text, to);
          selection.removeAllRanges();
          selection.addRange(range);
          h.frameDocument.dispatchEvent(new Event('selectionchange'));
        }
      });

      // Semantics arrive on every interaction, but geometry stays untouched
      // until the ONE anchor-channel callback scheduled for this burst runs.
      expect(h.bubble()).not.toBeNull();
      expect(clientRectReads + boundingRectReads).toBe(0);
      const scheduledFlushes = h.pendingFlushes();
      expect(scheduledFlushes).toBe(1);
      expect(interactionEndpoints.length).toBeGreaterThan(scheduledFlushes);

      h.tick();
      const geometryReads = clientRectReads + boundingRectReads;
      expect(geometryReads).toBeGreaterThan(0);
      expect(geometryReads).toBeLessThanOrEqual(scheduledFlushes);
      expect(h.host('bubble')?.style.visibility).toBe('visible');
    } finally {
      Reflect.deleteProperty(h.frameDocument, 'createRange');
    }
  });

  it('R1: built-in rich Escape restores canvas focus before the editor unmounts', async () => {
    const h = floatingHarness({ contributedEditor: false });
    await h.openRich();
    const surface = h.frameDocument.querySelector<HTMLElement>('.bldr-inline-rich');
    expect(surface).not.toBeNull();
    expect(surface).toHaveFocus();

    act(() => {
      surface?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(h.frameDocument.querySelector('.bldr-inline-rich')).toBeNull();
    expect(screen.getByRole('region', { name: 'Editor canvas' })).toHaveFocus();
  });

  it('R1: contributed rich Escape callback restores canvas focus before unmount', async () => {
    const h = floatingHarness();
    await h.openRich();
    const surface = h.frameDocument.querySelector<HTMLElement>('[data-testid="fake-inline"]');
    expect(surface).not.toBeNull();
    surface?.setAttribute('tabindex', '0');
    surface?.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          fake?.exit();
        }
      },
      { once: true },
    );
    surface?.focus();
    expect(surface).toHaveFocus();

    act(() => {
      surface?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(h.frameDocument.querySelector('[data-testid="fake-inline"]')).toBeNull();
    expect(screen.getByRole('region', { name: 'Editor canvas' })).toHaveFocus();
  });

  it.each([
    ['Escape', { key: 'Escape' }],
    ['Shift+Tab', { key: 'Tab', shiftKey: true }],
  ])(
    'T035: %s returns from the first enabled host action, then editor Escape exits',
    async (_name, init) => {
      const h = floatingHarness();
      await h.openRich();
      h.report([
        { id: 'clear', label: 'Clear formatting', disabled: true, run: () => undefined },
        ...BOLD,
      ]);
      const surface = h.frameDocument.querySelector<HTMLElement>('[data-testid="fake-inline"]');
      const bold = h.bubble()?.querySelector<HTMLButtonElement>('button:not(:disabled)');
      expect(surface).not.toBeNull();
      expect(bold).not.toBeNull();
      surface?.setAttribute('tabindex', '0');
      surface?.focus();
      surface?.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Escape') {
            fake?.exit();
          }
        },
        { once: true },
      );
      const selection = h.frameDocument.getSelection();
      const bookmark =
        selection !== null && selection.rangeCount > 0
          ? selection.getRangeAt(0).cloneRange()
          : null;

      const moved = fake?.requestFormattingMenuFocus?.(() => {
        surface?.focus();
        if (bookmark !== null) {
          const currentSelection = h.frameDocument.getSelection();
          currentSelection?.removeAllRanges();
          currentSelection?.addRange(bookmark);
        }
      });
      expect(moved).toBe(true);
      expect(bold).toHaveFocus();
      const returnKey = new KeyboardEvent('keydown', {
        ...init,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        bold?.dispatchEvent(returnKey);
      });

      expect(returnKey.defaultPrevented).toBe(true);
      expect(surface).toHaveFocus();
      expect(h.frameDocument.querySelector('[data-testid="fake-inline"]')).not.toBeNull();

      act(() => {
        surface?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
        );
      });
      expect(h.frameDocument.querySelector('[data-testid="fake-inline"]')).toBeNull();
      expect(screen.getByRole('region', { name: 'Editor canvas' })).toHaveFocus();
    },
  );

  it('T035: no rendered or enabled formatting action leaves native navigation available', async () => {
    const h = floatingHarness();
    await h.openRich();
    const surface = h.frameDocument.querySelector<HTMLElement>('[data-testid="fake-inline"]');
    surface?.setAttribute('tabindex', '0');
    surface?.focus();

    h.report([]);
    expect(fake?.requestFormattingMenuFocus?.(() => undefined)).toBe(false);
    expect(surface).toHaveFocus();

    h.report([{ id: 'bold', label: 'Bold', disabled: true, run: () => undefined }]);
    expect(fake?.requestFormattingMenuFocus?.(() => undefined)).toBe(false);
    expect(surface).toHaveFocus();
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

  it('block-parts: with a collapsed caret the formatting bar DOCKS at the editing surface', async () => {
    const h = floatingHarness();
    await h.openRich();
    for (const element of h.frameDocument.querySelectorAll<HTMLElement>(
      '[data-bldr-node="pr"], [data-bldr-node="pr"] *',
    )) {
      element.getBoundingClientRect = () => new DOMRect(20, 200, 240, 60);
    }
    // The editor reports actions with NO selection anchor (a bare caret).
    act(() => {
      fake?.anchor(null);
      fake?.actions([{ id: 'bold', label: 'Bold', pressed: false, run: () => undefined }]);
    });
    h.tick();
    expect(h.bubble()).not.toBeNull();
    expect(h.bubble()?.getAttribute('aria-label')).toBe('Formatting');
    expect(h.host('bubble')?.style.visibility).toBe('visible');
    expect(h.host('bubble')?.dataset['placement']).toBe('above');

    // A real selection takes over the anchor; collapsing it docks again.
    h.report(BOLD);
    expect(h.host('bubble')?.style.visibility).toBe('visible');
    act(() => {
      fake?.exit();
    });
    h.tick();
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

  it('R4/US4/T015: opening, committing, and closing each re-render exactly ONE stress node', async () => {
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
        // block-parts (2026-10-06): the surface buffers and commits once, on Enter or blur.
        surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
    });
    expect(new Set(h.renders)).toEqual(new Set(['headline']));
    expect(h.kernel.getDocument().nodes['headline']?.props['label']).toBe('Edited in place');

    h.renders.length = 0;
    act(() => {
      h.frameDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(h.frameDocument.querySelector('.bldr-inline-text')).toBeNull();
    expect(h.renders).toEqual(['headline']);
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
});
