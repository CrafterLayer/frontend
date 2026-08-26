import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import {
  CanvasFrame,
  DocumentView,
  useKernelSelector,
  type RenderBreakpoint,
  type Theme,
} from '@craftkit/builder-renderer';
import type { NodeId } from '@craftkit/builder-schema';

import { performMoveAction, resolveMoveAction } from '../../keyboard/move-actions';
import { resolveTraversalAction, traverse, type SlotOrderLookup } from '../../keyboard/traversal';
import { createDragSession, type DragSession } from '../../overlay/drag-session';
import { createFrameBridge } from '../../overlay/frame-bridge';
import { createInlineSession, type InlineSession } from '../../overlay/inline-session';
import { InlineTextSurface } from '../InlineTextSurface';
import { createOverlayController, type OverlayController } from '../../overlay/overlay-controller';
import { createToolHost, type ToolHost } from '../../overlay/tool-host';
import {
  createRectIndex,
  systemGeometryPorts,
  type GeometryPorts,
  type RectIndex,
} from '../../rects';
import '../../styles/visually-hidden.css';
import './EditorCanvas.css';

export interface EditorCanvasProps {
  /** BY PROP — the shell hot path never reads React context. */
  kernel: BuilderKernel;
  theme: Theme;
  /** Accessible name of the editing region. */
  title?: string;
  /** Canvas-tool failures are contained here (default: console.error). */
  onToolError?: ((toolId: string, error: unknown) => void) | undefined;
  /** Test-only geometry injection (jsdom has no layout). */
  geometryPorts?: Partial<GeometryPorts> | undefined;
  /** Test/dev instrumentation forwarded to the live renderer (SC-001 counting). */
  onBlockRender?: ((nodeId: NodeId) => void) | undefined;
  /**
   * B2b (006 contract §6): enables drag editing + Alt-arrow moves. Absent or
   * false ⇒ B2a behavior byte-compatible (FR-012).
   */
  editable?: boolean | undefined;
  /** Receives the canvas drag handle so external panels (palette) can start inserts. */
  onDragHandle?: ((handle: CanvasDragHandle) => void) | undefined;
  /**
   * B3a (007 contract §6): preview frame width in px (device emulation);
   * absent ⇒ full width. Layout-only — the frame shell narrows and centers,
   * and the overlay layer shares its origin, so no hot path changes.
   */
  frameWidth?: number | undefined;
  /**
   * B3a (007 review C1): the breakpoint the CONTENT renders at — the device
   * width must drive one authority end-to-end, so the composition derives this
   * from the same bucket the inspector edits ('base' ⇒ 'desktop'). Absent ⇒
   * desktop, byte-compatible with 005/006.
   */
  breakpoint?: RenderBreakpoint | undefined;
}

/** External insert entry point (006 contract §6): host coordinates, bridged internally. */
export interface CanvasDragHandle {
  /**
   * Returns a probe for THIS gesture: `didActivate()` is true once the press
   * crossed the drag threshold — the palette uses it to suppress its own
   * click-insert after a real (even cancelled) drag, keeping "an aborted drag
   * inserts nothing" true on the palette side too (§9 convergence fix).
   */
  beginInsert(type: string, hostX: number, hostY: number): { didActivate: () => boolean };
}

interface Machinery {
  index: RectIndex;
  controller: OverlayController;
  tools: ToolHost;
  session: DragSession | null;
  detachListeners: () => void;
}

/**
 * The read-only canvas (005 contract §3): B1 preview + observer-driven geometry
 * + hover/selection chrome + keyboard traversal + canvas-tool contributions.
 * React renders this scaffold once; every per-event path (pointer, outline
 * positioning, tool mounting) runs in the plain-TS machinery with direct DOM
 * writes batched to the frame rhythm — zero document-content re-renders by
 * construction (FR-006).
 */
