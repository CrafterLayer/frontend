import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

import type { GeometryPorts, RectIndex } from '../rects';
import { createOutline, type OutlineHandle } from './outline-elements';

export interface OverlayController {
  /** Pointer path input (overlay-local; hover NEVER enters the kernel). */
  setHover(id: NodeId | null): void;
  hoveredId(): NodeId | null;
  dispose(): void;
}

/**
 * The React-free chrome driver (005 R6/R7): selection comes FROM the kernel
 * (single source of truth — FR-004), hover from the pointer path; geometry
 * invalidations arrive via the index's observation channel. Any change only
 * marks the overlay dirty; ONE frame-rhythm flush performs batched reads
 * (rects) then batched writes (transforms) — zero React, zero allocation on
 * the sweep path, stale ids simply hide (FR-007).
 */
export function createOverlayController(options: {
  kernel: BuilderKernel;
  index: RectIndex;
  layer: HTMLElement;
  schedule: GeometryPorts['schedule'];
}): OverlayController {
  const { kernel, index, layer, schedule } = options;
  const hover: OutlineHandle = createOutline(layer, 'hover');
  const selection: OutlineHandle = createOutline(layer, 'selection');

  let hoverId: NodeId | null = null;
  let cancelFlush: (() => void) | null = null;
  let disposed = false;

  const labelFor = (id: NodeId): string => {
    const type = kernel.getDocument().nodes[id]?.type;
    if (type === undefined) {
      return id;
    }
    return kernel.context.registry.block(type)?.schema.description ?? type;
  };

  const applyOutline = (outline: OutlineHandle, id: NodeId | null) => {
    const rect = id === null ? undefined : index.rect(id);
    if (id === null || rect === undefined) {
      outline.hide();
      return;
    }
    outline.show(rect, labelFor(id));
  };

  const flush = () => {
    cancelFlush = null;
    if (disposed) {
      return;
    }
    // Batched reads (rect lookups) happen inside show(); both outlines write in
    // the same frame callback — one read phase, one write phase, per rhythm.
    applyOutline(hover, hoverId);
    applyOutline(selection, kernel.context.store.getState().selection[0] ?? null);
  };

  const markDirty = () => {
    if (disposed || cancelFlush !== null) {
      return;
    }
    cancelFlush = schedule(flush);
  };

  // Cold-path inputs: kernel state (selection, document changes incl. undo) and
  // geometry observation. Each just marks dirty — the flush reads fresh truth.
  const offStore = kernel.context.store.subscribe(markDirty);
  const offInvalidate = index.onInvalidate(markDirty);

  return {
    setHover(id) {
      if (id === hoverId) {
        return;
      }
      hoverId = id;
      markDirty();
    },
    hoveredId: () => hoverId,
    dispose() {
      disposed = true;
      cancelFlush?.();
      offStore();
      offInvalidate();
      hover.element.remove();
      selection.element.remove();
    },
  };
}
