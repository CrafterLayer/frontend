import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId, PartRef } from '@craftkit/builder-schema';

import { inlineTargetOf } from '../../overlay/inline-session';
import {
  enclosingItemRef,
  firstPart,
  firstPartInside,
  partDeclOf,
  partInstanceName,
  partsOfNode,
  partTarget,
  steppedPart,
} from '../../overlay/part-target';
import {
  PART_QUICK_BAR_LABELS_EN,
  performPartAction,
  type ElementQuickBarLabels,
  type PartActionId,
} from '../ElementQuickBar';
import type { CanvasKey } from './use-canvas-keys';
import type { InlineEditEntryIntent } from './inline-edit-seam';
import type { CanvasRefs } from './use-canvas-refs';

export interface PartGesturesInputs {
  kernel: BuilderKernel;
  editable: boolean;
  quickBarLabels: ElementQuickBarLabels;
  beginInlineEdit: (nodeId: NodeId, entry: InlineEditEntryIntent, part?: PartRef) => boolean;
  refs: CanvasRefs;
  setQuickFocusRequest: Dispatch<SetStateAction<number>>;
}

// ── block-parts (2026-10-06) ──
/**
 * Part gestures (block-parts DESIGN §2.7). The words are read through refs:
 * these handlers live on the frame document and must not re-subscribe.
 * `refs.partScopeRef` is written by the part quick bar's scope switch.
 */
