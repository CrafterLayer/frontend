import { act, render, screen } from '@testing-library/react';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { lightTheme } from '@craftkit/builder-renderer';
import {
  defineBlockSchema,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { GeometryPorts } from '../../rects';
import { EditorCanvas } from './EditorCanvas';
import { block, inlineBlock, labelRender as LabelRender } from './EditorCanvas.test-helpers';

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
      // block-parts (2026-10-06): the surface buffers and commits once, on Enter or blur.
      editable!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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
        // block-parts (2026-10-06): the surface buffers and commits once, on Enter or blur.
        editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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
        // block-parts (2026-10-06): the surface buffers and commits once, on Enter or blur.
        editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
    });
    expect(labelOf(h.kernel, 'h1')).toBe('Corrected');
    expect(h.frameDocument.querySelector('[data-bldr-inline-rejection]')).toBeNull();
    expect(editable?.getAttribute('aria-describedby')).toBeNull();
  });

  it('R1/AC3: plain-text Escape restores canvas focus before the editor unmounts', () => {
    const h = inlineHarness();
    h.kernel.setSelection(['h1']);
    h.doubleClick('h1');
    const surface = h.surface();
    expect(surface).not.toBeNull();
    expect(surface).toHaveFocus();
    const before = h.kernel.transactions().length;

    act(() => {
      surface?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(h.surface()).toBeNull();
    expect(h.kernel.context.store.getState().selection).toEqual(['h1']);
    expect(h.kernel.transactions().length).toBe(before);
    expect(screen.getByRole('region', { name: 'Editor canvas' })).toHaveFocus();
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
      // block-parts (2026-10-06): the surface buffers and commits once, on Enter or blur.
      editable!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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
      // block-parts (2026-10-06): the surface buffers and commits once, on Enter or blur.
      editable!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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
