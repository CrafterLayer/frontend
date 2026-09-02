import type { BuilderKernel } from '@craftkit/builder-core';
import { formatCustomCodePath, type CustomCodePath, type NodeId } from '@craftkit/builder-schema';

import { customCodeElementAt } from '../custom-code/element-at';
import { blockDisplayName } from '../naming/block-display-name';
import { customCodeElementName } from '../naming/custom-code-element-name';
import type { GeometryPorts, RectIndex } from '../rects';
import { createOutline, type OutlineHandle } from './outline-elements';

export interface OverlayController {
  /**
   * Pointer path input (overlay-local; hover NEVER enters the kernel). With an
   * element path, the hover chrome wraps the authored element under the
   * pointer inside a composed region rather than the whole region.
   */
  setHover(id: NodeId | null, elementPath?: CustomCodePath): void;
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
  let hoverPath: CustomCodePath | null = null;
  let cancelFlush: (() => void) | null = null;
  let disposed = false;

  /**
   * An outline over an authored ELEMENT inside a region: its own rect and its
   * own name. Stale by design — a focus or hover path can outlive the element
   * it named (undo, an AI rewrite) — so a path that no longer resolves, or one
   * this canvas never stamped, returns false and the caller draws the region.
   */
  const applyElementOutline = (outline: OutlineHandle, id: NodeId, path: CustomCodePath) => {
    const located = customCodeElementAt(kernel, id, path);
    const rect = located === undefined ? undefined : index.elementRect?.(id, path);
    if (located === undefined || rect === undefined) {
      return false;
    }
    outline.element.style.setProperty('--bldr-outline-canvas-x', `${String(rect.x)}px`);
    outline.element.setAttribute('data-element', '');
    outline.show(rect, customCodeElementName(located.element));
    return true;
  };

  const applyOutline = (outline: OutlineHandle, id: NodeId | null, path: CustomCodePath | null) => {
    if (id !== null && path !== null && applyElementOutline(outline, id, path)) {
      return;
    }
    const rect = id === null ? undefined : index.rect(id);
    if (id === null || rect === undefined) {
      outline.hide();
      return;
    }
    // CSS combines this already-known physical coordinate with the overlay's
    // query-container width, so the label can use its small allowance without
    // crossing the canvas edge. No additional geometry read is introduced.
    outline.element.style.setProperty('--bldr-outline-canvas-x', `${String(rect.x)}px`);
    outline.element.removeAttribute('data-element');
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
    const state = kernel.context.store.getState();
    const selectedId = state.selection[0] ?? null;
    const focus = state.elementFocus;
    applyOutline(hover, hoverId, hoverPath);
    applyOutline(
      selection,
      selectedId,
      focus !== null && focus.id === selectedId ? focus.path : null,
    );
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

  const samePath = (left: CustomCodePath | null, right: CustomCodePath | null) =>
    left === right ||
    (left !== null && right !== null && formatCustomCodePath(left) === formatCustomCodePath(right));

  return {
    setHover(id, elementPath) {
      const path = id === null || elementPath === undefined ? null : elementPath;
      if (id === hoverId && samePath(path, hoverPath)) {
        return;
      }
      hoverId = id;
      hoverPath = path;
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
