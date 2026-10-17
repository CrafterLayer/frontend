import { useCallback, useEffect, useRef, useState } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import {
  PART_OWNER_ATTRIBUTE,
  type InlineFormatAction,
  type InlineSelectionAnchorReport,
  type NodeId,
  type PartRef,
} from '@craftkit/builder-schema';

import { measureInlineDock, withDockFallback } from '../../overlay/inline-dock-anchor';
import { createInlineSession, type InlineSession } from '../../overlay/inline-session';
import type { CanvasInlineEditHandle } from './EditorCanvas.types';
import type { InlineEditEntryIntent, InlineEditEntryPoint } from './inline-edit-seam';
import { isInlineSelectionAnchorSource, measureTextSelection } from './text-selection-measure';
import { useForwardedPartEdit } from './use-forwarded-part-edit';
import type { CanvasRefs } from './use-canvas-refs';

export interface InlineSessionInputs {
  kernel: BuilderKernel;
  editable: boolean;
  frame: HTMLIFrameElement | null;
  onInlineEditHandle: ((handle: CanvasInlineEditHandle) => void) | undefined;
  refs: CanvasRefs;
  setTextActions: (actions: InlineFormatAction[]) => void;
}

/**
 * Inline editing (009 §3): VIEW state. The handle owns the lifecycle laws
 * (idempotent begin, end on selection change, end when the node vanishes);
 * React holds only the current value so the seam can render. Also the
 * gestures that open and close it: begin (pointer or keyboard, optionally at
 * a part), the keyboard exits, and the Enter/Escape inline keys.
 */
