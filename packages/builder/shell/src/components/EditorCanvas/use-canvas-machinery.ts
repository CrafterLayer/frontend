import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

// First: the element chrome carries the overlay stylesheet (see EditorCanvas.tsx).
import { createElementChrome, createFloatingHosts, partAnchorIndex } from './canvas-chrome';
import { createAnchorChannel } from '../../overlay/anchor-channel';
import { createDragSession } from '../../overlay/drag-session';
import type { FloatingHostPorts } from '../../overlay/floating-host';
import { createFrameBridge } from '../../overlay/frame-bridge';
import { createOverlayController } from '../../overlay/overlay-controller';
import { partChipLabel } from '../../overlay/part-target';
import { createToolHost } from '../../overlay/tool-host';
import type { TreeDropPorts } from '../../overlay/tree-drop-resolver';
import { createRectIndex, systemGeometryPorts, type GeometryPorts } from '../../rects';
import { anchorPathOf } from './canvas-targets';
import type { FloatingMounts } from './EditorCanvas.types';
import { attachFramePointerGestures } from './frame-pointer-gestures';
import { attachHostDragNet } from './host-drag-net';
import type { CanvasRefs } from './use-canvas-refs';

export interface CanvasMachineryInputs {
  kernel: BuilderKernel;
  frame: HTMLIFrameElement | null;
  editable: boolean;
  /** Test/instrumentation inputs, read once per frame mount. */
  geometryPorts: Partial<GeometryPorts> | undefined;
  floatingPorts: Partial<FloatingHostPorts> | undefined;
  onToolError: ((toolId: string, error: unknown) => void) | undefined;
  treeDropPorts: Partial<TreeDropPorts> | undefined;
  refs: CanvasRefs;
  setFloating: Dispatch<SetStateAction<FloatingMounts | null>>;
  setDragState: Dispatch<SetStateAction<{ active: boolean; revision: number }>>;
  setScrubbing: Dispatch<SetStateAction<boolean>>;
}

/**
 * The read-only canvas (005 contract §3): B1 preview + observer-driven geometry
 * + hover/selection chrome + keyboard traversal + canvas-tool contributions.
 * React renders the scaffold once; every per-event path (pointer, outline
 * positioning, tool mounting) runs in this plain-TS machinery with direct DOM
 * writes batched to the frame rhythm — zero document-content re-renders by
 * construction (FR-006). Built once per frame mount ([frame, kernel]).
 */
