import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { createPortal } from 'react-dom';

import type { BuilderKernel } from '@craftkit/builder-core';
import {
  CanvasFrame,
  DocumentView,
  useKernelSelector,
  type InlineEditSeam,
  type RenderBreakpoint,
  type Theme,
} from '@craftkit/builder-renderer';
import type {
  InlineEditableKind,
  InlineEditorProps,
  InlineFormatAction,
  InlineSelectionAnchor,
  NodeId,
} from '@craftkit/builder-schema';

import { performMoveAction, resolveMoveAction } from '../../keyboard/move-actions';
import { resolveTraversalAction, traverse, type SlotOrderLookup } from '../../keyboard/traversal';
import { createAnchorChannel, type AnchorChannel } from '../../overlay/anchor-channel';
import { performBlockAction, resolveBlockActions } from '../../overlay/block-actions';
import { createDragSession, type DragSession } from '../../overlay/drag-session';
import { createFloatingHost, type FloatingHostPorts } from '../../overlay/floating-host';
import { createFrameBridge } from '../../overlay/frame-bridge';
import { createInlineSession, type InlineSession } from '../../overlay/inline-session';
import { BlockActionBar } from '../BlockActionBar';
import { InlineRichSurface } from '../InlineRichSurface';
import { InlineTextSurface } from '../InlineTextSurface';
import { TextBubble } from '../TextBubble';
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
  /** Test-only floating-toolbar measurement injection (same reason). */
  floatingPorts?: Partial<FloatingHostPorts> | undefined;
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
  anchors: AnchorChannel;
  detachListeners: () => void;
}

/**
 * The floating toolbars' mount points (009 §10). React portals their CONTENT
 * into these elements and never positions them; the hosts write `transform`
 * from the anchor channel, so a canvas scroll with an open toolbar renders
 * nothing at all.
 */
interface FloatingMounts {
  text: HTMLElement;
  block: HTMLElement;
}

/** Stable empty list, so "no bubble" never allocates a new array per render. */
const NO_ACTIONS: InlineFormatAction[] = [];

type InlineEditTarget = NonNullable<ReturnType<InlineEditSeam['getSnapshot']>>;
type InlineEditEntryPoint = NonNullable<InlineEditTarget['entryPoint']>;
type InlineEditEntryIntent =
  { kind: 'pointer'; clientX: number; clientY: number } | { kind: 'keyboard' };

interface InlineEditBinding {
  nodeId: NodeId;
  target: InlineEditTarget;
}

interface MutableInlineEditSeam extends InlineEditSeam {
  set: (binding: InlineEditBinding | null) => void;
}

/**
 * A node-keyed external store owned by the canvas. Its object identity never
 * changes, and an update notifies only the node losing or gaining the seam —
 * opening an edit therefore cannot fan a prop change through the whole tree.
 */
function createMutableInlineEditSeam(): MutableInlineEditSeam {
  let current: InlineEditBinding | null = null;
  const listeners = new Map<NodeId, Set<() => void>>();

  const notify = (nodeId: NodeId) => {
    for (const listener of [...(listeners.get(nodeId) ?? [])]) {
      listener();
    }
  };

  return {
    subscribe: (nodeId, listener) => {
      const own = listeners.get(nodeId) ?? new Set<() => void>();
      own.add(listener);
      listeners.set(nodeId, own);
      return () => {
        own.delete(listener);
        if (own.size === 0) {
          listeners.delete(nodeId);
        }
      };
    },
    getSnapshot: (nodeId) => (current?.nodeId === nodeId ? current.target : null),
    set: (binding) => {
      if (Object.is(current, binding)) {
        return;
      }
      const previousId = current?.nodeId;
      current = binding;
      const nextId = binding?.nodeId;
      if (previousId !== undefined) {
        notify(previousId);
      }
      if (nextId !== undefined && nextId !== previousId) {
        notify(nextId);
      }
    },
  };
}

