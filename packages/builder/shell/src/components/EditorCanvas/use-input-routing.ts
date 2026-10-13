import {
  useCallback,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId, PartRef } from '@craftkit/builder-schema';

import type { ElementTarget } from '../../custom-code/element-target';
import { partDeclOf } from '../../overlay/part-target';
import { isEditableTarget } from './canvas-targets';
import { unlockedPath } from './element-canvas-helpers';
import type { InlineEditEntryIntent } from './inline-edit-seam';
import type { CanvasKey } from './use-canvas-keys';
import type { CanvasRefs } from './use-canvas-refs';

/** The canvas's key handlers, in the order they claim a key; true = consumed. */
export interface CanvasKeyHandlers {
  handleElementKey: (event: CanvasKey) => boolean;
  handlePartKey: (event: CanvasKey) => boolean;
  handleInlineKey: (key: string) => boolean;
  handleTraversalKey: (key: string, altKey?: boolean) => boolean;
}

export interface FrameInputInputs extends CanvasKeyHandlers {
  kernel: BuilderKernel;
  frame: HTMLIFrameElement | null;
  beginInlineEdit: (nodeId: NodeId, entry: InlineEditEntryIntent, part?: PartRef) => boolean;
  beginTreeTextEditing: (target: Extract<ElementTarget, { kind: 'tree' }>) => boolean;
  activatePart: (nodeId: NodeId, ref: PartRef, entry: InlineEditEntryIntent) => boolean;
  refs: CanvasRefs;
}

/**
 * Belt and braces: if focus reaches the frame by any route (a tab into the
 * iframe, a programmatic focus), traversal still works there. Keydown does not
 * cross document boundaries, so this can never double-handle with the host's
 * own handler. Its own effect, so the machinery effect stays [frame, kernel].
 * Double-clicks open what was hit: a tree text element, a part, or the
 * block's declared inline edit.
 */
export function useFrameInput({
  kernel,
  frame,
  handleElementKey,
  handlePartKey,
  handleInlineKey,
  handleTraversalKey,
  beginInlineEdit,
  beginTreeTextEditing,
  activatePart,
  refs,
}: FrameInputInputs): void {
  const { hostRef, machineryRef, sessionRef, surfaceEscapeHandledRef, onShortcutRef } = refs;
  useEffect(() => {
    const frameDocument = frame?.contentDocument ?? null;
    /* v8 ignore next 3 -- same-origin frames always expose a document. */
    if (frameDocument === null) {
      return;
    }
    const onFrameKeyDown = (event: KeyboardEvent) => {
      const dragSession = machineryRef.current?.session ?? null;
      if (event.key === 'Escape' && dragSession !== null && dragSession.phase() !== 'idle') {
        handleTraversalKey('Escape');
        event.preventDefault();
        return;
      }
      if (event.key === 'Escape' && surfaceEscapeHandledRef.current) {
        event.preventDefault();
        return;
      }
      // The focused surface calls `onExit` before this document-level listener
      // sees the same Escape. Focus on the host plus an already-ended session
      // means that keyboard exit was handled; never reinterpret it as canvas
      // traversal and clear the block selection.
      const host = hostRef.current;
      if (
        event.key === 'Escape' &&
        sessionRef.current?.current() === null &&
        host !== null &&
        host.ownerDocument.activeElement === host
      ) {
        event.preventDefault();
        return;
      }
      if (handleElementKey(event)) {
        event.preventDefault();
        return;
      }
      // ── block-parts (2026-10-06) ──
      if (handlePartKey(event)) {
        event.preventDefault();
        return;
      }
      // ── /block-parts ──
      if (handleInlineKey(event.key)) {
        event.preventDefault();
        return;
      }
      if (handleTraversalKey(event.key, event.altKey)) {
        event.preventDefault();
        return;
      }
      // P7: focus inside the iframe never reaches host-document shortcut
      // listeners, so what the canvas did not claim is forwarded — never
      // from inside an editable field, where keys are the field's own.
      if (!isEditableTarget(event.target) && onShortcutRef.current?.(event) === true) {
        event.preventDefault();
      }
    };
    const onFrameDoubleClick = (event: MouseEvent) => {
      const handle = sessionRef.current;
      const machinery = machineryRef.current;
      if (handle === null || machinery === null) {
        return;
      }
      // P7: a double-click on a tree text element edits it in place.
      const elementHit = machinery.index.hitAt?.(event.clientX, event.clientY);
      const elementPath =
        elementHit?.elementPath === undefined
          ? undefined
          : unlockedPath(kernel, elementHit.nodeId, elementHit.elementPath);
      if (elementHit !== undefined && elementPath !== undefined) {
        const target = { kind: 'tree' as const, nodeId: elementHit.nodeId, path: elementPath };
        kernel.focusElement(target.nodeId, target.path);
        if (beginTreeTextEditing(target)) {
          event.preventDefault();
        }
        // An element that is not plain text stays focused: the region's own
        // inline edit would be the wrong surface for what was double-clicked.
        return;
      }
      // ── block-parts (2026-10-06) ──
      // A part of a registered block: its own text opens in place (or its
      // image opens the asset picker). A list, item or box part falls through
      // to the block's declared inline edit, as before.
      const partHit = elementHit?.elementPath === undefined ? elementHit?.part : undefined;
      if (elementHit !== undefined && partHit !== undefined) {
        const ref = { part: partHit.part, index: partHit.index };
        const kind = partDeclOf(kernel, elementHit.nodeId, ref.part)?.kind;
        if (kind === 'text' || kind === 'rich' || kind === 'link' || kind === 'image') {
          if (
            activatePart(elementHit.nodeId, ref, {
              kind: 'pointer',
              clientX: event.clientX,
              clientY: event.clientY,
            })
          ) {
            event.preventDefault();
          }
          return;
        }
      }
      // ── /block-parts ──
      const hit = machinery.index.nodeAt(event.clientX, event.clientY);
      if (
        hit !== undefined &&
        beginInlineEdit(hit, {
          kind: 'pointer',
          clientX: event.clientX,
          clientY: event.clientY,
        })
      ) {
        // A block that declares nothing inline-editable is INERT (US1/AC6):
        // begin() returned false and the double-click stays a plain click.
        event.preventDefault();
      }
    };
    frameDocument.addEventListener('keydown', onFrameKeyDown);
    frameDocument.addEventListener('dblclick', onFrameDoubleClick);
    return () => {
      frameDocument.removeEventListener('keydown', onFrameKeyDown);
      frameDocument.removeEventListener('dblclick', onFrameDoubleClick);
    };
  }, [
    frame,
    kernel,
    handleTraversalKey,
    handleInlineKey,
    handleElementKey,
    beginInlineEdit,
    beginTreeTextEditing,
    // ── block-parts (2026-10-06) ──
    handlePartKey,
    activatePart,
    // ── /block-parts ──
    hostRef,
    machineryRef,
    sessionRef,
    surfaceEscapeHandledRef,
    onShortcutRef,
  ]);
}

