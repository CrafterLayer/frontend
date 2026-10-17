/*
  Shared fixtures for the EditorCanvas floating-toolbar suites (split from
  EditorCanvas.test.tsx, 2026-10-13). `fake` is a LIVE binding: it holds the
  handle the fake contributed editor last rendered with. Not a test file itself.
*/
import { isValidElement } from 'react';

import { act, render, screen } from '@testing-library/react';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
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
import { EditorCanvas, type CanvasInlineEditHandle } from './EditorCanvas';
import { block, inlineBlock } from './EditorCanvas.test-helpers';

/**
 * A contributed inline editor with NO editing engine behind it. The canvas's
 * contract with an editor is a small callback seam, so testing the seam
 * against a real engine would test the engine — the rich editor has its own
 * suite, and Chromium proves the two together.
 */
export interface FakeHandle {
  anchor: InlineEditorProps['onAnchor'];
  actions: InlineEditorProps['onActions'];
  commit: InlineEditorProps['onCommit'];
  exit: InlineEditorProps['onExit'];
  requestFormattingMenuFocus: InlineEditorProps['requestFormattingMenuFocus'];
}
export let fake: FakeHandle | null = null;
export const loads = { count: 0 };

function fakeInlineEditor({
  value,
  label,
  onCommit,
  onExit,
  onAnchor,
  onActions,
  requestFormattingMenuFocus,
}: InlineEditorProps) {
  fake = {
    anchor: onAnchor,
    actions: onActions,
    commit: onCommit,
    exit: onExit,
    requestFormattingMenuFocus,
  };
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
          return Promise.resolve({ default: fakeInlineEditor });
        },
      },
    ],
  },
};

/** Renders the swapped element when editing, a placeholder otherwise. */
const bodyRender: BlockRenderComponent = ((props: { props: { body?: unknown } }) => (
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
        render: bodyRender,
      },
    ],
  },
};

export const FLOAT_DOC: BuilderDocument = {
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

export function floatingHarness(
  options: {
    editable?: boolean;
    /** Omit the fake contribution to exercise the built-in rich surface. */
    contributedEditor?: boolean;
    /** The stress document swaps in the shared fixture blocks (T015). */
    document?: BuilderDocument;
    blocks?: TrustedExtensionManifest;
    /** Per-node geometry; one constant box unless a test needs room to mirror. */
    rect?: { x: number; y: number; width: number; height: number };
  } = {},
) {
  const inlineEdit: { handle: CanvasInlineEditHandle | null } = { handle: null };
  fake = null;
  loads.count = 0;
  const kernel = createBuilder({
    document: options.document ?? FLOAT_DOC,
    extensions:
      options.contributedEditor === false
        ? [options.blocks ?? FLOAT_BLOCKS]
        : [options.blocks ?? FLOAT_BLOCKS, FAKE_EDITOR],
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
      onInlineEditHandle={(handle) => {
        inlineEdit.handle = handle;
      }}
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
    if (kernel.context.store.getState().selection[0] !== id) {
      throw new Error(`drag handle belongs to the selected block, received ${id}`);
    }
    const handle = view.container.querySelector<HTMLElement>('[data-bldr-drag-handle]');
    if (handle === null) {
      throw new Error(`selected block ${id} must expose a drag handle`);
    }
    handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
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
        const selection = frameDocument.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      fake?.anchor(
        actions.length === 0
          ? null
          : {
              measure: () => ({ box: selectionBox }),
            },
      );
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
    pendingFlushes: () => queue.length,
    setFrameBox: (next: typeof frameBox) => {
      frameBox = next;
    },
    setSelectionBox: (next: typeof selectionBox) => {
      selectionBox = next;
    },
    inlineEdit,
    host: (kind: 'bubble' | 'actions') =>
      view.container.querySelector<HTMLElement>(`.bldr-floating--${kind}`),
    bubble: () => view.container.querySelector<HTMLElement>('.bldr-text-bubble'),
    bar: () => view.container.querySelector<HTMLElement>('.bldr-block-actions'),
  };
}

export const BOLD = [{ id: 'bold', label: 'Bold', pressed: false, run: () => undefined }];
