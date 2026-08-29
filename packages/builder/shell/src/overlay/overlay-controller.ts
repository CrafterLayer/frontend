import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

import { blockDisplayName } from '../naming/block-display-name';
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

  const applyOutline = (outline: OutlineHandle, id: NodeId | null) => {
    const rect = id === null ? undefined : index.rect(id);
    if (id === null || rect === undefined) {
      outline.hide();
      return;
    }
    // CSS combines this already-known physical coordinate with the overlay's
    // query-container width, so the label can use its small allowance without
    // crossing the canvas edge. No additional geometry read is introduced.
    outline.element.style.setProperty('--bldr-outline-canvas-x', `${String(rect.x)}px`);
    outline.show(rect, blockDisplayName(kernel, id));
  };

  /*
    The node carries its own state, the way Puck and GrapesJS do it.

    Until now selection existed ONLY as a box drawn over the frame and measured
    from outside. That is why it could drift — this layer once scrolled 22px out
    of register and every outline pointed at the wrong pixels — and why
    selecting a nested line felt detached rather than like touching the thing.
    Marking the element itself costs one attribute write.

    Written IMPERATIVELY on purpose: threading selection through React would
    re-render every node on every click and break a merge-blocking performance
    law — "an overlay interaction renders 0 components", asserted with a
    Profiler. An attribute write renders nothing.
  */
  const stamped = new Map<string, HTMLElement>();
  const stamp = (attribute: string, id: NodeId | null) => {
    const previous = stamped.get(attribute);
    const next = id === null ? undefined : index.element(id);
    if (previous === next) {
      return;
    }
    previous?.removeAttribute(attribute);
    if (next === undefined) {
      stamped.delete(attribute);
      return;
    }
    next.setAttribute(attribute, '');
    stamped.set(attribute, next);
  };

  const flush = () => {
    cancelFlush = null;
    if (disposed) {
      return;
    }
    // Batched reads (rect lookups) happen inside show(); both outlines write in
    // the same frame callback — one read phase, one write phase, per rhythm.
    const selectedId = kernel.context.store.getState().selection[0] ?? null;
    applyOutline(hover, hoverId);
    applyOutline(selection, selectedId);
    stamp('data-bldr-selected', selectedId);
    stamp('data-bldr-hovered', hoverId);
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