export function useInlineSession({
  kernel,
  editable,
  frame,
  onInlineEditHandle,
  refs,
  setTextActions,
}: InlineSessionInputs) {
  const { hostRef, machineryRef, elementsRef, sessionRef, surfaceEscapeHandledRef } = refs;
  const { returnFocusToEditorRef, textMeasureRef } = refs;
  const [inlineSession, setInlineSession] = useState<InlineSession | null>(null);
  const [inlineEntryPoint, setInlineEntryPoint] = useState<InlineEditEntryPoint | null>(null);
  const [inlineRejection, setInlineRejection] = useState<string | null>(null);
  const inlineEntryKeyRef = useRef(0);

  // Synced BEFORE the session effect below reads it: the handle callback must
  // not join that effect's dependencies, or every render of a host passing an
  // inline arrow would tear down and rebuild the author's open editing session.
  const onInlineEditHandleRef = useRef(onInlineEditHandle);
  useEffect(() => {
    onInlineEditHandleRef.current = onInlineEditHandle;
  });
  useEffect(() => {
    if (!editable) {
      return undefined;
    }
    const handle = createInlineSession(kernel);
    sessionRef.current = handle;
    const off = handle.subscribe(setInlineSession);
    onInlineEditHandleRef.current?.({
      isEditing: () => handle.current() !== null,
      end: () => {
        handle.end();
      },
    });
    return () => {
      off();
      handle.dispose();
      sessionRef.current = null;
      setInlineSession(null);
    };
  }, [kernel, editable, sessionRef]);

  const beginForwardedPartText = useForwardedPartEdit({ kernel, refs });

  // ── block-parts (2026-10-06) ── `part`: open that part's bound value instead of `inlineEditable`.
  const beginInlineEdit = useCallback(
    (nodeId: NodeId, entry: InlineEditEntryIntent, part?: PartRef): boolean => {
      // ── /block-parts ──
      const handle = sessionRef.current;
      if (handle === null) {
        return false;
      }
      const key = inlineEntryKeyRef.current + 1;
      const entryPoint: InlineEditEntryPoint =
        entry.kind === 'pointer'
          ? { key, kind: 'pointer', clientX: entry.clientX, clientY: entry.clientY }
          : { key, kind: 'keyboard' };
      inlineEntryKeyRef.current = entryPoint.key;
      setInlineEntryPoint(entryPoint);
      setInlineRejection(null);
      setTextActions([]);
      returnFocusToEditorRef.current = null;
      textMeasureRef.current = null;
      machineryRef.current?.anchors.setText(null);
      // ── block-parts (2026-10-06) ──
      // A part a parent draws for this node (a tab trigger, `data-ck-part-owner`)
      // is not rendered by this node, so the swap seam cannot reach it: it is
      // typed in place on the drawn element instead.
      const forwarded =
        part === undefined
          ? false
          : machineryRef.current?.index
              .partElement?.(nodeId, part)
              ?.hasAttribute(PART_OWNER_ATTRIBUTE) === true;
      if (forwarded && part !== undefined) {
        setInlineEntryPoint(null);
        return beginForwardedPartText(nodeId, part);
      }
      const opened = part === undefined ? handle.begin(nodeId) : handle.begin(nodeId, part);
      // ── /block-parts ──
      if (!opened) {
        setInlineEntryPoint(null);
      }
      return opened;
    },
    [
      beginForwardedPartText,
      setTextActions,
      returnFocusToEditorRef,
      textMeasureRef,
      machineryRef,
      sessionRef,
    ],
  );

  const reportTextAnchor = useCallback(
    (report: InlineSelectionAnchorReport | null) => {
      const session = sessionRef.current?.current() ?? null;
      const selectionMeasure =
        report === null || session === null
          ? null
          : isInlineSelectionAnchorSource(report)
            ? report.measure
            : () => {
                const frameDocument = frame?.contentDocument;
                const editedElement = elementsRef.current.get(session.nodeId);
                return frameDocument === null ||
                  frameDocument === undefined ||
                  editedElement === undefined
                  ? null
                  : measureTextSelection(frameDocument, editedElement);
              };
      // ── block-parts (2026-10-06) ──
      // A RICH session keeps its formatting bar beside the editor: over the
      // selection when there is one, docked at the editing surface otherwise.
      const measure =
        session?.kind !== 'rich'
          ? selectionMeasure
          : withDockFallback(selectionMeasure, () =>
              measureInlineDock(elementsRef.current.get(session.nodeId)),
            );
      // ── /block-parts ──
      textMeasureRef.current = measure;
      machineryRef.current?.anchors.setText(measure);
    },
    [frame, sessionRef, elementsRef, textMeasureRef, machineryRef],
  );

  /** Keyboard exits move focus before the focused editing chrome unmounts. */
  const endInlineEditFromKeyboard = useCallback(() => {
    returnFocusToEditorRef.current = null;
    hostRef.current?.focus({ preventScroll: true });
    sessionRef.current?.end();
  }, [returnFocusToEditorRef, hostRef, sessionRef]);

  const endInlineEditFromSurfaceKeyboard = useCallback(() => {
    // The surface's native listener runs before the frame document listener.
    // Mark that SAME Escape as consumed so it cannot fall through to canvas
    // traversal after `end()` synchronously clears the session handle.
    surfaceEscapeHandledRef.current = true;
    endInlineEditFromKeyboard();
    queueMicrotask(() => {
      // A contributed editor may stop propagation after calling onExit. Do not
      // let that leave a marker which could swallow a later, unrelated key.
      surfaceEscapeHandledRef.current = false;
    });
  }, [endInlineEditFromKeyboard, surfaceEscapeHandledRef]);

  /**
   * Inline gestures (009 §7 c2). Enter opens the selected node's declared
   * property for editing; Escape closes it and leaves the selection alone. Both
   * are claimed BEFORE traversal, so an open edit owns its keys — and both are
   * inert when nothing is declared, which keeps every other block unchanged.
   */
  const handleInlineKey = useCallback(
    (key: string): boolean => {
      const handle = sessionRef.current;
      if (handle === null) {
        return false;
      }
      if (key === 'Escape' && handle.current() !== null) {
        endInlineEditFromKeyboard();
        return true;
      }
      if (key === 'Enter' && handle.current() === null) {
        // Kernel truth, never a render closure: this listener lives on the frame
        // document and must act on the selection as it IS.
        const selected = kernel.context.store.getState().selection[0];
        return selected === undefined ? false : beginInlineEdit(selected, { kind: 'keyboard' });
      }
      return false;
    },
    [kernel, beginInlineEdit, endInlineEditFromKeyboard, sessionRef],
  );

  return {
    inlineSession,
    inlineEntryPoint,
    inlineRejection,
    setInlineRejection,
    beginInlineEdit,
    reportTextAnchor,
    endInlineEditFromSurfaceKeyboard,
    handleInlineKey,
  };
}
