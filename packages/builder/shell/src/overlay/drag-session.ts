import { insertedNodeId, type BuilderKernel } from '@craftkit/builder-core';

import { customCodeElementAt } from '../custom-code/element-at';
import { treeNodeDisplayName, tryDispatchTreeEdits } from '../custom-code/element-target';
import { blockDisplayName, displayNameForBlockType } from '../naming/block-display-name';
import type { GeometryPorts, RectIndex } from '../rects';
import { createDragChrome, type DragChrome } from './drag-chrome';
import { resolveDropTarget, seatOf, type DragPayload, type DropTarget } from './drop-resolver';
import { alignmentGuides, createGuideChrome, type GuideChrome } from './snap-guides';
import {
  resolveTreeDropTarget,
  treeDropSteps,
  type TreeDragPayload,
  type TreeDropPorts,
  type TreeDropTarget,
} from './tree-drop-resolver';

/**
 * Everything a drag can carry: a block (move/insert, slot drops) or a
 * custom-code tree element (P7: tree-move/tree-insert, path drops).
 */
export type SessionPayload = DragPayload | TreeDragPayload;

function isTreePayload(payload: SessionPayload): payload is TreeDragPayload {
  return payload.kind === 'tree-move' || payload.kind === 'tree-insert';
}

export type DragPhase = 'idle' | 'pending' | 'active';
export type DragPressOrigin = 'handle' | 'surface';

export interface DragSession {
  /** Pointer inputs in frame-local coordinates (the palette bridge translates). */
  press: (payload: SessionPayload, x: number, y: number, origin: DragPressOrigin) => void;
  move: (x: number, y: number) => void;
  release: () => void;
  cancel: () => void;
  phase: () => DragPhase;
  target: () => DropTarget | null;
  /** The resolved TREE seat while a tree payload is dragged (P7). */
  treeTarget: () => TreeDropTarget | null;
  /** The current (or last) gesture's payload kind; null before any press. */
  payloadKind: () => SessionPayload['kind'] | null;
  /** True iff the MOST RECENT press crossed the threshold (survives release). */
  lastGestureActivated: () => boolean;
  dispose: () => void;
}

