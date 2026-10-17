import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { lightTheme } from '@craftkit/builder-renderer';
import type { BuilderDocument, TrustedExtensionManifest } from '@craftkit/builder-schema';

import type { GeometryPorts } from '../../rects';
import { EditorCanvas } from './EditorCanvas';
import { EDITOR_CANVAS_LABELS_EN, type EditorCanvasLabels } from './EditorCanvas.labels';
import { block, inlineBlock } from './EditorCanvas.test-helpers';

/*
  Render-cost pass (2026-10-13). The open inline editor is reached through a
  node-keyed seam: a NEW binding notifies the edited node and re-renders it.
  The binding used to depend on the whole `canvasLabels` object although it
  reads only `locale`, so a host re-rendering with equal-but-new labels
  re-rendered the open editor on every host render.
*/

const BLOCKS: TrustedExtensionManifest = {
  tier: 1,
  name: 'render-cost-blocks',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', 'Page', { default: { allow: ['headline'] } }),
      inlineBlock('headline', 'Headline', true),
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['h1'] } },
    h1: { id: 'h1', type: 'headline', props: { label: 'Editable title' } },
  },
};

function costHarness() {
  const kernel = createBuilder({
    document: DOC,
    extensions: [BLOCKS],
    ports: { clock: fixedClock(), ids: seededIds('cost') },
  });
  const renders: string[] = [];
  let hitTarget: Element | null = null;
  // ONE stable set of props: only the labels object changes between renders.
  const onBlockRender = (id: string) => {
    renders.push(id);
  };
  const ports: Partial<GeometryPorts> = {
    measure: () => ({ x: 5, y: 6, width: 50, height: 20 }),
    hitTest: () => hitTarget,
    viewport: () => ({ width: 400, height: 600 }),
    schedule: () => () => undefined,
  };
  const ui = (canvasLabels: EditorCanvasLabels) => (
    <EditorCanvas
      kernel={kernel}
      theme={lightTheme}
      geometryPorts={ports}
      onBlockRender={onBlockRender}
      canvasLabels={canvasLabels}
      editable
    />
  );
  const view = render(ui({ ...EDITOR_CANVAS_LABELS_EN }));
  const frameDocument = screen.getByTitle<HTMLIFrameElement>('Editor canvas').contentDocument;
  if (frameDocument === null) {
    throw new Error('frame must expose a document');
  }
  const openInline = (id: string) => {
    kernel.setSelection([id]);
    hitTarget = frameDocument.querySelector(`[data-bldr-node="${id}"]`);
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('dblclick', { clientX: 10, clientY: 10 }));
    });
  };
  const surface = () => frameDocument.querySelector<HTMLElement>('.bldr-inline-text');
  return { kernel, view, ui, renders, openInline, surface };
}

describe('EditorCanvas render cost (2026-10-13)', () => {
  it('an open inline editor is NOT re-rendered when the host re-renders with equal labels', () => {
    const h = costHarness();
    h.openInline('h1');
    expect(h.surface()).not.toBeNull();
    h.renders.length = 0;

    // Three host renders, each with a fresh-but-equal labels object.
    h.view.rerender(h.ui({ ...EDITOR_CANVAS_LABELS_EN }));
    h.view.rerender(h.ui({ ...EDITOR_CANVAS_LABELS_EN }));
    h.view.rerender(h.ui({ ...EDITOR_CANVAS_LABELS_EN }));

    expect(h.renders).toEqual([]);
    // Still the same open session, and it still commits through the door.
    const editable = h.surface();
    expect(editable).not.toBeNull();
    act(() => {
      editable!.textContent = 'Kept';
      editable!.dispatchEvent(new Event('input', { bubbles: true }));
      editable!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(h.kernel.getDocument().nodes['h1']?.props['label']).toBe('Kept');
  });

  it('host renders with equal labels and NO open edit render no block at all', () => {
    const h = costHarness();
    h.kernel.setSelection(['h1']);
    h.renders.length = 0;
    h.view.rerender(h.ui({ ...EDITOR_CANVAS_LABELS_EN }));
    h.view.rerender(h.ui({ ...EDITOR_CANVAS_LABELS_EN }));
    expect(h.renders).toEqual([]);
  });
});