export interface HostInputInputs extends CanvasKeyHandlers {
  kernel: BuilderKernel;
  refs: CanvasRefs;
}

/** The focusable canvas host's own key and click handlers. */
export function useHostInput({
  kernel,
  handleElementKey,
  handlePartKey,
  handleInlineKey,
  handleTraversalKey,
  refs,
}: HostInputInputs) {
  const { hostRef, frameShellRef, surfaceEscapeHandledRef } = refs;
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      /*
        The canvas answers only for ITSELF. This handler sits on the focusable
        canvas host, and the editor's floating chrome — the block action bar,
        the text bubble — renders inside it, so their key events bubble here
        too. `handleInlineKey` claims Enter (it begins an inline edit) and calls
        `preventDefault`, which cancelled the native activation of every button
        in that chrome: measured, focusing Delete and pressing Enter left the
        document unchanged and threw focus into the iframe, while Space on the
        same button deleted correctly. A button that answers Space and not Enter
        is broken for keyboard users, and the cause was never the button.
      */
      if (event.target !== event.currentTarget) {
        /*
          ONE exception: Escape. The floating chrome lives inside this host, so
          "Escape while the action bar has focus" arrives here with a child
          target — and a person pressing it means "let go of this block", the
          same as from the host itself. Two things still outrank the canvas: an
          editable element (an input, a textarea, a contenteditable region)
          owns its own Escape, and a nearer handler that already claimed the
          key — the text bubble does, to return focus to its editor — has said
          so through `defaultPrevented`. Every other key keeps the guard above.
        */
        if (event.key !== 'Escape' || event.defaultPrevented || isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        if (surfaceEscapeHandledRef.current) {
          return;
        }
        // Focus moves FIRST: the chrome holding it unmounts with the selection,
        // and a keyboard user must land on the canvas, not the document body.
        hostRef.current?.focus({ preventScroll: true });
        if (!handleInlineKey('Escape')) {
          handleTraversalKey('Escape');
        }
        return;
      }
      if (event.key === 'Escape' && surfaceEscapeHandledRef.current) {
        event.preventDefault();
        return;
      }
      if (handleElementKey(event)) {
        event.preventDefault();
        return;
      }
      // ── block-parts (2026-10-06) ──
      if (handlePartKey(event)) {
        event.preventDefault();
        return;
      }
      // ── /block-parts ──
      if (handleInlineKey(event.key)) {
        event.preventDefault();
        return;
      }
      if (handleTraversalKey(event.key, event.altKey)) {
        event.preventDefault();
      }
    },
    // ── block-parts (2026-10-06) ── + handlePartKey
    [
      handleTraversalKey,
      handleInlineKey,
      handleElementKey,
      handlePartKey,
      hostRef,
      surfaceEscapeHandledRef,
    ],
  );

  const onHostClick = useCallback(
    (event: ReactMouseEvent) => {
      /*
        The gutter is the pointer's way out. Clicking the page background
        INSIDE the frame selects the root on purpose — page-level props live in
        the inspector — so the empty space AROUND the frame is the one place a
        click can mean "nothing". Only the host's own surface and the frame
        shell count: a click that merely bubbles through from the overlay or
        the floating chrome is not a gutter click (the chrome stops its own
        propagation, and the strict target test holds even where it does not).
        Clicks inside the iframe never reach this document at all — they take
        the frame listener's path, which selects what was hit.
      */
      if (event.target !== event.currentTarget && event.target !== frameShellRef.current) {
        return;
      }
      kernel.clearSelection(); // the Selection live region announces the clear
    },
    [kernel, frameShellRef],
  );

  return { onKeyDown, onHostClick };
}