export function useCanvasMachinery({
  kernel,
  frame,
  editable,
  geometryPorts,
  floatingPorts,
  onToolError,
  treeDropPorts,
  refs,
  setFloating,
  setDragState,
  setScrubbing,
}: CanvasMachineryInputs): void {
  const {
    hostRef,
    layerRef,
    machineryRef,
    elementsRef,
    wordsRef,
    canvasLabelsRef,
    zoomRef,
    dirRef,
    bucketRef,
    styleStateRef,
    activeSectorRef,
    selectionStoreRef,
    treeSessionRef,
    textMeasureRef,
    announceGestureRef,
    suppressClickRef,
    onDragHandleRef,
  } = refs;
  useEffect(() => {
    const layer = layerRef.current;
    if (frame === null || layer === null) {
      return;
    }
    const frameDocument = frame.contentDocument;
    /* v8 ignore next 3 -- same-origin frames always expose a document (see CanvasFrame). */
    if (frameDocument === null) {
      return;
    }

    const ports = { ...systemGeometryPorts(), ...geometryPorts };
    const index = createRectIndex({ frame, ports });
    for (const [id, element] of elementsRef.current) {
      index.attach(id, element);
    }
    const controller = createOverlayController({
      kernel,
      index,
      layer,
      schedule: ports.schedule,
      words: () => wordsRef.current,
      // ── block-parts (2026-10-06) ──
      partLabel: (id, ref) =>
        partChipLabel(kernel, id, ref, canvasLabelsRef.current.locale ?? 'en', wordsRef.current),
      // ── /block-parts ──
    });
    const tools = createToolHost({ kernel, index, layer, onToolError });
    tools.start();

    // Floating chrome (009 §10). The bridge is the ONE place frame and host
    // space meet; the channel rides the rect index's existing invalidation, so
    // toolbars follow the content without anything polling.
    const bridge = createFrameBridge(frame, { scale: () => zoomRef.current });
    const { textHost, blockHost, elementHost } = createFloatingHosts(layer, floatingPorts);

    const chrome = createElementChrome({
      layer,
      kernel,
      index,
      editable,
      bucketRef,
      styleStateRef,
      activeSectorRef,
      dirRef,
      zoomRef,
      treeSessionRef,
      machineryRef,
      announceGestureRef,
      onScrubChange: setScrubbing,
    });
    const { handles, grid, forced, positionGuides } = chrome;
    const syncElementChrome = chrome.sync;

    const anchors = createAnchorChannel({
      index: partAnchorIndex(kernel, index),
      bridge,
      schedule: ports.schedule,
      onSnapshot: (snapshot) => {
        const common = {
          frame: snapshot.frame,
          viewport: snapshot.viewport,
          visible: snapshot.visible,
          scale: snapshot.scale,
          dir: dirRef.current,
        };
        blockHost.place({ anchor: snapshot.block, ...common });
        elementHost.place({ anchor: snapshot.block, ...common });
        textHost.place({ anchor: snapshot.text, ...common });
        syncElementChrome();
      },
    });
    anchors.setText(textMeasureRef.current);
    // ONE setState for the whole mount: React needs the portal targets, and
    // after this it never hears about geometry again.
    setFloating({ text: textHost.element, block: blockHost.element, element: elementHost.element });

    // B2b: the drag session exists only on editable canvases (FR-012).
    const session = editable
      ? createDragSession({
          kernel,
          index,
          layer,
          schedule: ports.schedule,
          viewport: () => ports.viewport(frame),
          announce: (message) => {
            announceGestureRef.current(message);
          },
          frameDocument,
          dir: () => dirRef.current,
          treePorts: treeDropPorts,
          onHoverSuppress: (active) => {
            if (active) {
              controller.setHover(null);
            }
            // A gesture BOUNDARY, never a pointer move: the action bar is not
            // mounted while a drag is in flight (US3/AC4), and comes back on
            // release without a second gesture.
            setDragState((current) => ({ active, revision: current.revision + 1 }));
          },
        })
      : null;

    const offSelection = kernel.context.store.subscribe(() => {
      // Selection AND hover are re-notified on every document change: the tool
      // host drops a target whose node no longer exists, so an undo that removes
      // the targeted node cannot leave orphaned tool chrome behind (FR-007) —
      // hover included, even though no pointer moved.
      const state = kernel.context.store.getState();
      const selected = state.selection[0] ?? null;
      tools.notifySelection(selected);
      tools.notifyHover(controller.hoveredId());
      // Same law for the action bar: its anchor follows the selection, and a
      // node that vanished has no rect, so the bar hides instead of stranding.
      // With an element focused the anchor is the ELEMENT (P7 quick bar).
      // ── block-parts (2026-10-06) ── …and with a part focused, the PART.
      anchors.setBlock(selected, anchorPathOf(state, selected));
      // ── /block-parts ──
      // An edit can move an element without resizing any observed block;
      // one batched flush re-reads the element chrome either way.
      anchors.refresh();
    });
    {
      const state = kernel.context.store.getState();
      const selected = state.selection[0] ?? null;
      // ── block-parts (2026-10-06) ──
      anchors.setBlock(selected, anchorPathOf(state, selected));
      // ── /block-parts ──
    }

    const pointer = attachFramePointerGestures({
      kernel,
      index,
      ports,
      controller,
      tools,
      session,
      frameDocument,
      positionGuides,
      editable,
      treeSessionRef,
      bucketRef,
      styleStateRef,
      dirRef,
      suppressClickRef,
      announceGestureRef,
      selectionStoreRef,
      hostRef,
    });

    const toFrame = bridge.toFrame;
    const detachHostNet =
      session === null ? null : attachHostDragNet({ session, frame, toFrame, onDragHandleRef });

    machineryRef.current = {
      index,
      controller,
      tools,
      session,
      beginMoveFromHandle: (nodeId, hostX, hostY) => {
        if (
          session === null ||
          nodeId === kernel.getDocument().rootId ||
          kernel.context.store.getState().selection[0] !== nodeId
        ) {
          return;
        }
        const start = toFrame(hostX, hostY);
        session.press({ kind: 'move', id: nodeId }, start.x, start.y, 'handle');
      },
      beginTreeMove: (payload, hostX, hostY) => {
        if (session === null) {
          return;
        }
        const start = toFrame(hostX, hostY);
        session.press(payload, start.x, start.y, 'handle');
      },
      anchors,
      handles,
      grid,
      forced,
      syncElementChrome,
      detachListeners: () => {
        pointer.detach();
        detachHostNet?.();
      },
    };
    return () => {
      machineryRef.current?.detachListeners();
      session?.dispose();
      tools.dispose();
      controller.dispose();
      anchors.dispose();
      pointer.endPositionDrag(false);
      handles?.dispose();
      grid.dispose();
      forced.clear();
      positionGuides.dispose();
      textHost.dispose();
      blockHost.dispose();
      elementHost.dispose();
      index.dispose();
      offSelection();
      machineryRef.current = null;
      setFloating(null);
      setDragState((current) => ({ active: false, revision: current.revision + 1 }));
    };
    // geometryPorts/onToolError are test/instrumentation inputs, stable per mount;
    // every ref and setter is stable by construction. Built once per frame mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, kernel]);
}

/**
 * The renderer hands every block wrapper here as it mounts. Wrappers can mount
 * before the frame-ready effect builds the index; the buffer keeps them and
 * the machinery replays it (first-frame safety).
 */
export function useAttachNodeElement(
  refs: CanvasRefs,
): (id: NodeId, element: HTMLElement | null) => void {
  const { elementsRef, machineryRef } = refs;
  return useCallback(
    (id: NodeId, element: HTMLElement | null) => {
      if (element === null) {
        elementsRef.current.delete(id);
        machineryRef.current?.index.detach(id);
      } else {
        elementsRef.current.set(id, element);
        machineryRef.current?.index.attach(id, element);
      }
    },
    [elementsRef, machineryRef],
  );
}