export function EditorCanvas({
  kernel,
  theme,
  title = 'Editor canvas',
  onToolError,
  geometryPorts,
  onBlockRender,
  editable = false,
  onDragHandle,
  frameWidth,
  breakpoint,
}: EditorCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const machineryRef = useRef<Machinery | null>(null);
  // Wrappers can mount before the frame-ready effect builds the index; the
  // buffer preserves them and the effect replays it (first-frame safety).
  const elementsRef = useRef(new Map<NodeId, HTMLElement>());

  const dir = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>) => state.doc.dir,
      [],
    ),
  );
  const selectedId = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>) =>
        state.selection[0] ?? null,
      [],
    ),
  );

  // Gesture outcomes reach their own polite channel (setState happens only at
  // session ENDS — commit/cancel — never per pointer move, so the zero-render
  // law is untouched mid-drag). {text, nonce}: a REPEATED outcome ("Already
  // last" twice) must still mutate the live region's text node or AT hears
  // nothing the second time — a zero-width space toggles on odd nonces.
  // Inline editing (009 §3): VIEW state. The handle owns the lifecycle laws
  // (idempotent begin, end on selection change, end when the node vanishes);
  // React holds only the current value so the seam can render.
  const [inlineSession, setInlineSession] = useState<InlineSession | null>(null);
  const sessionRef = useRef<ReturnType<typeof createInlineSession> | null>(null);
  useEffect(() => {
    if (!editable) {
      return undefined;
    }
    const handle = createInlineSession(kernel);
    sessionRef.current = handle;
    const off = handle.subscribe(setInlineSession);
    return () => {
      off();
      handle.dispose();
      sessionRef.current = null;
      setInlineSession(null);
    };
  }, [kernel, editable]);

  const [gestureMessage, setGestureMessage] = useState({ text: '', nonce: 0 });
  const announceGestureRef = useRef((message: string) => {
    setGestureMessage((current) => ({ text: message, nonce: current.nonce + 1 }));
  });
  const suppressClickRef = useRef(false);
  const onDragHandleRef = useRef(onDragHandle);
  useEffect(() => {
    onDragHandleRef.current = onDragHandle;
  });

  const attachNodeElement = useCallback((id: NodeId, element: HTMLElement | null) => {
    if (element === null) {
      elementsRef.current.delete(id);
      machineryRef.current?.index.detach(id);
    } else {
      elementsRef.current.set(id, element);
      machineryRef.current?.index.attach(id, element);
    }
  }, []);

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
    });
    const tools = createToolHost({ kernel, index, layer, onToolError });
    tools.start();

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
          onHoverSuppress: (active) => {
            if (active) {
              controller.setHover(null);
            }
          },
        })
      : null;

    const offSelection = kernel.context.store.subscribe(() => {
      // Selection AND hover are re-notified on every document change: the tool
      // host drops a target whose node no longer exists, so an undo that removes
      // the targeted node cannot leave orphaned tool chrome behind (FR-007) —
      // hover included, even though no pointer moved.
      tools.notifySelection(kernel.context.store.getState().selection[0] ?? null);
      tools.notifyHover(controller.hoveredId());
    });

    const onPointerDown = (event: MouseEvent) => {
      const id = index.nodeAt(event.clientX, event.clientY);
      if (session !== null && id !== undefined && id !== kernel.getDocument().rootId) {
        session.press({ kind: 'move', id }, event.clientX, event.clientY);
      }
    };
    const onPointerMove = (event: MouseEvent) => {
      if (session !== null && session.phase() !== 'idle') {
        session.move(event.clientX, event.clientY);
        return; // hover chrome is suppressed for the session's duration
      }
      const id = index.nodeAt(event.clientX, event.clientY) ?? null;
      controller.setHover(id);
      tools.notifyHover(id);
    };
    const onPointerUp = () => {
      if (session !== null && session.phase() === 'active') {
        // The suppress flag exists for gestures that CAN be followed by a
        // same-document click: a frame pointerup concluding a frame-originated
        // MOVE drag. An insert drag began in the HOST document, so no frame
        // click ever follows — setting the flag there would go stale and
        // swallow the next legitimate canvas click (§9 convergence fix).
        if (session.payloadKind() === 'move') {
          suppressClickRef.current = true;
        }
        session.release();
      } else if (session !== null) {
        session.release(); // pending → plain click path
      }
    };
    const onPointerLeave = () => {
      controller.setHover(null);
      tools.notifyHover(null);
    };
    const onClick = (event: MouseEvent) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return; // a completed drop already set the selection
      }
      const id = index.nodeAt(event.clientX, event.clientY);
      kernel.setSelection(id === undefined ? [] : [id]);
      // Clicking inside the frame moves focus to the iframe's browsing context,
      // which would silently strand keyboard traversal on the host region
      // ("click to select, then arrow keys" is the documented flow). Pull focus
      // back deliberately — nothing inside the canvas wants it.
      hostRef.current?.focus({ preventScroll: true });
    };
    frameDocument.addEventListener('pointerdown', onPointerDown);
    frameDocument.addEventListener('pointermove', onPointerMove, { passive: true });
    frameDocument.addEventListener('pointerup', onPointerUp);
    frameDocument.addEventListener('pointerleave', onPointerLeave);
    frameDocument.addEventListener('click', onClick);

    // Host-side safety net (PERMANENT listeners, removed by this effect's own
    // cleanup — no per-gesture attachment can leak). Cross-document routing is
    // the whole story here: once the pointer leaves the iframe, the FRAME
    // document stops receiving the gesture and the HOST receives it instead —
    // without this net a drag that leaves the canvas would stay `active`
    // forever and hijack the next unrelated gesture. Coordinates are bridged in
    // toFrame — the ONE place the two spaces meet (006 contract p3); out-of-
    // viewport values are the session's own no-target signal (s6).
    const bridge = createFrameBridge(frame);
    const toFrame = bridge.toFrame;
    const hostDocument = frame.ownerDocument;
    const hostWindow = hostDocument.defaultView;
    const onHostPointerMove = (event: PointerEvent) => {
      if (session !== null && session.phase() !== 'idle') {
        const at = toFrame(event.clientX, event.clientY);
        session.move(at.x, at.y);
      }
    };
    const onHostPointerUp = () => {
      // NO suppress flag here: a host-side release never synthesizes a frame
      // click, and setting it would swallow the next legitimate canvas click.
      if (session !== null && session.phase() !== 'idle') {
        session.release();
      }
    };
    const onHostBlur = () => {
      if (session !== null && session.phase() !== 'idle') {
        session.cancel(); // the gesture's events are gone for good — zero trace
      }
    };
    if (session !== null) {
      hostDocument.addEventListener('pointermove', onHostPointerMove);
      hostDocument.addEventListener('pointerup', onHostPointerUp);
      hostWindow?.addEventListener('blur', onHostBlur);
      // The palette's entry point rides the same net — press only; activation
      // still requires crossing the threshold (a palette CLICK stays a click).
      onDragHandleRef.current?.({
        beginInsert(type, hostX, hostY) {
          const start = toFrame(hostX, hostY);
          session.press({ kind: 'insert', type }, start.x, start.y);
          return { didActivate: () => session.lastGestureActivated() };
        },
      });
    }

    machineryRef.current = {
      index,
      controller,
      tools,
      session,
      detachListeners: () => {
        frameDocument.removeEventListener('pointerdown', onPointerDown);
        frameDocument.removeEventListener('pointermove', onPointerMove);
        frameDocument.removeEventListener('pointerup', onPointerUp);
        frameDocument.removeEventListener('pointerleave', onPointerLeave);
        frameDocument.removeEventListener('click', onClick);
        if (session !== null) {
          hostDocument.removeEventListener('pointermove', onHostPointerMove);
          hostDocument.removeEventListener('pointerup', onHostPointerUp);
          hostWindow?.removeEventListener('blur', onHostBlur);
        }
      },
    };
    return () => {
      machineryRef.current?.detachListeners();
      session?.dispose();
      tools.dispose();
      controller.dispose();
      index.dispose();
      offSelection();
      machineryRef.current = null;
    };
    // geometryPorts/onToolError are test/instrumentation inputs, stable per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, kernel]);

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
      kernel.setSelection(next === undefined ? [] : [next]);
      return true;
    },
    [kernel, dir, slotOrder, editable],
  );
  // Belt and braces: if focus reaches the frame by any route (a tab into the
  // iframe, a programmatic focus), traversal still works there. Keydown does not
  // cross document boundaries, so this can never double-handle with the host's
  // own handler. Its own effect, so the machinery effect stays [frame, kernel].
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
        handle.end();
        return true;
      }
      if (key === 'Enter' && handle.current() === null) {
        // Kernel truth, never a render closure: this listener lives on the frame
        // document and must act on the selection as it IS.
        const selected = kernel.context.store.getState().selection[0];
        return selected === undefined ? false : handle.begin(selected);
      }
      return false;
    },
    [kernel],
  );

  useEffect(() => {
    const frameDocument = frame?.contentDocument ?? null;
    /* v8 ignore next 3 -- same-origin frames always expose a document. */
    if (frameDocument === null) {
      return;
    }
    const onFrameKeyDown = (event: KeyboardEvent) => {
      if (handleInlineKey(event.key)) {
        event.preventDefault();
        return;
      }
      if (handleTraversalKey(event.key, event.altKey)) {
        event.preventDefault();
      }
    };
    const onFrameDoubleClick = (event: MouseEvent) => {
      const handle = sessionRef.current;
      const machinery = machineryRef.current;
      if (handle === null || machinery === null) {
        return;
      }
      const hit = machinery.index.nodeAt(event.clientX, event.clientY);
      if (hit !== undefined && handle.begin(hit)) {
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
  }, [frame, handleTraversalKey, handleInlineKey]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (handleInlineKey(event.key)) {
        event.preventDefault();
        return;
      }
      if (handleTraversalKey(event.key, event.altKey)) {
        event.preventDefault();
      }
    },
    [handleTraversalKey, handleInlineKey],
  );

  /**
   * The seam handed to the renderer (009 §7). It names ONE node and ONE prop,
   * so the swap — and the re-render — is scoped to that node's subtree; every
   * other node's memoized view is untouched (FR-009).
   */
  const inlineEdit = useMemo(() => {
    if (inlineSession === null) {
      return undefined;
    }
    const { nodeId, propKey, kind } = inlineSession;
    return {
      nodeId,
      propKey,
      render: ({ value }: { nodeId: NodeId; propKey: string; value: unknown }) =>
        kind === 'text' ? (
          <InlineTextSurface
            value={value}
            label={propKey}
            singleLine
            onCommit={(next) => {
              // The SAME door as the inspector: one dispatch per commit, and
              // history's typing merge owns undo granularity (FR-003).
              try {
                kernel.dispatch('setProp', { id: nodeId, key: propKey, value: next }, 'user');
              } catch {
                // A door rejection leaves the document untouched; the surface
                // keeps what was typed so the editor can correct it in place.
              }
            }}
            onExit={() => {
              sessionRef.current?.end();
            }}
          />
        ) : null,
    };
  }, [inlineSession, kernel]);

  const announcement = useMemo(() => {
    // A selection id that no longer resolves to a live node is "no selection"
    // for announcement purposes — never read a raw internal id aloud.
    const node = selectedId === null ? undefined : kernel.getDocument().nodes[selectedId];
    if (node === undefined) {
      return 'Selection cleared';
    }
    const name = kernel.context.registry.block(node.type)?.schema.description ?? node.type;
    return `${name} selected`;
  }, [kernel, selectedId]);

  return (
    <div
      ref={hostRef}
      className="bldr-canvas-host"
      role="region"
      aria-label={title}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div
        className="bldr-canvas-frame-shell"
        style={
          // Guarded: 0/negative/NaN would collapse or corrupt the frame —
          // an invalid width falls back to full width, never a broken shell.
          frameWidth !== undefined && Number.isFinite(frameWidth) && frameWidth >= 1
            ? { inlineSize: `${String(frameWidth)}px`, maxInlineSize: '100%' }
            : undefined
        }
      >
        <CanvasFrame theme={theme} dir={dir} title={title} onFrame={setFrame}>
          <DocumentView
            kernel={kernel}
            breakpoint={breakpoint ?? 'desktop'}
            attachNodeElement={attachNodeElement}
            onBlockRender={onBlockRender}
            inlineEdit={inlineEdit}
          />
        </CanvasFrame>
        <div ref={layerRef} className="bldr-overlay" data-testid="bldr-overlay" />
      </div>
      <output className="bldr-visually-hidden" aria-live="polite" aria-label="Selection">
        {announcement}
      </output>
      <output className="bldr-visually-hidden" aria-live="polite" aria-label="Gesture">
        {gestureMessage.text}
        {gestureMessage.nonce % 2 === 1 ? '​' : ''}
      </output>
    </div>
  );
}
