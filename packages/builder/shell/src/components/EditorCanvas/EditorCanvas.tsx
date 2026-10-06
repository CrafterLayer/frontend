import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
  CustomCodeNode,
  CustomCodeRoot,
  InlineEditableKind,
  InlineEditorProps,
  InlineFormatAction,
  InlineSelectionAnchor,
  InlineSelectionAnchorReport,
  InlineSelectionAnchorSource,
  NodeId,
  PaletteColor,
  StyleBucket,
  StyleSectorId,
  StyleState,
} from '@craftkit/builder-schema';

import { customCodeElementAt } from '../../custom-code/element-at';
import {
  ELEMENT_NAME_WORDS_EN,
  type ElementNameWords,
  type ElementTarget,
} from '../../custom-code/element-target';
import { createElementSelection, type ElementSelection } from '../../selection/element-selection';
import {
  createMemoryStyleClipboard,
  performElementAction,
  resolveElementActions,
  type ElementActionId,
  type StyleClipboard,
} from '../../overlay/element-actions';
import { createElementHandles, type ElementHandles } from '../../overlay/element-handles';
import { createForcedStatePreview, type ForcedStatePreview } from '../../overlay/forced-state';
import { createGridOverlay, readGridMetrics, type GridOverlay } from '../../overlay/grid-overlay';
import {
  computeSnap,
  createGuideChrome,
  isFreelyPositioned,
  isNudgeKey,
  measuredInsets,
  moveTreeElementBy,
  nudgeDelta,
  type GuideChrome,
} from '../../overlay/snap-guides';
import type { TreeDragPayload, TreeDropPorts } from '../../overlay/tree-drop-resolver';
import {
  TREE_TEXT_ACTION_LABELS_EN,
  treeTextBubbleActions,
  type TreeTextActionLabels,
} from '../../overlay/tree-text-actions';
import {
  beginTreeTextEdit,
  isTreeTextEditable,
  type TreeTextSession,
} from '../../overlay/tree-text-session';
import {
  createElementBarModel,
  ELEMENT_QUICK_BAR_LABELS_EN,
  ElementQuickBar,
  paletteSwatches,
  themeColorSwatches,
  type ElementQuickBarLabels,
  type NamedStyleChoice,
} from '../ElementQuickBar';
import {
  bucketForBreakpoint,
  elementDomOf,
  focusedTreeTarget,
  unlockedPath,
} from './element-canvas-helpers';
import { performMoveAction, resolveMoveAction } from '../../keyboard/move-actions';
import { blockDisplayName } from '../../naming/block-display-name';
import { customCodeElementName } from '../../naming/custom-code-element-name';
import {
  parentOf,
  resolveTraversalAction,
  traverse,
  type SlotOrderLookup,
} from '../../keyboard/traversal';
import { createAnchorChannel, type AnchorChannel } from '../../overlay/anchor-channel';
import { performBlockAction, resolveBlockActions } from '../../overlay/block-actions';
import { createDragSession, type DragSession } from '../../overlay/drag-session';
import { createFloatingHost, type FloatingHostPorts } from '../../overlay/floating-host';
import { createFrameBridge } from '../../overlay/frame-bridge';
import {
  createInlineSession,
  inlineTargetOf,
  type InlineSession,
} from '../../overlay/inline-session';
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
   * Receives a narrow control over the OPEN inline editing session, so a host
   * surface that becomes a SECOND editing target (the code view, B4) can end
   * the first one before opening. Two live editing surfaces over one document
   * is the defect this exists to prevent (011 spec edge case 7).
   */
  onInlineEditHandle?: ((handle: CanvasInlineEditHandle) => void) | undefined;
  /**
   * B3a (007 contract §6): preview frame width in px (device emulation);
   * absent ⇒ full width. Layout-only — the frame shell narrows and centers,
   * and the overlay layer shares its origin, so no hot path changes.
   */
  frameWidth?: number | undefined;
  /** Visual canvas scale. It never changes the authored frame width or breakpoint. */
  zoom?: number | undefined;
  /**
   * B3a (007 review C1): the breakpoint the CONTENT renders at — the device
   * width must drive one authority end-to-end, so the composition derives this
   * from the same bucket the inspector edits ('base' ⇒ 'desktop'). Absent ⇒
   * desktop, byte-compatible with 005/006.
   */
  breakpoint?: RenderBreakpoint | undefined;

  // ── P7 canvas chrome (style-manager DESIGN.md §A.6, §A.7, §E) ──────────────
  /**
   * The shared multi-selection store (P2). Shift-click on the canvas toggles
   * members in it. Absent ⇒ the canvas keeps a private one (the panel and
   * Layers then cannot see canvas multi-selections).
   */
  elementSelection?: ElementSelection | undefined;
  /** The bucket the quick bar and handles write at. Absent ⇒ derived from `breakpoint`. */
  styleBucket?: StyleBucket | undefined;
  /**
   * The panel's state switcher. Not `default` ⇒ the focused element is
   * stamped `data-ck-state` so the canvas shows that state (needs the live
   * compiler created with `canvasStateVariants: true`), and the quick bar
   * writes in that state.
   */
  styleState?: StyleState | undefined;
  /** The open panel sector; `layout` draws the focused grid's tracks. */
  activeSector?: StyleSectorId | null | undefined;
  /** Quick bar "More": open the side panel at this sector for the element. */
  onOpenStyleSector?: ((sector: StyleSectorId, target: ElementTarget) => void) | undefined;
  /** Quick bar "Edit with AI". Absent ⇒ no sparkle button. */
  onEditWithAi?: ((target: ElementTarget) => void) | undefined;
  /** Element action "Save as template". Absent ⇒ disabled. */
  onSaveTemplate?: ((target: ElementTarget) => void) | undefined;
  /** Element action "Animate": open the Interactions editor. Absent ⇒ the motion sector via `onOpenStyleSector`. */
  onAnimate?: ((target: ElementTarget) => void) | undefined;
  /** Image/video "Replace": the host opens its asset manager. Absent ⇒ disabled. */
  onReplaceMedia?: ((target: ElementTarget) => void) | undefined;
  /**
   * Frame keydowns the canvas did not handle (focus inside the iframe never
   * reaches host-document listeners). Return true when the key was consumed.
   */
  onShortcut?: ((event: KeyboardEvent) => boolean) | undefined;
  /** Where Copy style / Paste style keep classes. Absent ⇒ in memory, per canvas. */
  styleClipboard?: StyleClipboard | undefined;
  /** Site-library palette colours for the colour controls. */
  palette?: readonly PaletteColor[] | undefined;
  /** Site-library named styles for the link/button style preset. */
  namedStyles?: readonly NamedStyleChoice[] | undefined;
  /** Named-style utilities by id, so values from `ck-s-*` markers show their source. */
  namedStyleClasses?: Readonly<Record<string, string>> | undefined;
  /** Quick-bar labels (EN default; the host picks AR by locale). */
  quickBarLabels?: ElementQuickBarLabels | undefined;
  /** Text-bubble labels for formatting tree text. */
  treeTextLabels?: TreeTextActionLabels | undefined;
  /** Element names in labels and announcements. */
  elementNameWords?: ElementNameWords | undefined;
  /** The EDITOR UI direction (roving arrows in the quick bar). Default `ltr`. */
  editorDir?: 'ltr' | 'rtl' | undefined;
  /** Test-only geometry for tree drops (jsdom has no layout). */
  treeDropPorts?: Partial<TreeDropPorts> | undefined;
  /**
   * The site's symbol masters by id: an element inside a symbol instance gets
   * its quick bar, which writes the instance's overrides (fix pass, §G).
   */
  symbolTree?: ((symbolId: string) => CustomCodeRoot | undefined) | undefined;
}