export function usePartGestures({
  kernel,
  editable,
  quickBarLabels,
  beginInlineEdit,
  refs,
  setQuickFocusRequest,
}: PartGesturesInputs) {
  const { sessionRef, canvasLabelsRef, wordsRef, onReplacePartImageRef, announceGestureRef } = refs;
  const { partScopeRef } = refs;
  const partWordsRef = useRef(quickBarLabels.parts ?? PART_QUICK_BAR_LABELS_EN);
  useEffect(() => {
    partWordsRef.current = quickBarLabels.parts ?? PART_QUICK_BAR_LABELS_EN;
  }, [quickBarLabels]);

  /**
   * Open what a part IS: a text, rich or link part opens its inline editor at
   * the part's bind; an image part asks the host for its asset picker. The
   * part is focused first, so the session and the focus name the same thing.
   * False when nothing opened (a read-only canvas, no picker, a list or box).
   */
  const activatePart = useCallback(
    (nodeId: NodeId, ref: PartRef, entry: InlineEditEntryIntent): boolean => {
      const decl = partDeclOf(kernel, nodeId, ref.part);
      if (decl === undefined) {
        return false;
      }
      const focus = kernel.context.store.getState().partFocus;
      if (
        focus?.id !== nodeId ||
        focus.part !== ref.part ||
        focus.index.join('.') !== ref.index.join('.')
      ) {
        kernel.focusPart(nodeId, ref);
      }
      const labels = canvasLabelsRef.current;
      const name = partInstanceName(kernel, nodeId, ref, labels.locale ?? 'en');
      if (decl.kind === 'image') {
        const replace = onReplacePartImageRef.current;
        if (replace === undefined || !editable) {
          announceGestureRef.current(labels.partNotEditable?.(name) ?? labels.editingUnavailable);
          return false;
        }
        replace(partTarget(nodeId, ref));
        return true;
      }
      if ((decl.kind !== 'text' && decl.kind !== 'rich' && decl.kind !== 'link') || !editable) {
        return false;
      }
      const opened = beginInlineEdit(nodeId, entry, ref);
      announceGestureRef.current(opened ? labels.editing(name) : labels.editingUnavailable);
      return opened;
    },
    [kernel, editable, beginInlineEdit, canvasLabelsRef, onReplacePartImageRef, announceGestureRef],
  );

  /**
   * Keys with a part focused, claimed BEFORE the block's inline Enter and
   * before traversal: Enter opens the part (or steps into a list or item),
   * Shift+Enter steps out to the enclosing item, list or block, Delete removes
   * a focused item, Alt+↑/↓ move the item the part lives in, Tab/Shift+Tab
   * walk the block's parts in document order (and leave the canvas at either
   * end — never a keyboard trap), Alt+F10 enters the quick bar. An open
   * inline edit owns every key.
   */
  const handlePartKey = useCallback(
    (event: CanvasKey): boolean => {
      const state = kernel.context.store.getState();
      const focus = state.partFocus;
      const selected = state.selection[0];
      if (sessionRef.current?.current() != null || selected === undefined) {
        return false;
      }
      if (focus?.id !== selected) {
        // A selected block that declares parts but no inline text: Enter steps
        // INTO its first part, the keyboard way to reach the heading.
        if (
          event.key !== 'Enter' ||
          event.shiftKey ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          inlineTargetOf(kernel, selected) !== null
        ) {
          return false;
        }
        const first = firstPart(kernel, selected);
        if (first === undefined) {
          return false;
        }
        kernel.focusPart(selected, first);
        return true;
      }
      if (event.ctrlKey || event.metaKey) {
        return false;
      }
      if (event.key === 'F10' && event.altKey) {
        setQuickFocusRequest((current) => current + 1);
        return true;
      }
      const nodeId = focus.id;
      const ref: PartRef = { part: focus.part, index: [...focus.index] };
      const parts = partsOfNode(kernel, nodeId);
      const decl = parts[ref.part];
      if (decl === undefined) {
        return false;
      }
      const context = {
        scope: partScopeRef.current,
        locale: canvasLabelsRef.current.locale ?? 'en',
        words: partWordsRef.current,
        nameWords: wordsRef.current,
        editable,
      } as const;
      const run = (id: PartActionId) => {
        announceGestureRef.current(
          performPartAction(kernel, partTarget(nodeId, ref), id, context).announcement,
        );
      };
      const stepPart = (step: 1 | -1): boolean => {
        const next = steppedPart(kernel, nodeId, ref, step);
        if (next === undefined) {
          return false; // the native Tab leaves the canvas
        }
        kernel.focusPart(nodeId, next);
        return true;
      };
      if (event.key === 'Enter' && !event.altKey) {
        if (event.shiftKey) {
          // Out one level: a part inside a card → the card; a card → its list.
          const item = enclosingItemRef(parts, ref);
          const listName = decl.kind === 'item' ? decl.list : undefined;
          if (item !== undefined && item.part !== ref.part) {
            kernel.focusPart(nodeId, item);
          } else if (listName !== undefined && parts[listName] !== undefined) {
            kernel.focusPart(nodeId, { part: listName, index: ref.index.slice(0, -1) });
          } else {
            kernel.clearPartFocus();
          }
          return true;
        }
        if (activatePart(nodeId, ref, { kind: 'keyboard' })) {
          return true;
        }
        // A list or an item steps INTO its first part — the keyboard way down.
        const inside = firstPartInside(kernel, nodeId, ref);
        if (inside !== undefined) {
          kernel.focusPart(nodeId, inside);
          return true;
        }
        return decl.kind === 'image';
      }
      if (!editable) {
        return event.key === 'Tab' && !event.altKey ? stepPart(event.shiftKey ? -1 : 1) : false;
      }
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !event.altKey &&
        decl.kind === 'item'
      ) {
        run('remove');
        return true;
      }
      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        if (enclosingItemRef(parts, ref) === undefined) {
          return false;
        }
        run(event.key === 'ArrowUp' ? 'moveUp' : 'moveDown');
        return true;
      }
      if (event.key === 'Tab' && !event.altKey) {
        return stepPart(event.shiftKey ? -1 : 1);
      }
      return false;
    },
    [
      kernel,
      editable,
      activatePart,
      sessionRef,
      canvasLabelsRef,
      wordsRef,
      announceGestureRef,
      setQuickFocusRequest,
      partScopeRef,
    ],
  );

  return { activatePart, handlePartKey };
}
// ── /block-parts ──