function inlineRectOf(rect: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>) {
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return null;
  }
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/** Read the live frame-document range; never retain its geometry in React. */
function measureTextSelection(
  frameDocument: Document,
  editedElement: HTMLElement,
): InlineSelectionAnchor | null {
  const selection = frameDocument.getSelection();
  if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (
    range.collapsed ||
    (range.commonAncestorContainer !== editedElement &&
      !editedElement.contains(range.commonAncestorContainer))
  ) {
    return null;
  }
  const measuredRange = range as unknown as {
    getClientRects?: (() => ArrayLike<DOMRect>) | undefined;
    getBoundingClientRect?: (() => DOMRect) | undefined;
  };
  const rects = Array.from(measuredRange.getClientRects?.call(range) ?? [])
    .map(inlineRectOf)
    .filter((rect): rect is NonNullable<typeof rect> => rect !== null);
  const bounding = measuredRange.getBoundingClientRect?.call(range);
  const box = bounding === undefined ? null : inlineRectOf(bounding);
  const [firstRect, ...remainingRects] = rects;
  let union: InlineSelectionAnchor['box'];
  if (box !== null) {
    union = box;
  } else {
    if (firstRect === undefined) {
      return null;
    }
    union = remainingRects.reduce((current, rect) => {
      const right = Math.max(current.x + current.width, rect.x + rect.width);
      const bottom = Math.max(current.y + current.height, rect.y + rect.height);
      const x = Math.min(current.x, rect.x);
      const y = Math.min(current.y, rect.y);
      return { x, y, width: right - x, height: bottom - y };
    }, firstRect);
  }
  return rects.length === 0 ? { box: union } : { box: union, rects };
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
  floatingPorts,
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
  const [inlineEntryPoint, setInlineEntryPoint] = useState<InlineEditEntryPoint | null>(null);
  const [inlineRejection, setInlineRejection] = useState<string | null>(null);
  const inlineRejectionId = `${useId()}-inline-rejection`;
  const inlineEntryKeyRef = useRef(0);
  const sessionRef = useRef<ReturnType<typeof createInlineSession> | null>(null);
  const inlineEditSeam = useMemo(() => createMutableInlineEditSeam(), []);

  // Floating chrome (009 §10). These three pieces of state change on
  // BOUNDARIES only — mount, gesture start/end, selection — never per pointer
  // move and never per scroll frame, which is what keeps the toolbars off
  // React's hot path while still letting React own their content.
  const [floating, setFloating] = useState<FloatingMounts | null>(null);
  const [dragging, setDragging] = useState(false);
  const [textActions, setTextActions] = useState<InlineFormatAction[]>([]);
  const textMeasureRef = useRef<Parameters<AnchorChannel['setText']>[0]>(null);
  // The contributed editor, KEYED by the kind it serves. Loaded on demand — a
  // session that never inline-edits rich text never pulls an editing engine in —
  // and kept afterwards, so reopening the same kind costs nothing.
  const [loadedEditor, setLoadedEditor] = useState<{
    kind: InlineEditableKind;
    /** Null means the contribution failed and the built-in fallback won. */
    Component: ComponentType<InlineEditorProps> | null;
  } | null>(null);
  // The snapshot handler lives in plain TS and must read the CURRENT direction
  // without re-subscribing the whole machinery when it flips.
  const dirRef = useRef<'ltr' | 'rtl'>('ltr');
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

  const beginInlineEdit = useCallback((nodeId: NodeId, entry: InlineEditEntryIntent): boolean => {
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
    textMeasureRef.current = null;
    machineryRef.current?.anchors.setText(null);
    const opened = handle.begin(nodeId);
    if (!opened) {
      setInlineEntryPoint(null);
    }
    return opened;
  }, []);

  const reportTextAnchor = useCallback(
    (anchor: InlineSelectionAnchor | null) => {
      const session = sessionRef.current?.current() ?? null;
      const measure =
        anchor === null || session === null
          ? null
          : () => {
              const frameDocument = frame?.contentDocument;
              const editedElement = elementsRef.current.get(session.nodeId);
              return frameDocument === null ||
                frameDocument === undefined ||
                editedElement === undefined
                ? null
                : measureTextSelection(frameDocument, editedElement);
            };
      textMeasureRef.current = measure;
      machineryRef.current?.anchors.setText(measure);
    },
    [frame],
  );

  const [gestureMessage, setGestureMessage] = useState({ text: '', nonce: 0 });
  const announceGestureRef = useRef((message: string) => {
    setGestureMessage((current) => ({ text: message, nonce: current.nonce + 1 }));
  });
  const suppressClickRef = useRef(false);
  const onDragHandleRef = useRef(onDragHandle);
  const onToolErrorRef = useRef(onToolError);
  useEffect(() => {
    onDragHandleRef.current = onDragHandle;
    onToolErrorRef.current = onToolError;
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

    // Floating chrome (009 §10). The bridge is the ONE place frame and host
    // space meet; the channel rides the rect index's existing invalidation, so
    // toolbars follow the content without anything polling.
    const bridge = createFrameBridge(frame);
    const textHost = createFloatingHost({
      layer,
      className: 'bldr-floating--bubble',
      align: 'center',
      arrowSize: 10,
      ...(floatingPorts === undefined ? {} : { ports: floatingPorts }),
    });
    // Below-centre, because the selection outline's name chip owns the block's
    // top-start corner — stacking the bar there collides with it (and
    // below-centre is where the reference design seats it).
    const blockHost = createFloatingHost({
      layer,
      className: 'bldr-floating--actions',
      align: 'center',
      prefer: 'below',
      ...(floatingPorts === undefined ? {} : { ports: floatingPorts }),
    });
    const anchors = createAnchorChannel({
      index,
      bridge,
      schedule: ports.schedule,
      onSnapshot: (snapshot) => {
        const common = {
          frame: snapshot.frame,
          viewport: snapshot.viewport,
          visible: snapshot.visible,
          dir: dirRef.current,
        };
        blockHost.place({ anchor: snapshot.block, ...common });
        textHost.place({ anchor: snapshot.text, ...common });
      },
    });
    anchors.setText(textMeasureRef.current);
    // ONE setState for the whole mount: React needs the portal targets, and
    // after this it never hears about geometry again.
    setFloating({ text: textHost.element, block: blockHost.element });

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
            // A gesture BOUNDARY, never a pointer move: the action bar is not
            // mounted while a drag is in flight (US3/AC4), and comes back on
            // release without a second gesture.
            setDragging(active);
          },
        })
      : null;

    const offSelection = kernel.context.store.subscribe(() => {
      // Selection AND hover are re-notified on every document change: the tool
      // host drops a target whose node no longer exists, so an undo that removes
      // the targeted node cannot leave orphaned tool chrome behind (FR-007) —
      // hover included, even though no pointer moved.
      const selected = kernel.context.store.getState().selection[0] ?? null;
      tools.notifySelection(selected);
      tools.notifyHover(controller.hoveredId());
      // Same law for the action bar: its anchor follows the selection, and a
      // node that vanished has no rect, so the bar hides instead of stranding.
      anchors.setBlock(selected);
    });
    anchors.setBlock(kernel.context.store.getState().selection[0] ?? null);

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
      anchors,
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
      anchors.dispose();
      textHost.dispose();
      blockHost.dispose();
      index.dispose();
      offSelection();
      machineryRef.current = null;
      setFloating(null);
      setDragging(false);
    };
    // geometryPorts/onToolError are test/instrumentation inputs, stable per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, kernel]);

  // A direction flip changes where every toolbar sits without moving a single
  // rect, so the channel is told explicitly — the rect index has nothing to
  // invalidate here (RTL is placement, not geometry).
  useEffect(() => {
    dirRef.current = dir;
    machineryRef.current?.anchors.refresh();
  }, [dir]);

  // While a block's text is open IN PLACE, the editing surface's own focus ring
  // is the chrome. Stacking the selection outline and its name label on top
  // reads as three competing borders around one paragraph — the double-chrome
  // defect. A class on the layer, so the hot path stays untouched.
  useEffect(() => {
    layerRef.current?.classList.toggle('bldr-overlay--editing', inlineSession !== null);
  }, [inlineSession]);

  // Closing the session retires the LIVE measurement source HERE rather than
  // trusting the editor to report its own farewell. Geometry never enters
  // React state; the channel invokes the source on every observer-driven flush.
  useEffect(() => {
    if (inlineSession !== null) {
      return;
    }
    textMeasureRef.current = null;
    machineryRef.current?.anchors.setText(null);
  }, [inlineSession]);

  const visibleTextActions = inlineSession === null ? NO_ACTIONS : textActions;

  /**
   * Resolve the OPEN session's editor from the registry (009 §11). The
   * contribution is lazy by contract, so this is the one moment an editing
   * engine may load — and only for a session that actually needs it, which is
   * exactly the containment law the loader counter proves (SC-005). A kind with
   * no contribution never opens a session at all, so the only fallback here is
   * the canvas's own plain-text surface.
   */
  useEffect(() => {
    if (inlineSession === null) {
      return undefined;
    }
    const kind = inlineSession.kind;
    const def = kernel.context.registry.inlineEditor(kind);
    if (def === undefined || loadedEditor?.kind === kind) {
      return undefined;
    }
    let live = true;
    void def
      .load()
      .then((module) => {
        if (live) {
          setLoadedEditor({ kind, Component: module.default });
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // A broken contribution must not take the canvas down: the session
        // stays open on the built-in surface, and the failure is reported
        // through the same sink a failing canvas tool uses. Nothing mounted
        // while the loader was pending, so the fallback is still the ONE
        // surface this session ever mounts.
        if (live) {
          setLoadedEditor({ kind, Component: null });
        }
        onToolErrorRef.current?.(def.id, error);
      });
    return () => {
      live = false;
    };
  }, [inlineSession, kernel, loadedEditor]);

  // Derived, never cleared by an effect: an editor loaded for another kind is
  // simply not this session's editor.
  const contributedEditor =
    inlineSession !== null &&
    loadedEditor?.kind === inlineSession.kind &&
    loadedEditor.Component !== null
      ? loadedEditor.Component
      : null;
  const contributedEditorPending =
    inlineSession !== null &&
    kernel.context.registry.inlineEditor(inlineSession.kind) !== undefined &&
    loadedEditor?.kind !== inlineSession.kind;

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
        return selected === undefined ? false : beginInlineEdit(selected, { kind: 'keyboard' });
      }
      return false;
    },
    [kernel, beginInlineEdit],
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
  }, [frame, handleTraversalKey, handleInlineKey, beginInlineEdit]);

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
   * The descriptor written into the stable node-keyed seam. A contributed
   * implementation is CHOSEN before anything swaps into the block: while its
   * loader is pending `render` is null, so the block keeps its ordinary output
   * and exactly one editing surface mounts when resolution finishes.
   */
  const inlineEditBinding = useMemo<InlineEditBinding | null>(() => {
    if (inlineSession === null) {
      return null;
    }
    const { nodeId, propKey, kind } = inlineSession;
    const commit = (next: unknown) => {
      // The SAME door as the inspector: one dispatch per commit, and history's
      // typing merge owns undo granularity (FR-003).
      try {
        kernel.dispatch('setProp', { id: nodeId, key: propKey, value: next }, 'user');
        setInlineRejection(null);
      } catch (error) {
        // A door rejection leaves the document untouched; the surface keeps
        // what was typed so the editor can correct it in place. The reason is
        // visible next to, and described by, the same live control.
        setInlineRejection(error instanceof Error ? error.message : String(error));
        announceGestureRef.current(`${propKey} rejected`);
      }
    };
    const exit = () => {
      sessionRef.current?.end();
    };
    const Contributed = contributedEditor;
    return {
      nodeId,
      target: {
        propKey,
        render: contributedEditorPending
          ? null
          : ({ value }) => {
              // A contributed editor outranks the built-ins wherever an
              // extension registered one (009 §11). A resolved loader failure
              // uses the built-in, but a PENDING loader never mounts it first.
              if (Contributed !== null) {
                return (
                  <Contributed
                    value={value}
                    label={propKey}
                    onCommit={commit}
                    onExit={exit}
                    onAnchor={reportTextAnchor}
                    onActions={setTextActions}
                  />
                );
              }
              return kind === 'rich' ? (
                <InlineRichSurface
                  value={value}
                  label={propKey}
                  onCommit={commit}
                  onExit={exit}
                  onAnchor={reportTextAnchor}
                  onActions={setTextActions}
                />
              ) : (
                <InlineTextSurface
                  value={value}
                  label={propKey}
                  singleLine
                  onCommit={commit}
                  onExit={exit}
                />
              );
            },
        ...(inlineEntryPoint === null ? {} : { entryPoint: inlineEntryPoint }),
        ...(inlineRejection === null
          ? {}
          : { rejection: { id: inlineRejectionId, message: inlineRejection } }),
      },
    };
  }, [
    inlineSession,
    kernel,
    contributedEditor,
    contributedEditorPending,
    inlineEntryPoint,
    inlineRejection,
    inlineRejectionId,
    reportTextAnchor,
  ]);

  useLayoutEffect(() => {
    inlineEditSeam.set(inlineEditBinding);
  }, [inlineEditBinding, inlineEditSeam]);

  // The document itself, so the action bar's gates track edits: a node that
  // just became last must show "Move later" disabled without another click.
  const doc = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>) => state.doc,
      [],
    ),
  );

  const selectedName = useMemo(() => {
    const node = selectedId === null ? undefined : doc.nodes[selectedId];
    if (node === undefined) {
      return null;
    }
    return kernel.context.registry.block(node.type)?.schema.description ?? node.type;
  }, [kernel, doc, selectedId]);

  const announcement = useMemo(
    // A selection id that no longer resolves to a live node is "no selection"
    // for announcement purposes — never read a raw internal id aloud.
    () => (selectedName === null ? 'Selection cleared' : `${selectedName} selected`),
    [selectedName],
  );

  const blockActions = useMemo(
    () =>
      selectedId === null || doc.nodes[selectedId] === undefined
        ? []
        : resolveBlockActions(kernel, selectedId),
    [kernel, doc, selectedId],
  );

  const runBlockAction = useCallback(
    (id: string) => {
      const selected = kernel.context.store.getState().selection[0];
      if (selected === undefined) {
        return;
      }
      if (id === 'editText') {
        const opened = beginInlineEdit(selected, { kind: 'keyboard' });
        announceGestureRef.current(
          opened ? `Editing ${selectedName ?? 'text'}` : 'Text editing is no longer available',
        );
        return;
      }
      // ONE dispatch, and the resulting selection is the action's own decision
      // (US3/AC2). Refusals are announced, never thrown at the door.
      announceGestureRef.current(performBlockAction(kernel, selected, id).announcement);
    },
    [kernel, beginInlineEdit, selectedName],
  );

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
            inlineEdit={inlineEditSeam}
          />
        </CanvasFrame>
        <div ref={layerRef} className="bldr-overlay" data-testid="bldr-overlay" />
        {/* Floating chrome: React owns the CONTENT, the hosts own the geometry.
            The bubble exists only while an editor reports actions for a live
            selection, so a plain-text surface never shows one (US2/AC5). */}
        {floating !== null && visibleTextActions.length > 0
          ? createPortal(<TextBubble dir={dir} actions={visibleTextActions} />, floating.text)
          : null}
        {/* The action bar belongs to a SELECTED block that is not busy being
            something else: not while a drag is in flight (US3/AC4), and not
            while its own text is open for editing — the bubble owns that
            moment, and two toolbars over one block is noise, not power. */}
        {floating !== null &&
        editable &&
        !dragging &&
        inlineSession === null &&
        selectedName !== null &&
        blockActions.length > 0
          ? createPortal(
              <BlockActionBar
                label={`Actions for ${selectedName}`}
                actions={blockActions}
                onAction={runBlockAction}
                dir={dir}
              />,
              floating.block,
            )
          : null}
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