/**
 * What a host may do to an inline editing session it does not own: ask whether
 * one is open, and end it. Deliberately not "start" — beginning an edit is a
 * canvas gesture, and deliberately not a commit/cancel choice: `end` closes
 * without dispatching, exactly as Escape on the canvas does.
 */
export interface CanvasInlineEditHandle {
  isEditing(): boolean;
  end(): void;
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
  /**
   * P7: start inserting a custom-code tree node (P2's element payload, from
   * the Library panel). It drops into a region's tree at the seat under the
   * pointer: `insertTreeNode`, one transaction.
   */
  beginTreeInsert?(
    node: CustomCodeNode,
    label: string,
    hostX: number,
    hostY: number,
  ): { didActivate: () => boolean };
}

interface Machinery {
  index: RectIndex;
  controller: OverlayController;
  tools: ToolHost;
  session: DragSession | null;
  beginMoveFromHandle: (nodeId: NodeId, hostX: number, hostY: number) => void;
  beginTreeMove: (payload: TreeDragPayload, hostX: number, hostY: number) => void;
  anchors: AnchorChannel;
  handles: ElementHandles | null;
  grid: GridOverlay;
  forced: ForcedStatePreview;
  syncElementChrome: () => void;
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
  /** The element quick bar: above the element, flipping below when clipped (§A.6). */
  element: HTMLElement;
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

function isInlineSelectionAnchorSource(
  report: InlineSelectionAnchorReport,
): report is InlineSelectionAnchorSource {
  return 'measure' in report;
}

/**
 * Compatibility measurement for a pre-closeout editor that reports a frozen
 * anchor. Current editors provide their own deferred source instead. Either
 * way, the rect APIs are reached only when the anchor channel flushes.
 */
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
/**
 * Elements that own their own Escape. A form control dismisses a picker or a
 * draft with it; a contenteditable region (or anything inside one) is an
 * editor's territory. The canvas must never throw the selection away
 * underneath them. Attribute-based, so it holds where `isContentEditable` is
 * not implemented (jsdom) and where the region is nested.
 */
const EDITABLE_TARGET_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(EDITABLE_TARGET_SELECTOR) !== null;
}

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
  onInlineEditHandle,
  frameWidth,
  zoom = 1,
  breakpoint,
  elementSelection,
  styleBucket,
  styleState = 'default',
  activeSector = null,
  onOpenStyleSector,
  onEditWithAi,
  onSaveTemplate,
  onAnimate,
  onReplaceMedia,
  onShortcut,
  styleClipboard,
  palette,
  namedStyles,
  namedStyleClasses,
  quickBarLabels = ELEMENT_QUICK_BAR_LABELS_EN,
  treeTextLabels = TREE_TEXT_ACTION_LABELS_EN,
  elementNameWords = ELEMENT_NAME_WORDS_EN,
  editorDir = 'ltr',
  treeDropPorts,
  symbolTree,
}: EditorCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const frameShellRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const machineryRef = useRef<Machinery | null>(null);
  const normalizedZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const zoomRef = useRef(normalizedZoom);
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
  const [selectionNonce, setSelectionNonce] = useState(0);
  const inlineRejectionId = `${useId()}-inline-rejection`;
  const inlineEntryKeyRef = useRef(0);
  const sessionRef = useRef<ReturnType<typeof createInlineSession> | null>(null);
  const surfaceEscapeHandledRef = useRef(false);
  const returnFocusToEditorRef = useRef<(() => void) | null>(null);
  const inlineEditSeam = useMemo(() => createMutableInlineEditSeam(), []);

  // Floating chrome (009 §10). These three pieces of state change on
  // BOUNDARIES only — mount, gesture start/end, selection — never per pointer
  // move and never per scroll frame, which is what keeps the toolbars off
  // React's hot path while still letting React own their content.
  const [floating, setFloating] = useState<FloatingMounts | null>(null);
  const [dragState, setDragState] = useState({ active: false, revision: 0 });
  const dragging = dragState.active;
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

  const reportTextActions = useCallback((actions: InlineFormatAction[]) => {
    if (actions.length === 0) {
      returnFocusToEditorRef.current = null;
    }
    setTextActions(actions);
  }, []);

  const requestFormattingMenuFocus = useCallback(
    (returnFocusToEditor: () => void): boolean => {
      const menu = floating?.text;
      if (menu === undefined) {
        return false;
      }
      const firstAction = menu.querySelector<HTMLButtonElement>(
        '.bldr-text-bubble__action:not(:disabled)',
      );
      if (firstAction === null) {
        return false;
      }
      returnFocusToEditorRef.current = returnFocusToEditor;
      firstAction.focus({ preventScroll: true });
      if (firstAction.ownerDocument.activeElement === firstAction) {
        return true;
      }
      returnFocusToEditorRef.current = null;
      return false;
    },
    [floating],
  );

  const returnFocusToEditor = useCallback((): boolean => {
    const restore = returnFocusToEditorRef.current;
    if (restore === null) {
      return false;
    }
    returnFocusToEditorRef.current = null;
    restore();
    return true;
  }, []);
  // The snapshot handler lives in plain TS and must read the CURRENT direction
  // without re-subscribing the whole machinery when it flips.
  const dirRef = useRef<'ltr' | 'rtl'>('ltr');

  // ── P7 element chrome state (style-manager DESIGN.md §A.6, §A.7, §E) ──────
  // Refs carry the CURRENT panel bucket/state/sector into the plain-TS
  // machinery without rebuilding it; the effects below sync them and ask the
  // anchor channel for one fresh flush.
  const bucket = styleBucket ?? bucketForBreakpoint(breakpoint);
  const bucketRef = useRef<StyleBucket>(bucket);
  const styleStateRef = useRef<StyleState>(styleState);
  const activeSectorRef = useRef<StyleSectorId | null>(activeSector);
  const onShortcutRef = useRef(onShortcut);
  const [ownSelection, setOwnSelection] = useState<ElementSelection | null>(null);
  const selectionStore = elementSelection ?? ownSelection;
  const selectionStoreRef = useRef<ElementSelection | null>(selectionStore);
  const fallbackClipboard = useMemo(() => createMemoryStyleClipboard(), []);
  const clipboard = styleClipboard ?? fallbackClipboard;
  // Bumped after Copy style so the bar re-renders with Paste style enabled.
  const [, setClipboardNonce] = useState(0);
  const [quickFocusRequest, setQuickFocusRequest] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [treeSession, setTreeSession] = useState<TreeTextSession | null>(null);
  const treeSessionRef = useRef<TreeTextSession | null>(null);
  const [treeHasRange, setTreeHasRange] = useState(false);
  const [linkRange, setLinkRange] = useState<{ start: number; end: number } | null>(null);
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
  }, [kernel, editable]);

  // A live region announces DOM mutations, not semantic equality. Selection
  // itself is the signal: moving from one "Text" block to another must still
  // toggle the region even though its spoken message is unchanged.
  useEffect(
    () =>
      kernel.context.store.select(
        (state) => state.selection,
        () => {
          setSelectionNonce((current) => current + 1);
        },
      ),
    [kernel],
  );

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
    returnFocusToEditorRef.current = null;
    textMeasureRef.current = null;
    machineryRef.current?.anchors.setText(null);
    const opened = handle.begin(nodeId);
    if (!opened) {
      setInlineEntryPoint(null);
    }
    return opened;
  }, []);

  const reportTextAnchor = useCallback(
    (report: InlineSelectionAnchorReport | null) => {
      const session = sessionRef.current?.current() ?? null;
      const measure =
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
      const name = customCodeElementName(located.element);
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
      announceGestureRef.current(`Editing ${name}`);
      return true;
    },
    [kernel, editable],
  );

  /**
   * P7 element keys, claimed BEFORE inline editing and traversal:
   * Alt+F10 enters the quick bar; Enter edits a text element in place or
   * steps into the first child; Shift+Enter steps to the parent; arrows nudge
   * an absolutely positioned element (1px, Shift 10px, mirrored under RTL);
   * Escape abandons a spacing scrub in flight.
   */
  const handleElementKey = useCallback(
    (event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>): boolean => {
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
    [kernel, editable, beginTreeTextEditing],
  );

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
    const bridge = createFrameBridge(frame, { scale: () => zoomRef.current });
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
    // P7: the element quick bar sits ABOVE the element, flipping below when
    // clipped (§A.6). Same anchor as the action bar — only one of the two
    // ever has content, and an empty host stays hidden.
    const elementHost = createFloatingHost({
      layer,
      className: 'bldr-floating--element',
      align: 'start',
      prefer: 'above',
      ...(floatingPorts === undefined ? {} : { ports: floatingPorts }),
    });

    // P7 element chrome: spacing handles (editable canvases only), the grid
    // overlay, the forced-state stamp and the positioning guides. All plain
    // TS, all synced on the anchor channel's rhythm — never per React render.
    const handles = editable
      ? createElementHandles({
          layer,
          kernel,
          bucket: () => bucketRef.current,
          state: () => styleStateRef.current,
          dir: () => dirRef.current,
          scale: () => zoomRef.current,
          announce: (message) => {
            announceGestureRef.current(message);
          },
          onScrubChange: setScrubbing,
        })
      : null;
    const grid = createGridOverlay(layer);
    const forced = createForcedStatePreview();
    const positionGuides: GuideChrome = createGuideChrome(layer);
    const syncElementChrome = () => {
      const target = focusedTreeTarget(kernel);
      const element = target === undefined ? null : elementDomOf(index, target.nodeId, target.path);
      const node =
        target === undefined ? undefined : customCodeElementAt(kernel, target.nodeId, target.path)?.element;
      const rect = target === undefined ? undefined : index.elementRect?.(target.nodeId, target.path);
      const box = rect === undefined ? null : { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      forced.apply(element ?? undefined, styleStateRef.current);
      const dragSession = machineryRef.current?.session ?? null;
      const showHandles =
        target !== undefined &&
        element !== null &&
        box !== null &&
        node !== undefined &&
        node.kind !== 'component' &&
        treeSessionRef.current === null &&
        (dragSession === null || dragSession.phase() === 'idle');
      handles?.update(showHandles ? target : null, showHandles ? element : null, showHandles ? box : null);
      const metrics =
        activeSectorRef.current === 'layout' && element !== null ? readGridMetrics(element) : undefined;
      if (metrics !== undefined && box !== null) {
        grid.show(box, metrics, dirRef.current);
      } else {
        grid.hide();
      }
    };

    const anchors = createAnchorChannel({
      index,
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
      const focus = state.elementFocus;
      anchors.setBlock(selected, focus !== null && focus.id === selected ? focus.path : null);
      // An edit can move an element without resizing any observed block;
      // one batched flush re-reads the element chrome either way.
      anchors.refresh();
    });
    {
      const state = kernel.context.store.getState();
      const selected = state.selection[0] ?? null;
      const focus = state.elementFocus;
      anchors.setBlock(selected, focus !== null && focus.id === selected ? focus.path : null);
    }

    // What is under the pointer: the node, and — inside a composed region —
    // the authored element (the portrait, the headline, the button). The
    // element is chrome and Inspector truth; canvas TOOLS keep working at
    // node granularity, which is the contract they were written against.
    const hitAt = (clientX: number, clientY: number) => {
      if (index.hitAt !== undefined) {
        return index.hitAt(clientX, clientY);
      }
      const nodeId = index.nodeAt(clientX, clientY);
      return nodeId === undefined ? undefined : { nodeId };
    };
    /*
      P7: dragging a positioned (absolute/fixed) element. The preview is a
      canvas-DOM translate only; snapping (6px) to the parent's and siblings'
      edges and centres draws guide lines; release writes `inset-*` through
      the engine as ONE transaction.
    */
    interface PositionDrag {
      target: NonNullable<ReturnType<typeof focusedTreeTarget>>;
      element: HTMLElement;
      startX: number;
      startY: number;
      rect: { x: number; y: number; width: number; height: number };
      others: { x: number; y: number; width: number; height: number }[];
      previousTranslate: string;
      measured: ReturnType<typeof measuredInsets>;
      dx: number;
      dy: number;
      moved: boolean;
    }
    let positionDrag: PositionDrag | null = null;
    const endPositionDrag = (commit: boolean) => {
      const drag = positionDrag;
      if (drag === null) return;
      positionDrag = null;
      drag.element.style.translate = drag.previousTranslate;
      positionGuides.hide();
      if (!commit || !drag.moved) return;
      suppressClickRef.current = true;
      const result = moveTreeElementBy(
        kernel,
        drag.target,
        { dx: Math.round(drag.dx), dy: Math.round(drag.dy) },
        {
          bucket: bucketRef.current,
          state: styleStateRef.current,
          dir: dirRef.current,
          measured: drag.measured,
        },
      );
      announceGestureRef.current(result.announcement);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!editable || event.button !== 0 || event.shiftKey || treeSessionRef.current !== null) {
        return;
      }
      const target = focusedTreeTarget(kernel);
      const element = target === undefined ? null : elementDomOf(index, target.nodeId, target.path);
      if (
        target === undefined ||
        element === null ||
        !(event.target instanceof Node) ||
        !element.contains(event.target) ||
        !isFreelyPositioned(element)
      ) {
        return;
      }
      const parent = element.parentElement;
      const siblings =
        parent === null
          ? []
          : Array.from(parent.children).filter(
              (child): child is HTMLElement => child !== element && child.hasAttribute('data-ck-path'),
            );
      positionDrag = {
        target,
        element,
        startX: event.clientX,
        startY: event.clientY,
        rect: ports.measure(element),
        others: [...(parent === null ? [] : [ports.measure(parent)]), ...siblings.map((sibling) => ports.measure(sibling))],
        previousTranslate: element.style.translate,
        measured: measuredInsets(element, dirRef.current),
        dx: 0,
        dy: 0,
        moved: false,
      };
      // No text selection while an element is being dragged.
      event.preventDefault();
    };
    const onPointerMove = (event: MouseEvent) => {
      if (positionDrag !== null) {
        const drag = positionDrag;
        const rawX = event.clientX - drag.startX;
        const rawY = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(rawX, rawY) < 3) return;
        drag.moved = true;
        const snap = computeSnap(
          { x: drag.rect.x + rawX, y: drag.rect.y + rawY, width: drag.rect.width, height: drag.rect.height },
          drag.others,
        );
        drag.dx = rawX + snap.dx;
        drag.dy = rawY + snap.dy;
        drag.element.style.translate = `${String(drag.dx)}px ${String(drag.dy)}px`;
        positionGuides.show(snap.guides);
        return;
      }
      if (session !== null && session.phase() !== 'idle') {
        session.move(event.clientX, event.clientY);
        return; // hover chrome is suppressed for the session's duration
      }
      const hit = hitAt(event.clientX, event.clientY);
      // Locked elements pass the pointer to their parent (DESIGN §E Layers lock).
      const hoverPath =
        hit?.elementPath === undefined ? undefined : unlockedPath(kernel, hit.nodeId, hit.elementPath);
      controller.setHover(hit?.nodeId ?? null, hoverPath);
      tools.notifyHover(hit?.nodeId ?? null);
    };
    const onPointerUp = () => {
      if (positionDrag !== null) {
        endPositionDrag(true);
        return;
      }
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
      endPositionDrag(false);
      controller.setHover(null);
      tools.notifyHover(null);
    };
    const onClick = (event: MouseEvent) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return; // a completed drop already set the selection
      }
      // A click inside text being edited in place places the caret: it is the
      // editor's, and pulling focus to the host would end the edit.
      const editing = treeSessionRef.current;
      if (editing !== null && event.target instanceof Node && editing.element.contains(event.target)) {
        return;
      }
      const hit = hitAt(event.clientX, event.clientY);
      // Locked elements pass clicks to their parent; all-locked lands on the region.
      const path =
        hit?.elementPath === undefined ? undefined : unlockedPath(kernel, hit.nodeId, hit.elementPath);
      if (hit === undefined) {
        kernel.setSelection([]);
      } else if (path === undefined) {
        kernel.setSelection([hit.nodeId]);
      } else if (event.shiftKey && selectionStoreRef.current !== null) {
        // Shift-click adds the element to the multi-selection (or removes it).
        selectionStoreRef.current.toggle({ kind: 'tree', nodeId: hit.nodeId, path });
      } else {
        // Straight to the element: a person who clicks the portrait in a
        // generated header means the portrait. Escape steps back out.
        kernel.focusElement(hit.nodeId, path);
      }
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
      if (session === null || session.phase() === 'idle') {
        return;
      }
      /*
        Only a blur that takes focus OUT OF THE APP cancels a drag.

        The canvas lives in an iframe, so pressing a block moves focus into that
        iframe and the host document fires `blur` — every real internal drag,
        every time. This handler cancelled on that, so a person could pick a
        block up, watch the ghost and the drop indicator follow their pointer,
        release, and have nothing happen. Measured in a browser: ghost shown,
        indicator on target, release announced "Drag cancelled", zero
        transactions.

        No test caught it because the drag stories dispatch synthetic events
        straight at the frame document — synthetic events move no focus, so the
        blur never fired in a test.

        `hasFocus()` is the distinction the spec already draws: it stays true
        while focus is anywhere inside this document OR a descendant browsing
        context, and goes false when the window or tab loses focus — which is
        the case this cancel was written for.
      */
      if (!hostDocument.hasFocus()) {
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
          session.press({ kind: 'insert', type }, start.x, start.y, 'handle');
          return { didActivate: () => session.lastGestureActivated() };
        },
        beginTreeInsert(node, label, hostX, hostY) {
          const start = toFrame(hostX, hostY);
          session.press({ kind: 'tree-insert', node, label }, start.x, start.y, 'handle');
          return { didActivate: () => session.lastGestureActivated() };
        },
      });
    }

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
      endPositionDrag(false);
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

  useLayoutEffect(() => {
    zoomRef.current = normalizedZoom;
    machineryRef.current?.anchors.refresh();
  }, [normalizedZoom]);

  // ── P7 element chrome wiring ──────────────────────────────────────────────

  // A private multi-selection store when the host shares none.
  useEffect(() => {
    if (elementSelection !== undefined) {
      return undefined;
    }
    const own = createElementSelection(kernel);
    // The store subscribes to the kernel, so it is created (and disposed) by
    // this effect rather than during render; React needs it for the bar.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setOwnSelection(own);
    return () => {
      own.dispose();
      setOwnSelection(null);
    };
  }, [kernel, elementSelection]);

  // The panel's bucket/state/sector reach the plain-TS chrome through refs;
  // a change asks for one fresh flush (the forced-state stamp, the grid).
  useEffect(() => {
    bucketRef.current = bucket;
    styleStateRef.current = styleState;
    activeSectorRef.current = activeSector;
    machineryRef.current?.anchors.refresh();
  }, [bucket, styleState, activeSector]);

  useEffect(() => {
    onShortcutRef.current = onShortcut;
    selectionStoreRef.current = selectionStore;
  });

  // An in-place text edit ends (and commits) when the focus moves elsewhere —
  // a click on another element, Escape out of the region, an undo.
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
    [kernel],
  );

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

  useEffect(() => {
    if (inlineSession === null || visibleTextActions.length === 0) {
      returnFocusToEditorRef.current = null;
    }
  }, [inlineSession, visibleTextActions.length]);

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
      // Escape steps OUT of an element before it clears anything: the region
      // that hosts it becomes the selection, and a second Escape is the
      // kernel's ordinary way out.
      if (key === 'Escape' && kernel.context.store.getState().elementFocus !== null) {
        kernel.clearElementFocus();
        return true;
      }
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
    [kernel, dir, slotOrder, editable],
  );

  /** Keyboard exits move focus before the focused editing chrome unmounts. */
  const endInlineEditFromKeyboard = useCallback(() => {
    returnFocusToEditorRef.current = null;
    hostRef.current?.focus({ preventScroll: true });
    sessionRef.current?.end();
  }, []);

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
  }, [endInlineEditFromKeyboard]);

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
    [kernel, beginInlineEdit, endInlineEditFromKeyboard],
  );

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
  ]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
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
      if (handleInlineKey(event.key)) {
        event.preventDefault();
        return;
      }
      if (handleTraversalKey(event.key, event.altKey)) {
        event.preventDefault();
      }
    },
    [handleTraversalKey, handleInlineKey, handleElementKey],
  );

  const onHostClick = useCallback(
    (event: React.MouseEvent) => {
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
    [kernel],
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
      endInlineEditFromSurfaceKeyboard();
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
                    onActions={reportTextActions}
                    requestFormattingMenuFocus={requestFormattingMenuFocus}
                    formattingMenuElement={floating?.text ?? null}
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
                  onActions={reportTextActions}
                  requestFormattingMenuFocus={requestFormattingMenuFocus}
                  formattingMenuElement={floating?.text ?? null}
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
    reportTextActions,
    requestFormattingMenuFocus,
    floating,
    endInlineEditFromSurfaceKeyboard,
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

  const elementFocus = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>) => state.elementFocus,
      [],
    ),
  );

  const selectedName = useMemo(() => {
    const node = selectedId === null ? undefined : doc.nodes[selectedId];
    if (node === undefined) {
      return null;
    }
    // A focused element is announced as the thing it is, inside the region
    // it belongs to — "Image in CV header" — never as the region alone.
    const located =
      elementFocus?.id === node.id
        ? customCodeElementAt(kernel, node.id, elementFocus.path)
        : undefined;
    if (located !== undefined) {
      return `${customCodeElementName(located.element)} in ${blockDisplayName(kernel, node.id)}`;
    }
    // The block's display name (its label, or the registry's name for the type) —
    // never its AI-facing description, which read ~1 KB aloud (fix pass).
    return blockDisplayName(kernel, node.id);
  }, [kernel, doc, selectedId, elementFocus]);

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
    [kernel, beginInlineEdit, selectedName],
  );

  // ── P7: the element quick bar ─────────────────────────────────────────────
  const emptyTargets = useMemo<readonly ElementTarget[]>(() => [], []);
  const subscribeSelection = useCallback(
    (listener: () => void) => selectionStore?.subscribe(listener) ?? (() => undefined),
    [selectionStore],
  );
  const readSelection = useCallback(
    () => selectionStore?.targets() ?? emptyTargets,
    [selectionStore, emptyTargets],
  );
  const selectedTargets = useSyncExternalStore(subscribeSelection, readSelection, readSelection);

  /** Primary first (the kernel's element focus), then the multi-selection's other tree members. */
  const elementTargets = useMemo<readonly Extract<ElementTarget, { kind: 'tree' }>[]>(() => {
    if (elementFocus?.id !== selectedId) {
      return [];
    }
    const primary = { kind: 'tree' as const, nodeId: elementFocus.id, path: [...elementFocus.path] };
    const extras = selectedTargets.filter(
      (target): target is Extract<ElementTarget, { kind: 'tree' }> =>
        target.kind === 'tree' &&
        !(
          target.nodeId === primary.nodeId &&
          target.path.length === primary.path.length &&
          target.path.every((value, at) => primary.path[at] === value)
        ),
    );
    return [primary, ...extras];
  }, [elementFocus, selectedId, selectedTargets]);
  const elementTargetsRef = useRef(elementTargets);
  useEffect(() => {
    elementTargetsRef.current = elementTargets;
    machineryRef.current?.controller.setExtraElements(
      elementTargets.slice(1).map((target) => ({ nodeId: target.nodeId, path: target.path })),
    );
  }, [elementTargets]);

  const quickModel = useMemo(
    () =>
      elementTargets[0] === undefined || doc.nodes[elementTargets[0].nodeId] === undefined
        ? undefined
        : createElementBarModel(kernel, elementTargets, {
            bucket,
            state: styleState,
            pageDir: dir,
            words: elementNameWords,
            namedStyles: namedStyleClasses,
            writeOptions: { symbolTree },
          }),
    [kernel, doc, elementTargets, bucket, styleState, dir, elementNameWords, namedStyleClasses, symbolTree],
  );
  const colorTokens = useMemo(() => themeColorSwatches(theme), [theme]);
  const paletteColors = useMemo(() => paletteSwatches(palette), [palette]);

  const actionContext = useMemo(
    () => ({
      bucket,
      styleClipboard: clipboard,
      ...(onSaveTemplate === undefined ? {} : { onSaveTemplate }),
      ...(onAnimate !== undefined
        ? { onAnimate }
        : onOpenStyleSector === undefined
          ? {}
          : {
              onAnimate: (target: ElementTarget) => {
                onOpenStyleSector('motion', target);
              },
            }),
    }),
    [bucket, clipboard, onSaveTemplate, onAnimate, onOpenStyleSector],
  );
  // Read at render time on purpose (cheap): Paste style enables the moment
  // Copy style fills the clipboard, and the copy re-renders for it.
  const elementActions =
    quickModel === undefined ? [] : resolveElementActions(kernel, elementTargets, actionContext);

  const runElementAction = useCallback(
    (id: ElementActionId) => {
      if (id === 'deselect') {
        hostRef.current?.focus({ preventScroll: true });
      }
      const result = performElementAction(kernel, elementTargetsRef.current, id, actionContext);
      if (id === 'copyStyle') {
        setClipboardNonce((current) => current + 1);
      }
      if (kernel.context.store.getState().elementFocus === null) {
        // The bar unmounts with the element focus; keyboard users land on the canvas.
        hostRef.current?.focus({ preventScroll: true });
      }
      announceGestureRef.current(result.announcement);
    },
    [kernel, actionContext],
  );

  const primaryTarget = elementTargets[0];
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
                setGestureMessage((current) => ({ text: result.message, nonce: current.nonce + 1 }));
              }
            },
          }),
    [treeSession, treeTextLabels],
  );

  const beginMoveFromHandle = useCallback(
    (hostX: number, hostY: number) => {
      const selected = kernel.context.store.getState().selection[0];
      if (selected !== undefined) {
        machineryRef.current?.beginMoveFromHandle(selected, hostX, hostY);
      }
    },
    [kernel],
  );

  const validFrameWidth =
    frameWidth !== undefined && Number.isFinite(frameWidth) && frameWidth >= 1
      ? frameWidth
      : undefined;
  const viewportStyle =
    validFrameWidth !== undefined
      ? { inlineSize: `${String(validFrameWidth * normalizedZoom)}px` }
      : normalizedZoom === 1
        ? undefined
        : { inlineSize: `${String(normalizedZoom * 100)}%` };
  const frameShellStyle = {
    ...(validFrameWidth === undefined
      ? normalizedZoom === 1
        ? {}
        : { inlineSize: `${String(100 / normalizedZoom)}%` }
      : { inlineSize: `${String(validFrameWidth)}px` }),
    ...(normalizedZoom === 1
      ? {}
      : {
          blockSize: `${String(100 / normalizedZoom)}%`,
          transform: `scale(${String(normalizedZoom)})`,
        }),
  };
  const hasFrameShellStyle = Object.keys(frameShellStyle).length > 0;

  return (
    <div
      ref={hostRef}
      className="bldr-canvas-host"
      role="region"
      aria-label={title}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={onHostClick}
    >
      <div
        className="bldr-canvas-viewport"
        data-testid="bldr-canvas-viewport"
        style={viewportStyle}
      >
        <div
          ref={frameShellRef}
          className="bldr-canvas-frame-shell"
          style={hasFrameShellStyle ? frameShellStyle : undefined}
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
            ? createPortal(
                <TextBubble
                  dir={dir}
                  actions={visibleTextActions}
                  onReturnFocus={returnFocusToEditor}
                />,
                floating.text,
              )
            : null}
          {/* The action bar belongs to a SELECTED block that is not busy being
            something else: not while a drag is in flight (US3/AC4), and not
            while its own text is open for editing — the bubble owns that
            moment, and two toolbars over one block is noise, not power. */}
          {/* P7: the tree text bubble — formatting a selected range of an
            element being edited in place, or the link address prompt. */}
          {floating !== null && treeSession !== null && (treeHasRange || linkRange !== null)
            ? createPortal(
                <TextBubble
                  dir={dir}
                  label={treeTextLabels.formatting}
                  actions={treeActions}
                  onReturnFocus={() => {
                    treeSession.refocus();
                    return true;
                  }}
                  prompt={
                    linkRange === null
                      ? undefined
                      : {
                          label: treeTextLabels.linkAddress,
                          submitLabel: treeTextLabels.apply,
                          cancelLabel: treeTextLabels.cancel,
                          onSubmit: (href) => {
                            const range = linkRange;
                            setLinkRange(null);
                            treeSession.suspendBlur(false);
                            const result = treeSession.format(
                              { mark: 'a', href, label: treeTextLabels.link },
                              range,
                            );
                            if (!result.ok) {
                              announceGestureRef.current(result.message);
                              treeSession.refocus();
                            }
                          },
                          onCancel: () => {
                            setLinkRange(null);
                            treeSession.suspendBlur(false);
                            treeSession.refocus();
                          },
                        }
                  }
                />,
                floating.text,
              )
            : null}
          {/* P7: with an element focused, its quick bar REPLACES the block
            action bar — every control and action there is the element's. */}
          {floating !== null &&
          editable &&
          !dragging &&
          !scrubbing &&
          inlineSession === null &&
          treeSession === null &&
          quickModel !== undefined &&
          primaryTarget !== undefined
            ? createPortal(
                <ElementQuickBar
                  model={quickModel}
                  actions={elementActions}
                  onAction={runElementAction}
                  onMore={(sector) => {
                    onOpenStyleSector?.(sector, primaryTarget);
                  }}
                  {...(onEditWithAi === undefined
                    ? {}
                    : {
                        onEditWithAi: () => {
                          onEditWithAi(primaryTarget);
                        },
                      })}
                  {...(onReplaceMedia === undefined
                    ? {}
                    : {
                        onReplaceMedia: () => {
                          onReplaceMedia(primaryTarget);
                        },
                      })}
                  onReturnFocus={() => {
                    hostRef.current?.focus({ preventScroll: true });
                  }}
                  onMovePointerDown={(hostX, hostY) => {
                    machineryRef.current?.beginTreeMove(
                      { kind: 'tree-move', id: primaryTarget.nodeId, path: primaryTarget.path },
                      hostX,
                      hostY,
                    );
                  }}
                  onAnnounce={(message) => {
                    announceGestureRef.current(message);
                  }}
                  dir={editorDir}
                  colorTokens={colorTokens}
                  palette={paletteColors}
                  namedStyles={namedStyles}
                  focusRequest={quickFocusRequest}
                  labels={quickBarLabels}
                />,
                floating.element,
              )
            : null}
          {floating !== null &&
          editable &&
          !dragging &&
          inlineSession === null &&
          quickModel === undefined &&
          selectedName !== null &&
          blockActions.length > 0
            ? createPortal(
                <BlockActionBar
                  label={`Actions for ${selectedName}`}
                  actions={blockActions}
                  onMovePointerDown={beginMoveFromHandle}
                  onAction={runBlockAction}
                  dir={dir}
                />,
                floating.block,
              )
            : null}
        </div>
      </div>
      <output className="bldr-visually-hidden" aria-live="polite" aria-label="Selection">
        {announcement}
        {selectionNonce % 2 === 1 ? '​' : ''}
      </output>
      <output className="bldr-visually-hidden" aria-live="polite" aria-label="Gesture">
        {gestureMessage.text}
        {gestureMessage.nonce % 2 === 1 ? '​' : ''}
      </output>
    </div>
  );
}