export const DRAG_ACTIVATION_THRESHOLD_PX = 8;

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
  /** The frame document tree drops hit-test (P7). Absent ⇒ tree payloads find no target. */
  frameDocument?: Document | undefined;
  /** The PAGE direction, for RTL-aware tree seats. */
  dir?: (() => 'ltr' | 'rtl') | undefined;
  /** Test-only geometry for tree drops (jsdom has no layout). */
  treePorts?: Partial<TreeDropPorts> | undefined;
}): DragSession {
  const { kernel, index, layer, schedule, viewport, announce, onHoverSuppress } = options;
  const chrome: DragChrome = createDragChrome(layer);
  const guides: GuideChrome = createGuideChrome(layer);

  let phase: DragPhase = 'idle';
  let payload: SessionPayload | null = null;
  let lastKind: SessionPayload['kind'] | null = null;
  let lastActivated = false;
  let origin = { x: 0, y: 0 };
  let pointer = { x: 0, y: 0 };
  let currentTarget: DropTarget | null = null;
  let currentTreeTarget: TreeDropTarget | null = null;
  let cancelFlush: (() => void) | null = null;
  let disposed = false;

  const labelFor = (candidate: SessionPayload): string => {
    if (candidate.kind === 'tree-insert') {
      return candidate.label;
    }
    if (candidate.kind === 'tree-move') {
      const found = customCodeElementAt(kernel, candidate.id, candidate.path);
      return found === undefined ? 'element' : treeNodeDisplayName(found.element);
    }
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
    currentTreeTarget = null;
    cancelFlush?.();
    cancelFlush = null;
    chrome.hideAll();
    guides.hide();
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
      currentTreeTarget = null;
      chrome.hideTarget();
      guides.hide();
      return;
    }
    if (isTreePayload(payload)) {
      currentTreeTarget =
        options.frameDocument === undefined
          ? null
          : resolveTreeDropTarget({
              kernel,
              frameDocument: options.frameDocument,
              payload,
              x: pointer.x,
              y: pointer.y,
              dir: options.dir?.() ?? 'ltr',
              ports: options.treePorts,
            });
      if (currentTreeTarget === null) {
        currentTarget = payload.kind === 'tree-insert' && payload.fallback !== undefined
          ? resolveDropTarget(kernel.getDocument(), kernel.context.registry, index, payload.fallback, pointer.x, pointer.y)
          : null;
        if (currentTarget === null) chrome.hideTarget();
        else chrome.showTarget(currentTarget.indicatorRect, index.rect(currentTarget.parentId));
        guides.hide();
      } else {
        currentTarget = null;
        chrome.showTarget(currentTreeTarget.indicatorRect, currentTreeTarget.parentRect);
        guides.show(alignmentGuides(currentTreeTarget.siblingRects, currentTreeTarget.parentRect));
      }
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
    if (vanished(payload)) {
      announce('Drag cancelled');
      reset();
      return;
    }
    lastActivated = true;
    phase = 'active';
    onHoverSuppress(true);
    const sourceRect =
      payload.kind === 'move'
        ? index.rect(payload.id)
        : payload.kind === 'tree-move'
          ? index.elementRect?.(payload.id, payload.path)
          : undefined;
    chrome.showGhost(
      { width: sourceRect?.width ?? 120, height: sourceRect?.height ?? 32 },
      labelFor(payload),
    );
    markDirty();
  };

  /** A moved block or element that no longer exists. */
  function vanished(candidate: SessionPayload | null): boolean {
    if (candidate?.kind === 'move') return kernel.getDocument().nodes[candidate.id] === undefined;
    if (candidate?.kind === 'tree-move') {
      return customCodeElementAt(kernel, candidate.id, candidate.path) === undefined;
    }
    return false;
  }

  // A move payload whose node disappears at ANY non-idle phase self-cancels
  // (s4/FR-001 — pending included, so no ghost can ever activate for it).
  const offStore = kernel.context.store.subscribe(() => {
    if (phase !== 'idle' && vanished(payload)) {
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

  const commitTree = (committed: TreeDragPayload, target: TreeDropTarget) => {
    if (committed.kind === 'tree-insert' && committed.onDrop !== undefined) {
      committed.onDrop(target);
      return;
    }
    const label = labelFor(committed);
    const plan = treeDropSteps(committed, target);
    if (plan === undefined) {
      announce('Kept in place');
      return;
    }
    const verb = committed.kind === 'tree-insert' ? 'Insert' : 'Move';
    const result = tryDispatchTreeEdits(kernel, plan.steps, `${verb} · ${label}`);
    if (!result.ok) {
      announce(result.message);
      return;
    }
    kernel.focusElement(plan.focus.id, plan.focus.path);
    announce(`${committed.kind === 'tree-insert' ? 'Inserted' : 'Moved'} ${label}`);
  };

  const commit = (committed: DragPayload, target: DropTarget) => {
    if (committed.kind === 'insert' && committed.onDrop !== undefined) {
      committed.onDrop(target);
      return;
    }
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
    press(nextPayload, x, y, pressOrigin) {
      if (disposed || phase !== 'idle') {
        return;
      }
      if ((nextPayload.kind === 'move' || nextPayload.kind === 'tree-move') && pressOrigin !== 'handle') {
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
        if (distance < DRAG_ACTIVATION_THRESHOLD_PX) {
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
      const committed = payload;
      if (committed !== null && isTreePayload(committed)) {
        const treeTarget = currentTreeTarget;
        const blockTarget = currentTarget;
        reset();
        if (treeTarget === null) {
          if (committed.kind === 'tree-insert' && committed.fallback !== undefined && blockTarget !== null) {
            commit(committed.fallback, blockTarget);
            return;
          }
          announce('No valid target');
          return;
        }
        commitTree(committed, treeTarget);
        return;
      }
      const target = currentTarget;
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
      reset();
      announce('Drag cancelled');
    },
    phase: () => phase,
    target: () => currentTarget,
    treeTarget: () => currentTreeTarget,
    payloadKind: () => lastKind,
    lastGestureActivated: () => lastActivated,
    dispose() {
      disposed = true;
      offStore();
      offInvalidate();
      cancelFlush?.();
      chrome.dispose();
      guides.dispose();
    },
  };
}
