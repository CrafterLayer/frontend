import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';

import { customCodeElementAt } from '../../custom-code/element-at';
import type { ElementTarget } from '../../custom-code/element-target';
import { performMoveAction, resolveMoveAction } from '../../keyboard/move-actions';
import {
  parentOf,
  resolveTraversalAction,
  traverse,
  type SlotOrderLookup,
} from '../../keyboard/traversal';
import { inlineTargetOf } from '../../overlay/inline-session';
import {
  isFreelyPositioned,
  isNudgeKey,
  measuredInsets,
  moveTreeElementBy,
  nudgeDelta,
} from '../../overlay/snap-guides';
import { elementDomOf, focusedTreeTarget } from './element-canvas-helpers';
import type { CanvasRefs } from './use-canvas-refs';

/** The modifier-aware key a canvas handler reads (a DOM or a React keyboard event). */
export type CanvasKey = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>;

export interface CanvasKeysInputs {
  kernel: BuilderKernel;
  editable: boolean;
  dir: 'ltr' | 'rtl';
  beginTreeTextEditing: (target: Extract<ElementTarget, { kind: 'tree' }>) => boolean;
  refs: CanvasRefs;
  setQuickFocusRequest: Dispatch<SetStateAction<number>>;
}

/**
 * The canvas's own keys: the P7 element keys (claimed first) and block
 * traversal with its Escape ladder and the B2b Alt-moves (claimed last). The
 * part and inline keys sit between them and live with their gestures.
 */
export function useCanvasKeys({
  kernel,
  editable,
  dir,
  beginTreeTextEditing,
  refs,
  setQuickFocusRequest,
}: CanvasKeysInputs) {
  const { machineryRef, bucketRef, styleStateRef, dirRef, announceGestureRef } = refs;
  /**
   * P7 element keys, claimed BEFORE inline editing and traversal:
   * Alt+F10 enters the quick bar; Enter edits a text element in place or
   * steps into the first child; Shift+Enter steps to the parent; arrows nudge
   * an absolutely positioned element (1px, Shift 10px, mirrored under RTL);
   * Escape abandons a spacing scrub in flight.
   */
  const handleElementKey = useCallback(
    (event: CanvasKey): boolean => {
      const modified = event.ctrlKey || event.metaKey;
      if (event.key === 'F10' && event.altKey) {
        if (focusedTreeTarget(kernel) === undefined) {
          return false;
        }
        setQuickFocusRequest((current) => current + 1);
        return true;
      }
      const machinery = machineryRef.current;
      if (event.key === 'Escape' && machinery?.handles?.isScrubbing() === true) {
        machinery.handles.cancel();
        return true;
      }
      const target = focusedTreeTarget(kernel);
      if (target === undefined) {
        // A selected region that declares no inline text: Enter steps INTO
        // its tree, the keyboard way to reach the elements inside it.
        const selected = kernel.context.store.getState().selection[0];
        if (
          event.key === 'Enter' &&
          !event.shiftKey &&
          !modified &&
          selected !== undefined &&
          inlineTargetOf(kernel, selected) === null &&
          customCodeElementAt(kernel, selected, [0]) !== undefined
        ) {
          kernel.focusElement(selected, [0]);
          return true;
        }
        return false;
      }
      if (modified || event.altKey) {
        return false;
      }
      if (event.key === 'Enter' && event.shiftKey) {
        if (target.path.length > 1) {
          kernel.focusElement(target.nodeId, target.path.slice(0, -1));
        } else {
          kernel.clearElementFocus();
        }
        return true;
      }
      if (event.key === 'Enter') {
        if (beginTreeTextEditing(target)) {
          return true;
        }
        if (customCodeElementAt(kernel, target.nodeId, [...target.path, 0]) !== undefined) {
          kernel.focusElement(target.nodeId, [...target.path, 0]);
          return true;
        }
        return false;
      }
      if (editable && isNudgeKey(event.key) && machinery !== null) {
        const element = elementDomOf(machinery.index, target.nodeId, target.path);
        if (element === null || !isFreelyPositioned(element)) {
          return false;
        }
        const result = moveTreeElementBy(kernel, target, nudgeDelta(event.key, event.shiftKey), {
          bucket: bucketRef.current,
          state: styleStateRef.current,
          dir: dirRef.current,
          label: 'Nudge',
          measured: measuredInsets(element, dirRef.current),
        });
        announceGestureRef.current(result.announcement);
        return true;
      }
      return false;
    },
    [
      kernel,
      editable,
      beginTreeTextEditing,
      machineryRef,
      bucketRef,
      styleStateRef,
      dirRef,
      announceGestureRef,
      setQuickFocusRequest,
    ],
  );

  const slotOrder = useCallback<SlotOrderLookup>(
    (type) => {
      const slots = kernel.context.registry.block(type)?.schema.slots;
      return slots === undefined ? undefined : Object.keys(slots);
    },
    [kernel],
  );

  /** Shared by the host handler and the in-frame handler; true = key consumed. */
  const handleTraversalKey = useCallback(
    (key: string, altKey = false): boolean => {
      // An active drag owns Escape (session cancel, selection untouched).
      const session = machineryRef.current?.session ?? null;
      if (key === 'Escape' && session !== null && session.phase() !== 'idle') {
        session.cancel();
        return true;
      }
      // Escape steps OUT of an element before it clears anything: the region
      // that hosts it becomes the selection, and a second Escape is the
      // kernel's ordinary way out.
      if (key === 'Escape' && kernel.context.store.getState().elementFocus !== null) {
        kernel.clearElementFocus();
        return true;
      }
      // ── block-parts (2026-10-06) ──
      // …and out of a part the same way: the block stays selected.
      if (key === 'Escape' && (kernel.context.store.getState().partFocus ?? null) !== null) {
        kernel.clearPartFocus();
        return true;
      }
      // ── /block-parts ──
      // After foreground chrome and inline editing have had their own first
      // chance, Escape climbs exactly one document level before it clears.
      if (key === 'Escape') {
        const selected = kernel.context.store.getState().selection[0];
        if (selected === undefined) return false;
        const parent = parentOf(kernel.getDocument(), selected);
        if (parent === undefined) {
          kernel.clearSelection();
        } else {
          kernel.setSelection([parent]);
        }
        return true;
      }
      // B2b Alt-moves run AHEAD of traversal and only on editable canvases.
      if (editable) {
        const moveAction = resolveMoveAction(key, altKey, dir);
        const selected = kernel.context.store.getState().selection[0];
        if (moveAction !== undefined && selected !== undefined) {
          announceGestureRef.current(performMoveAction(kernel, selected, moveAction));
          return true;
        }
      }
      if (altKey) {
        return false; // never treat Alt-chords as plain traversal
      }
      const action = resolveTraversalAction(key, dir);
      if (action === undefined) {
        return false; // Tab and everything else stay native (FR-009)
      }
      const next = traverse(
        kernel.getDocument(),
        slotOrder,
        kernel.context.store.getState().selection[0],
        action,
      );
      if (next === undefined) {
        kernel.clearSelection(); // Escape: the kernel's own way out
      } else {
        kernel.setSelection([next]);
      }
      return true;
    },
    [kernel, dir, slotOrder, editable, machineryRef, announceGestureRef],
  );

  return { handleElementKey, handleTraversalKey };
}
