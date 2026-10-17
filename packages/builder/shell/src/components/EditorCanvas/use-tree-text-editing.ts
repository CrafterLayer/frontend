import { useCallback, useEffect, useMemo, useState } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';

import { customCodeElementAt } from '../../custom-code/element-at';
import type { ElementTarget } from '../../custom-code/element-target';
import { customCodeElementName } from '../../naming/custom-code-element-name';
import { treeTextBubbleActions, type TreeTextActionLabels } from '../../overlay/tree-text-actions';
import {
  beginTreeTextEdit,
  isTreeTextEditable,
  type TreeTextSession,
} from '../../overlay/tree-text-session';
import { elementDomOf } from './element-canvas-helpers';
import { measureTextSelection } from './text-selection-measure';
import type { CanvasRefs } from './use-canvas-refs';

export interface TreeTextEditingInputs {
  kernel: BuilderKernel;
  editable: boolean;
  treeTextLabels: TreeTextActionLabels;
  /** Announces a refused mark in the canvas's gesture region. */
  announceGesture: (message: string) => void;
  refs: CanvasRefs;
}

/** A link address being asked for over a selected range of tree text. */
export interface TreeLinkRange {
  start: number;
  end: number;
}

/**
 * P7 in-place typing on a tree text element (DESIGN §E): the open session,
 * whether it holds a selected range (the formatting bubble shows only then),
 * the link-address prompt's range, and the bubble's actions.
 */
export function useTreeTextEditing({
  kernel,
  editable,
  treeTextLabels,
  announceGesture,
  refs,
}: TreeTextEditingInputs) {
  const {
    treeSessionRef,
    sessionRef,
    machineryRef,
    layerRef,
    hostRef,
    wordsRef,
    canvasLabelsRef,
    announceGestureRef,
  } = refs;
  const [treeSession, setTreeSession] = useState<TreeTextSession | null>(null);
  const [treeHasRange, setTreeHasRange] = useState(false);
  const [linkRange, setLinkRange] = useState<TreeLinkRange | null>(null);

  /**
   * P7: open a tree text element for in-place typing (DESIGN §E). False when
   * the element holds no plain text of its own (a container, an image, a
   * paragraph already split into runs) or the canvas is read-only.
   */
  const beginTreeTextEditing = useCallback(
    (target: Extract<ElementTarget, { kind: 'tree' }>): boolean => {
      const machinery = machineryRef.current;
      if (!editable || machinery === null) {
        return false;
      }
      const located = customCodeElementAt(kernel, target.nodeId, target.path);
      if (located === undefined || !isTreeTextEditable(located.element)) {
        return false;
      }
      const element = elementDomOf(machinery.index, target.nodeId, target.path);
      if (element === null) {
        return false;
      }
      treeSessionRef.current?.commit();
      // One editing surface at a time: a block's open inline session ends.
      sessionRef.current?.end();
      const frameDocument = element.ownerDocument;
      const name = customCodeElementName(located.element, wordsRef.current);
      const stored = located.element.kind === 'element' ? (located.element.text ?? '') : '';
      const opened: TreeTextSession = beginTreeTextEdit({
        kernel,
        element,
        target,
        storedText: stored,
        name,
        onEnd: (outcome, exit, message) => {
          if (treeSessionRef.current === opened) {
            treeSessionRef.current = null;
          }
          setTreeSession((current) => (current === opened ? null : current));
          setTreeHasRange(false);
          setLinkRange(null);
          machineryRef.current?.anchors.setText(null);
          layerRef.current?.classList.remove('bldr-overlay--tree-editing');
          machineryRef.current?.anchors.refresh();
          if (outcome === 'rejected' && message !== undefined) {
            announceGestureRef.current(message);
          }
          if (exit === 'keyboard') {
            // Keyboard exits keep the keyboard on the canvas, on the element.
            hostRef.current?.focus({ preventScroll: true });
          }
        },
        onSelectionChange: () => {
          const has = opened.isOpen() && opened.selectionRange() !== null;
          setTreeHasRange(has);
          machineryRef.current?.anchors.setText(
            has ? () => measureTextSelection(frameDocument, element) : null,
          );
        },
      });
      treeSessionRef.current = opened;
      setTreeSession(opened);
      layerRef.current?.classList.add('bldr-overlay--tree-editing');
      machineryRef.current?.anchors.refresh();
      announceGestureRef.current(canvasLabelsRef.current.editing(name));
      return true;
    },
    [
      kernel,
      editable,
      treeSessionRef,
      sessionRef,
      machineryRef,
      layerRef,
      hostRef,
      wordsRef,
      canvasLabelsRef,
      announceGestureRef,
    ],
  );

  const treeActions = useMemo(
    () =>
      treeSession === null
        ? []
        : treeTextBubbleActions(treeSession, treeTextLabels, {
            onRequestLink: (range) => {
              treeSession.suspendBlur(true);
              setLinkRange(range);
            },
            onResult: (result) => {
              if (!result.ok) {
                announceGesture(result.message);
              }
            },
          }),
    [treeSession, treeTextLabels, announceGesture],
  );

  return {
    treeSession,
    treeHasRange,
    linkRange,
    setLinkRange,
    beginTreeTextEditing,
    treeActions,
  };
}

/**
 * An in-place text edit ends (and commits) when the focus moves elsewhere —
 * a click on another element, Escape out of the region, an undo.
 */
export function useCommitTreeEditOnFocusMove(kernel: BuilderKernel, refs: CanvasRefs): void {
  const { treeSessionRef } = refs;
  useEffect(
    () =>
      kernel.context.store.subscribe((state) => {
        const editing = treeSessionRef.current;
        if (editing === null) {
          return;
        }
        const focus = state.elementFocus;
        const same =
          focus !== null &&
          focus.id === editing.target.nodeId &&
          focus.path.length === editing.target.path.length &&
          focus.path.every((value, at) => editing.target.path[at] === value);
        if (!same) {
          // Never write from inside a store notification.
          queueMicrotask(() => {
            editing.commit();
          });
        }
      }),
    [kernel, treeSessionRef],
  );
}
