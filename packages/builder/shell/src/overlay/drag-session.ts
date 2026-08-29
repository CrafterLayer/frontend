import { insertedNodeId, type BuilderKernel } from '@craftkit/builder-core';

import { blockDisplayName, displayNameForBlockType } from '../naming/block-display-name';
import type { GeometryPorts, RectIndex } from '../rects';
import { createDragChrome, type DragChrome } from './drag-chrome';
import { resolveDropTarget, seatOf, type DragPayload, type DropTarget } from './drop-resolver';

export type DragPhase = 'idle' | 'pending' | 'active';

export interface DragSession {
  /** Pointer inputs in frame-local coordinates (the palette bridge translates). */
  press: (payload: DragPayload, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  release: () => void;
  cancel: () => void;
  phase: () => DragPhase;
  target: () => DropTarget | null;
  /** The current (or last) gesture's payload kind; null before any press. */
  payloadKind: () => 'move' | 'insert' | null;
  /** True iff the MOST RECENT press crossed the threshold (survives release). */
  lastGestureActivated: () => boolean;
  dispose: () => void;
}

const ACTIVATION_THRESHOLD_PX = 4;

/**
 * The gesture state machine (006 contract §1): idle → pending → active →
 * committed | cancelled. Chrome-only until drop (s2), exactly one dispatch on
 * commit (s3), zero-trace cancel (s4), announced outcomes (s5). Plain TS —
 * nothing here can re-render content because nothing here touches React.
 */
export function createDragSession(options: {
  kernel: BuilderKernel;
  index: RectIndex;
  layer: HTMLElement;
  schedule: GeometryPorts['schedule'];
  /** Preview viewport bounds — OUTSIDE them there is NO target, ever (s6). */
  viewport: () => { width: number; height: number };
  announce: (message: string) => void;
  onHoverSuppress: (active: boolean) => void;
}): DragSession {
  const { kernel, index, layer, schedule, viewport, announce, onHoverSuppress } = options;
  const chrome: DragChrome = createDragChrome(layer);

  let phase: DragPhase = 'idle';
  let payload: DragPayload | null = null;
  let lastKind: 'move' | 'insert' | null = null;
  let lastActivated = false;
  let origin = { x: 0, y: 0 };
  let pointer = { x: 0, y: 0 };
  let currentTarget: DropTarget | null = null;
  let cancelFlush: (() => void) | null = null;
  let disposed = false;

  const labelFor = (candidate: DragPayload): string => {
    if (candidate.kind === 'move') {
      return blockDisplayName(kernel, candidate.id);
    }
    // An insert has no node id yet. Keep an unregistered contribution's raw
    // type for the same diagnostic reason blockDisplayName does.
    return kernel.context.registry.block(candidate.type) === undefined
      ? candidate.type
      : displayNameForBlockType(candidate.type);
  };

  const reset = () => {
    const wasActive = phase === 'active';
    phase = 'idle';
    payload = null;
    currentTarget = null;
    cancelFlush?.();
    cancelFlush = null;
    chrome.hideAll();
    if (wasActive) {
      onHoverSuppress(false); // pending never suppressed anything
    }
  };

  const flush = () => {
    cancelFlush = null;
    if (disposed || phase !== 'active' || payload === null) {
      return;
    }
    chrome.moveGhost(pointer.x, pointer.y);
    // s6: a pointer OUTSIDE the preview viewport has no target — "empty area
    // inside the canvas" (root append) and "left the canvas entirely" are
    // different things, and only the resolver may see in-bounds coordinates.
    const bounds = viewport();
    if (pointer.x < 0 || pointer.y < 0 || pointer.x >= bounds.width || pointer.y >= bounds.height) {
      currentTarget = null;
      chrome.hideTarget();
      return;
    }
    currentTarget = resolveDropTarget(
      kernel.getDocument(),
      kernel.context.registry,
      index,
      payload,
      pointer.x,
      pointer.y,
    );
    if (currentTarget === null) {
      chrome.hideTarget();
    } else {
      chrome.showTarget(currentTarget.indicatorRect, index.rect(currentTarget.parentId));
    }
  };

  const markDirty = () => {
    if (disposed || cancelFlush !== null) {
      return;
    }
    cancelFlush = schedule(flush);
  };

  const activate = () => {
    if (payload === null) {
      return;
    }
    // A move payload whose node vanished while PENDING must not activate ghost
    // chrome for a nonexistent node (FR-001's self-cancel covers every phase).
    if (payload.kind === 'move' && kernel.getDocument().nodes[payload.id] === undefined) {
      announce('Drag cancelled');
      reset();
      return;
    }
    lastActivated = true;
    phase = 'active';
    onHoverSuppress(true);
    const sourceRect = payload.kind === 'move' ? index.rect(payload.id) : undefined;
    chrome.showGhost(
      { width: sourceRect?.width ?? 120, height: sourceRect?.height ?? 32 },
      labelFor(payload),
    );
    markDirty();
  };

  // A move payload whose node disappears at ANY non-idle phase self-cancels
  // (s4/FR-001 — pending included, so no ghost can ever activate for it).
  const offStore = kernel.context.store.subscribe(() => {
    if (
      phase !== 'idle' &&
      payload?.kind === 'move' &&
      kernel.getDocument().nodes[payload.id] === undefined
    ) {
      /*
        The RESET still happens for `pending` — that is the self-cancel law and
        it must not weaken. The ANNOUNCEMENT is a different question: a gesture
        that never became a drag has nothing to cancel, and saying so is a plain
        untruth. Measured on a fresh page: one ordinary left-click to select a
        block put "Drag cancelled" into the Gesture live region, so a
        screen-reader user was told a drag had been cancelled every time they
        chose a block.
      */
      if (phase === 'active') {
        announce('Drag cancelled');
      }
      reset();
    }
  });

  // Direction flips (and any other observed reflow) re-resolve the indicator
  // WITHOUT pointer movement — the same observation channel the hover/selection
  // chrome rides (spec edge case "direction flip mid-drag").
  const offInvalidate = index.onInvalidate(() => {
    if (phase === 'active') {
      markDirty();
    }
  });

  const commit = (committed: DragPayload, target: DropTarget) => {
    if (committed.kind === 'move') {
      const seat = seatOf(kernel.getDocument(), committed.id);
      const samePosition =
        seat?.parentId === target.parentId &&
        seat.slot === target.slot &&
        seat.index === target.index;
      if (!samePosition) {
        kernel.dispatch('moveNode', {
          id: committed.id,
          toParentId: target.parentId,
          toSlot: target.slot,
          toIndex: target.index,
        });
      }
      kernel.setSelection([committed.id]);
      announce(samePosition ? 'Kept in place' : `Moved ${labelFor(committed)}`);
    } else {
      const tx = kernel.dispatch('insertNode', {
        type: committed.type,
        parentId: target.parentId,
        slot: target.slot,
        index: target.index,
      });
      const inserted = insertedNodeId(tx.patches);
      if (inserted !== undefined) {
        kernel.setSelection([inserted]);
      }
      announce(`Inserted ${labelFor(committed)}`);
    }
  };

  return {
    press(nextPayload, x, y) {
      if (disposed || phase !== 'idle') {
        return;
      }
      phase = 'pending';
      payload = nextPayload;
      lastKind = nextPayload.kind;
      lastActivated = false;
      origin = { x, y };
      pointer = { x, y };
    },
    move(x, y) {
      if (disposed || phase === 'idle') {
        return;
      }
      pointer = { x, y };
      if (phase === 'pending') {
        const distance = Math.hypot(x - origin.x, y - origin.y);
        if (distance < ACTIVATION_THRESHOLD_PX) {
          return; // still a potential click — no chrome yet (s1)
        }
        activate();
        return;
      }
      markDirty();
    },
    release() {
      if (disposed || phase === 'idle') {
        return;
      }
      if (phase === 'pending') {
        reset(); // plain click — selection is the click handler's business (s1)
        return;
      }
      // Resolve against the LATEST pointer position, not a possibly-stale flush.
      flush();
      const target = currentTarget;
      const committed = payload;
      if (target === null || committed === null) {
        announce('No valid target');
        reset();
        return;
      }
      reset();
      commit(committed, target);
    },
    cancel() {
      if (disposed || phase === 'idle') {
        return;
      }
      announce('Drag cancelled');
      reset();
    },
    phase: () => phase,
    target: () => currentTarget,
    payloadKind: () => lastKind,
    lastGestureActivated: () => lastActivated,
    dispose() {
      disposed = true;
      offStore();
      offInvalidate();
      cancelFlush?.();
      chrome.dispose();
    },
  };
}
