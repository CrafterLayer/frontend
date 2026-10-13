import { useCallback, useMemo } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { BuilderDocument, NodeId, PartRef } from '@craftkit/builder-schema';

import { customCodeElementAt } from '../../custom-code/element-at';
import type { ElementNameWords } from '../../custom-code/element-target';
import { blockDisplayName } from '../../naming/block-display-name';
import { customCodeElementName } from '../../naming/custom-code-element-name';
import { performBlockAction, resolveBlockActions } from '../../overlay/block-actions';
import { partInstanceName } from '../../overlay/part-target';
import { nameWithin } from './canvas-targets';
import type { EditorCanvasLabels } from './EditorCanvas.labels';
import type { InlineEditEntryIntent } from './inline-edit-seam';
import type { CanvasRefs } from './use-canvas-refs';

type CanvasState = ReturnType<BuilderKernel['context']['store']['getState']>;

export interface BlockActionsInputs {
  kernel: BuilderKernel;
  doc: BuilderDocument;
  selectedId: NodeId | null;
  elementFocus: CanvasState['elementFocus'];
  partFocus: NonNullable<CanvasState['partFocus']> | null;
  canvasLabels: EditorCanvasLabels;
  elementNameWords: ElementNameWords;
  onAnimateBlock: ((nodeId: NodeId) => void) | undefined;
  beginInlineEdit: (nodeId: NodeId, entry: InlineEditEntryIntent, part?: PartRef) => boolean;
  refs: CanvasRefs;
}

/**
 * The selected block's name (announced, and the action bar's label), its
 * action bar (US3), and the bar's drag handle.
 */
export function useBlockActions({
  kernel,
  doc,
  selectedId,
  elementFocus,
  partFocus,
  canvasLabels,
  elementNameWords,
  onAnimateBlock,
  beginInlineEdit,
  refs,
}: BlockActionsInputs) {
  const { hostRef, machineryRef, canvasLabelsRef, announceGestureRef } = refs;
  const selectedName = useMemo(() => {
    const node = selectedId === null ? undefined : doc.nodes[selectedId];
    if (node === undefined) {
      return null;
    }
    // ── block-parts (2026-10-06) ──
    // A focused part is announced inside its block — "Heading in Hero",
    // «العنوان في البطل» — with the part's own label in the editor's language.
    if (partFocus !== null && partFocus.id === node.id) {
      return nameWithin(
        canvasLabels,
        partInstanceName(kernel, node.id, partFocus, canvasLabels.locale ?? 'en'),
        blockDisplayName(kernel, node.id, elementNameWords),
      );
    }
    // ── /block-parts ──
    // A focused element is announced as the thing it is, inside the region
    // it belongs to — "Image in CV header" — never as the region alone.
    const located =
      elementFocus?.id === node.id
        ? customCodeElementAt(kernel, node.id, elementFocus.path)
        : undefined;
    if (located !== undefined) {
      return nameWithin(
        canvasLabels,
        customCodeElementName(located.element, elementNameWords),
        blockDisplayName(kernel, node.id, elementNameWords),
      );
    }
    // The block's display name (its label, or the registry's name for the type) —
    // never its AI-facing description, which read ~1 KB aloud (fix pass).
    return blockDisplayName(kernel, node.id, elementNameWords);
  }, [kernel, doc, selectedId, elementFocus, canvasLabels, elementNameWords, partFocus]);

  const announcement = useMemo(
    // A selection id that no longer resolves to a live node is "no selection"
    // for announcement purposes — never read a raw internal id aloud.
    () =>
      selectedName === null ? canvasLabels.selectionCleared : canvasLabels.selected(selectedName),
    [selectedName, canvasLabels],
  );

  // gsap-pixi additions (2026-10-08): "Animate" joins the bar when the host can open Design › Motion.
  const animateLocale = canvasLabels.locale ?? 'en';
  const canAnimateBlock = onAnimateBlock !== undefined;
  const blockActions = useMemo(
    () =>
      selectedId === null || doc.nodes[selectedId] === undefined
        ? []
        : resolveBlockActions(
            kernel,
            selectedId,
            canAnimateBlock ? { animate: { locale: animateLocale } } : {},
          ),
    [kernel, doc, selectedId, canAnimateBlock, animateLocale],
  );
  // ── end gsap-pixi additions ──

  const runBlockAction = useCallback(
    (id: string) => {
      const selected = kernel.context.store.getState().selection[0];
      if (selected === undefined) {
        return;
      }
      // gsap-pixi additions (2026-10-08): a panel to open, never a document write.
      if (id === 'animate') {
        onAnimateBlock?.(selected);
        return;
      }
      // ── end gsap-pixi additions ──
      if (id === 'editText') {
        const opened = beginInlineEdit(selected, { kind: 'keyboard' });
        announceGestureRef.current(
          opened
            ? canvasLabelsRef.current.editing(selectedName ?? canvasLabelsRef.current.text)
            : canvasLabelsRef.current.editingUnavailable,
        );
        return;
      }
      if (id === 'deselect') {
        // Focus moves FIRST: the bar — and whichever button holds focus —
        // unmounts with the selection. The Selection live region announces
        // the clear itself, so the gesture region stays quiet: one message,
        // not the same one twice.
        hostRef.current?.focus({ preventScroll: true });
        performBlockAction(kernel, selected, id);
        return;
      }
      // ONE dispatch, and the resulting selection is the action's own decision
      // (US3/AC2). Refusals are announced, never thrown at the door.
      announceGestureRef.current(performBlockAction(kernel, selected, id).announcement);
    },
    // gsap-pixi additions: + onAnimateBlock
    [
      kernel,
      beginInlineEdit,
      selectedName,
      onAnimateBlock,
      hostRef,
      canvasLabelsRef,
      announceGestureRef,
    ],
  );

  const beginMoveFromHandle = useCallback(
    (hostX: number, hostY: number) => {
      const selected = kernel.context.store.getState().selection[0];
      if (selected !== undefined) {
        machineryRef.current?.beginMoveFromHandle(selected, hostX, hostY);
      }
    },
    [kernel, machineryRef],
  );

  return { selectedName, announcement, blockActions, runBlockAction, beginMoveFromHandle };
}
