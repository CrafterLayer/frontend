/*
  Shared fixtures for the EditorCanvas suites (split from EditorCanvas.test.tsx,
  2026-10-13): pass-through blocks so the whole tree MOUNTS, the three-section
  test document, and the harness that drives the canvas with injected geometry
  (jsdom has no layout) and a manual flush queue. Not a test file itself.
*/
import { act, render, screen } from '@testing-library/react';
import { z } from 'zod';
import { expect, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
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
export const passThrough: BlockRenderComponent = ((props: { slots: Record<string, unknown> }) => (
  <div>{Object.values(props.slots) as React.ReactNode[]}</div>
)) as BlockRenderComponent;

export const block = (
  type: string,
  description: string,
  slots?: Record<string, { allow: string[] }>,
) => ({
  schema: defineBlockSchema({
    type,
    description,
    props: z.object({ label: z.string().default('') }),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: passThrough,
});

/** Renders its label, so an inline swap is VISIBLE in the frame. */
export const labelRender: BlockRenderComponent = ((props: { props: { label?: unknown } }) => (
  <span data-testid="label">{props.props.label as React.ReactNode}</span>
)) as BlockRenderComponent;

export const inlineBlock = (type: string, description: string, editable: boolean) => ({
  schema: defineBlockSchema({
    type,
    description,
    props: z.object({ label: z.string().default('') }),
    ...(editable ? { inlineEditable: 'label' } : {}),
    examples: [],
  }),
  render: labelRender,
});

export const TEST_BLOCKS: TrustedExtensionManifest = {
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

export const TEST_DOC: BuilderDocument = {
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

export function harness(
  document: BuilderDocument = TEST_DOC,
  options: {
    dirAwareMeasure?: boolean;
    editable?: boolean;
    /** Per-node geometry (preview-local); falls back to the constant box. */
    rects?: Record<string, { x: number; y: number; width: number; height: number }>;
    onDragHandle?: (handle: CanvasDragHandle) => void;
    frameWidth?: number;
    zoom?: number;
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
      zoom={options.zoom}
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
  const dragHandleDown = (id: string, x: number, y: number) => {
    if (kernel.context.store.getState().selection[0] !== id) {
      click(wrapperOf(id));
    }
    const handle = view.container.querySelector<HTMLElement>('[data-bldr-drag-handle]');
    if (handle === null) {
      throw new Error(`selected block ${id} must expose a drag handle`);
    }
    act(() => {
      handle.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }),
      );
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
    dragHandleDown,
    pointerMoveAt,
    pointerUp,
    outline,
    flipDir,
    renders,
  };
}

/** Vertically stacked per-node geometry for band/half math in drag tests. */
export const DRAG_RECTS = {
  root: { x: 0, y: 0, width: 400, height: 600 },
  a: { x: 10, y: 10, width: 380, height: 100 },
  b: { x: 10, y: 120, width: 380, height: 100 },
  b1: { x: 20, y: 130, width: 360, height: 40 },
  c: { x: 10, y: 230, width: 380, height: 100 },
};
