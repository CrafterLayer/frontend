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
// library-playground additions (2026-10-08): the frame's <html lang> follows the page.
import { useFrameLang } from './frame-lang';
// end library-playground additions
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
  // ── block-parts (2026-10-06) ──
  type ElementAction,
  // ── /block-parts ──
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
import type { DropTarget } from '../../overlay/drop-resolver';
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
import { COLOR_ROLE_NAMES_AR } from '../DesignSystemPanel/DesignSystemPanel.labels';
import {
  bucketForBreakpoint,
  elementDomOf,
  focusedTreeTarget,
  unlockedPath,
} from './element-canvas-helpers';
import { performMoveAction, resolveMoveAction } from '../../keyboard/move-actions';
import { blockDisplayName } from '../../naming/block-display-name';
import { customCodeElementName } from '../../naming/custom-code-element-name';
import { EDITOR_CANVAS_LABELS_EN, type EditorCanvasLabels } from './EditorCanvas.labels';
import { useCanvasZoom } from './canvas-zoom';
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
// ── block-parts (2026-10-06) ── the docked formatting bar
import {
  RICH_TEXT_ACTION_LABELS_AR,
  RICH_TEXT_ACTION_LABELS_EN,
  localizeRichActions,
  measureInlineDock,
  withDockFallback,
  type RichTextActionLabels,
} from '../../overlay/inline-dock-anchor';
// ── /block-parts ──
import {
  createInlineSession,
  inlineTargetOf,
  partInlineTargetOf,
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
// ── block-parts (2026-10-06) ──
import { PART_OWNER_ATTRIBUTE, getAtPropPath, parsePropPath, type PartRef } from '@craftkit/builder-schema';

import { beginInPlaceTextEdit, type InPlaceTextEdit } from '../../overlay/in-place-text-edit';
import { partInlineCommit } from '../../overlay/part-inline';
import { cancelCanvasActivation } from './canvas-activation-guard';
import {
  enclosingItemRef,
  firstPart,
  firstPartInside,
  partChipLabel,
  partDeclOf,
  partInstanceName,
  partsOfNode,
  partTarget,
  steppedPart,
  type PartTarget,
} from '../../overlay/part-target';
import {
  createPartBarModel,
  dispatchPartPlan,
  partStringValue,
  performPartAction,
  planPartLinkValue,
  quickGroupsForPart,
  resolvePartActions,
  PART_QUICK_BAR_LABELS_EN,
  type PartActionId,
  type PartLinkPage,
} from '../ElementQuickBar';
// ── /block-parts ──
import '../../styles/visually-hidden.css';
import './EditorCanvas.css';

// gsap-pixi additions (2026-10-08): engines on registered blocks RUN on the canvas (never taking
// pointer input); one stable object, so the frame never re-mounts them on a re-render.
const CANVAS_SITE_ENGINES = { interactive: false } as const;
// end gsap-pixi additions

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
  // gsap-pixi additions (2026-10-08)
  /**
   * Block action "Animate" on a selected registered block that declares a
   * motion control: the host opens the Inspector's Design › Motion (Cinematic
   * motion, Animated background). Absent ⇒ no Animate action on blocks.
   */
  onAnimateBlock?: ((nodeId: NodeId) => void) | undefined;
  // ── end gsap-pixi additions ──
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
  /**
   * Labels for the rich inline editor's formatting bar, by action id. Default:
   * the `canvasLabels` locale's set (Arabic for an Arabic canvas).
   */
  richTextLabels?: RichTextActionLabels | undefined;
  /** Element names in labels and announcements. */
  elementNameWords?: ElementNameWords | undefined;
  /** The EDITOR UI direction (roving arrows in the quick bar). Default `ltr`. */
  editorDir?: 'ltr' | 'rtl' | undefined;
  /** The canvas's announcements in the editor's language (arabic-editor); English by default. */
  canvasLabels?: EditorCanvasLabels | undefined;
  /** Test-only geometry for tree drops (jsdom has no layout). */
  treeDropPorts?: Partial<TreeDropPorts> | undefined;
  /**
   * The site's symbol masters by id: an element inside a symbol instance gets
   * its quick bar, which writes the instance's overrides (fix pass, §G).
   */
  symbolTree?: ((symbolId: string) => CustomCodeRoot | undefined) | undefined;
  // ── block-parts (2026-10-06) ──
  /**
   * An image PART of a registered block was double-clicked, or its quick bar
   * asked to replace it: the host opens its asset picker, then writes the
   * chosen asset with `planPartValue('src' / 'alt')`. Absent ⇒ Replace is disabled.
   */
  onReplacePartImage?: ((target: PartTarget) => void) | undefined;
  /** A part's quick bar "More": open the side panel's part Design tab at this sector. */
  onOpenPartStyle?: ((sector: StyleSectorId, target: PartTarget) => void) | undefined;
  /** A part's quick bar "Edit with AI": prefill the composer with the part's address. Absent ⇒ no sparkle. */
  onEditWithAiPart?: ((target: PartTarget) => void) | undefined;
  /** The site's pages, offered by a link part's address picker. */
  linkPages?: readonly PartLinkPage[] | undefined;
  // ── /block-parts ──
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
  beginInsert(type: string, hostX: number, hostY: number, onDrop?: (target: DropTarget) => void): { didActivate: () => boolean };
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
    options?: Pick<Extract<TreeDragPayload, { kind: 'tree-insert' }>, 'onDrop' | 'fallback'>,
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
  return isDomNode(target) && target.nodeType === 1 && (target as Element).closest(EDITABLE_TARGET_SELECTOR) !== null;
}

/** Frame event targets belong to another realm: host instanceof Node rejects them. */
function isDomNode(target: EventTarget | null): target is Node {
  return target !== null && 'nodeType' in target;
}

// ── block-parts (2026-10-06) ──
/** A part's bar has no element actions; its own row comes from `resolvePartActions`. */
const NO_ELEMENT_ACTIONS: readonly ElementAction[] = [];
const ignoreElementAction = (): void => undefined;

/**
 * "Heading in Hero" — but never a name inside itself: a button block named for
 * its label read "Button label · Get started in Get started", and an icon
 * "Icon (sparkles) in Icon" (walk 2026-10-08). When the element's own name
 * already carries the region's, the region is left out.
 */
function nameWithin(labels: Pick<EditorCanvasLabels, 'within'>, element: string, region: string): string {
  const own = element.trim();
  const around = region.trim();
  if (around === '' || own.toLocaleLowerCase().includes(around.toLocaleLowerCase())) return own;
  return labels.within(own, around);
}

/** The anchor path that means "the focused part" (no authored element path is negative). */
const PART_ANCHOR_PATH = [-1] as const;

/** What the floating bars anchor to: the focused element's path, the part sentinel, or the block. */
function anchorPathOf(
  state: ReturnType<BuilderKernel['context']['store']['getState']>,
  selected: NodeId | null,
): readonly number[] | null {
  const focus = state.elementFocus;
  if (focus !== null && focus.id === selected) return focus.path;
  const partFocus = state.partFocus ?? null;
  if (partFocus !== null && partFocus.id === selected) return PART_ANCHOR_PATH;
  return null;
}
// ── /block-parts ──

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
  onAnimateBlock, // gsap-pixi additions (2026-10-08)
  onReplaceMedia,
  onShortcut,
  styleClipboard,
  palette,
  namedStyles,
  namedStyleClasses,
  quickBarLabels = ELEMENT_QUICK_BAR_LABELS_EN,
  treeTextLabels = TREE_TEXT_ACTION_LABELS_EN,
  richTextLabels,
  elementNameWords = ELEMENT_NAME_WORDS_EN,
  editorDir = 'ltr',
  canvasLabels = EDITOR_CANVAS_LABELS_EN,
  treeDropPorts,
  symbolTree,
  // ── block-parts (2026-10-06) ──
  onReplacePartImage,
  onOpenPartStyle,
  onEditWithAiPart,
  linkPages,
  // ── /block-parts ──
}: EditorCanvasProps) {
  // Read by imperative chrome (chips, gesture announcements) without re-creating it.
  const canvasLabelsRef = useRef(canvasLabels);
  const wordsRef = useRef(elementNameWords);
  useEffect(() => {
    canvasLabelsRef.current = canvasLabels;
    wordsRef.current = elementNameWords;
  }, [canvasLabels, elementNameWords]);
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
  // library-playground additions (2026-10-08): root `lang` prop, else ar for rtl / en for ltr.
  useFrameLang(kernel, frame);
  // end library-playground additions
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

  // ── block-parts (2026-10-06) ──
  /**
   * Typing in place on a part a PARENT draws for this node (a tab trigger,
   * `data-ck-part-owner`). The node's own render never draws that text, so
   * the inline-edit seam cannot swap an editor into it; the drawn element is
   * edited where it is instead (in-place-text-edit.ts), and the commit takes
   * the part planner's door: ONE labelled transaction, one Undo.
   */
  const forwardedEditRef = useRef<InPlaceTextEdit | null>(null);
  const beginForwardedPartText = useCallback(
    (nodeId: NodeId, part: PartRef): boolean => {
      const element = machineryRef.current?.index.partElement?.(nodeId, part) ?? null;
      const target = partInlineTargetOf(kernel, nodeId, part);
      const node = kernel.getDocument().nodes[nodeId];
      if (element === null || target?.kind !== 'text' || node === undefined) {
        return false;
      }
      const stored = getAtPropPath(node.props, parsePropPath(target.bind));
      if (typeof stored !== 'string') {
        return false;
      }
      treeSessionRef.current?.commit();
      sessionRef.current?.end();
      forwardedEditRef.current?.commit();
      const session: InlineSession = { nodeId, ...target };
      const name = partInstanceName(kernel, nodeId, part, canvasLabelsRef.current.locale ?? 'en');
      const opened: InPlaceTextEdit = beginInPlaceTextEdit({
        element,
        storedText: stored,
        singleLine: target.singleLine,
        label: name,
        onCommit: (text) => {
          const result = partInlineCommit(kernel, session, text);
          return result.ok ? { ok: true } : { ok: false, message: result.message };
        },
        onEnd: (outcome, exit, message) => {
          if (forwardedEditRef.current === opened) {
            forwardedEditRef.current = null;
          }
          layerRef.current?.classList.remove('bldr-overlay--tree-editing');
          machineryRef.current?.anchors.refresh();
          if (outcome === 'rejected' && message !== undefined) {
            announceGestureRef.current(message);
          }
          if (exit === 'keyboard') {
            hostRef.current?.focus({ preventScroll: true });
          }
        },
      });
      forwardedEditRef.current = opened;
      layerRef.current?.classList.add('bldr-overlay--tree-editing');
      machineryRef.current?.anchors.refresh();
      announceGestureRef.current(canvasLabelsRef.current.editing(name));
      return true;
    },
    [kernel],
  );
  // Any other write while the trigger is open (an agent, Undo) ends the edit
  // FIRST, so React's own nodes are back before it reconciles them; unmount
  // keeps what was typed.
  useEffect(() => {
    const off = kernel.context.events.on('tx.applied', () => {
      forwardedEditRef.current?.commit();
    });
    return () => {
      off();
      forwardedEditRef.current?.commit();
    };
  }, [kernel]);
  // `part`: open that part's bound value instead of `inlineEditable`.
  const beginInlineEdit = useCallback((nodeId: NodeId, entry: InlineEditEntryIntent, part?: PartRef): boolean => {
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
        : machineryRef.current?.index.partElement?.(nodeId, part)?.hasAttribute(PART_OWNER_ATTRIBUTE) === true;
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
  }, [beginForwardedPartText]);

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
    [frame],
  );

  const [gestureMessage, setGestureMessage] = useState({ text: '', nonce: 0 });
  const announceGestureRef = useRef((message: string) => {
    setGestureMessage((current) => ({ text: message, nonce: current.nonce + 1 }));
  });
  const suppressClickRef = useRef(false);
  const onDragHandleRef = useRef(onDragHandle);
  const onToolErrorRef = useRef(onToolError);
  // ── block-parts (2026-10-06) ──
  // Read by the frame listeners, which must not re-subscribe per host render.
  const onReplacePartImageRef = useRef(onReplacePartImage);
  // ── /block-parts ──
  useEffect(() => {
    onDragHandleRef.current = onDragHandle;
    onToolErrorRef.current = onToolError;
    // ── block-parts (2026-10-06) ──
    onReplacePartImageRef.current = onReplacePartImage;
    // ── /block-parts ──
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
      // ── block-parts (2026-10-06) ── the bar never covers the part it edits
      keepClear: true,
      // ── /block-parts ──
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

    // ── block-parts (2026-10-06) ──
    // The floating bars anchor to a focused PART the way they anchor to a
    // focused element: the channel asks `elementRect` for the anchor path, and
    // the part sentinel path answers with the part's own rect (falling back
    // to the block's when the instance is gone).
    const anchorIndex: RectIndex = {
      ...index,
      elementRect: (id, path) => {
        const partFocus = kernel.context.store.getState().partFocus ?? null;
        if (path.length === 1 && path[0] === PART_ANCHOR_PATH[0]) {
          return partFocus !== null && partFocus.id === id ? index.partRect?.(id, partFocus) : undefined;
        }
        return index.elementRect?.(id, path);
      },
    };
    // ── /block-parts ──
    const anchors = createAnchorChannel({
      index: anchorIndex,
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
        !isDomNode(event.target) ||
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
      // ── block-parts (2026-10-06) ── outside authored elements, the part under the pointer
      controller.setHover(hit?.nodeId ?? null, hoverPath, hoverPath === undefined ? hit?.part : undefined);
      // ── /block-parts ──
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
      // ── block-parts (2026-10-06) ── a link or submit in a block selects, never navigates
      cancelCanvasActivation(event);
      // ── /block-parts ──
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return; // a completed drop already set the selection
      }
      // A click inside text being edited in place places the caret: it is the
      // editor's, and pulling focus to the host would end the edit.
      const editing = treeSessionRef.current;
      if (editing !== null && isDomNode(event.target) && editing.element.contains(event.target)) {
        return;
      }
      const hit = hitAt(event.clientX, event.clientY);
      // Locked elements pass clicks to their parent; all-locked lands on the region.
      const path =
        hit?.elementPath === undefined ? undefined : unlockedPath(kernel, hit.nodeId, hit.elementPath);
      if (hit === undefined) {
        kernel.setSelection([]);
      // ── block-parts (2026-10-06) ──
      } else if (path === undefined && hit.part !== undefined && !event.shiftKey) {
        // A registered block's part, the GrapesJS way: the click means the
        // heading (or the third card's title), and it selects its block too.
        kernel.focusPart(hit.nodeId, { part: hit.part.part, index: hit.part.index });
      // ── /block-parts ──
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
        beginInsert(type, hostX, hostY, onDrop) {
          const start = toFrame(hostX, hostY);
          session.press({ kind: 'insert', type, onDrop }, start.x, start.y, 'handle');
          return { didActivate: () => session.lastGestureActivated() };
        },
        beginTreeInsert(node, label, hostX, hostY, options) {
          const start = toFrame(hostX, hostY);
          session.press({ kind: 'tree-insert', node, label, ...options }, start.x, start.y, 'handle');
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

  // Zoom reaches the chrome that must keep its own size (floating hosts, layer CSS).
  useCanvasZoom(normalizedZoom, zoomRef, layerRef, machineryRef, frame);

  /*
    A new screen size keeps the selection — and keeps it IN VIEW. At a narrower
    frame the page reflows taller, so the element a person picked on desktop
    sat thousands of pixels below the fold on mobile: the outline and quick
    bar hid with it, and the selection read as lost (final test, 2026-10-06).
    Only a width change scrolls; the first render never does.
  */
  const sizedFor = useRef<string | null>(null);
  useEffect(() => {
    const key = `${String(frameWidth)}:${breakpoint ?? 'desktop'}`;
    const previous = sizedFor.current;
    sizedFor.current = key;
    if (previous === null || previous === key || frame === null) return undefined;
    let second = 0;
    const first = requestAnimationFrame(() => {
      // Two frames: the breakpoint's re-render lands, then its layout settles.
      second = requestAnimationFrame(() => {
        const machinery = machineryRef.current;
        const state = kernel.context.store.getState();
        const focus = state.elementFocus;
        const selected = state.selection[0];
        const element =
          focus !== null && machinery !== null
            ? elementDomOf(machinery.index, focus.id, focus.path)
            : selected === undefined
              ? null
              : (elementsRef.current.get(selected) ?? null);
        try {
          element?.scrollIntoView({ block: 'center', inline: 'nearest' });
        } catch {
          // A document without layout (jsdom) has nothing to scroll.
        }
        machinery?.anchors.refresh();
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [frameWidth, breakpoint, frame, kernel]);

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

  // ── block-parts (2026-10-06) ── the editor's actions in the editor's language
  const richLabels =
    richTextLabels ??
    (canvasLabels.locale === 'ar' ? RICH_TEXT_ACTION_LABELS_AR : RICH_TEXT_ACTION_LABELS_EN);
  const visibleTextActions = useMemo(
    () => (inlineSession === null ? NO_ACTIONS : localizeRichActions(textActions, richLabels)),
    [inlineSession, textActions, richLabels],
  );
  // ── /block-parts ──

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

  // ── block-parts (2026-10-06) ──
  // Part gestures (block-parts DESIGN §2.7). The words are read through refs:
  // these handlers live on the frame document and must not re-subscribe.
  const partWordsRef = useRef(quickBarLabels.parts ?? PART_QUICK_BAR_LABELS_EN);
  const partScopeRef = useRef<'all' | 'this'>('all');
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
    [kernel, editable, beginInlineEdit],
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
    (event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>): boolean => {
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
        announceGestureRef.current(performPartAction(kernel, partTarget(nodeId, ref), id, context).announcement);
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
      if ((event.key === 'Delete' || event.key === 'Backspace') && !event.altKey && decl.kind === 'item') {
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
    [kernel, editable, activatePart],
  );
  // ── /block-parts ──

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
          if (activatePart(elementHit.nodeId, ref, { kind: 'pointer', clientX: event.clientX, clientY: event.clientY })) {
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
    [handleTraversalKey, handleInlineKey, handleElementKey, handlePartKey],
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
    // ── block-parts (2026-10-06) ──
    // A PART session edits a nested bound value: NodeView swaps the editor in
    // at `bind`, the surface is named after the part, and the commit goes
    // through the part planner as ONE labelled transaction (one Undo).
    const session = inlineSession;
    const bind = session.bind;
    const part = session.part;
    const label =
      bind === undefined || part === undefined
        ? propKey
        : partInstanceName(kernel, nodeId, part, canvasLabels.locale ?? 'en');
    const singleLine = session.singleLine ?? true;
    // ── /block-parts ──
    const commit = (next: unknown) => {
      // ── block-parts (2026-10-06) ──
      if (bind !== undefined) {
        const result = partInlineCommit(kernel, session, next);
        if (result.ok) {
          setInlineRejection(null);
        } else {
          setInlineRejection(result.message);
          announceGestureRef.current(result.message);
        }
        return;
      }
      // ── /block-parts ──
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
        // ── block-parts (2026-10-06) ──
        ...(bind === undefined ? {} : { bind }),
        // ── /block-parts ──
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
                    label={label}
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
                  label={label}
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
                  label={label}
                  singleLine={singleLine}
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
    // ── block-parts (2026-10-06) ──
    canvasLabels,
    // ── /block-parts ──
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

  // ── block-parts (2026-10-06) ──
  const partFocus = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>) => state.partFocus ?? null,
      [],
    ),
  );
  // ── /block-parts ──

  /*
    A selection made OUTSIDE the canvas — a library card inserting at the end
    of the page, a Layers row, the agent — is brought into view when it sits
    wholly off screen (walk 2026-10-08: an inserted Icon landed 8229px down
    while the canvas stayed at the top, and nothing visible changed). A click
    on the canvas selects something already on screen, so this never moves it.
  */
  useEffect(() => {
    if (frame === null || (selectedId === null && elementFocus === null)) return undefined;
    let second = 0;
    const first = requestAnimationFrame(() => {
      // Two frames: the insert's render lands, then its layout settles.
      second = requestAnimationFrame(() => {
        const machinery = machineryRef.current;
        const element =
          elementFocus !== null && machinery !== null
            ? elementDomOf(machinery.index, elementFocus.id, elementFocus.path)
            : selectedId === null
              ? null
              : (elementsRef.current.get(selectedId) ?? null);
        const view = element?.ownerDocument.defaultView;
        if (element == null || view == null) return;
        const rect = element.getBoundingClientRect();
        const offScreen = rect.bottom < 0 || rect.top > view.innerHeight;
        if (!offScreen) return;
        try {
          const still = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
          element.scrollIntoView({ block: rect.height > view.innerHeight ? 'start' : 'center', inline: 'nearest', behavior: still ? 'auto' : 'smooth' });
        } catch {
          // A document without layout (jsdom) has nothing to scroll.
        }
        machinery?.anchors.refresh();
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [selectedId, elementFocus, frame]);

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
    () => (selectedName === null ? canvasLabels.selectionCleared : canvasLabels.selected(selectedName)),
    [selectedName, canvasLabels],
  );

  // gsap-pixi additions (2026-10-08): "Animate" joins the bar when the host can open Design › Motion.
  const animateLocale = canvasLabels.locale ?? 'en';
  const canAnimateBlock = onAnimateBlock !== undefined;
  const blockActions = useMemo(
    () =>
      selectedId === null || doc.nodes[selectedId] === undefined
        ? []
        : resolveBlockActions(kernel, selectedId, canAnimateBlock ? { animate: { locale: animateLocale } } : {}),
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
    [kernel, beginInlineEdit, selectedName, onAnimateBlock], // gsap-pixi additions: + onAnimateBlock
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
  // The colour roles in the editor's language (fix pass 2026-10-06).
  const quickBarLocale = quickBarLabels.locale;
  const colorTokens = useMemo(
    () => themeColorSwatches(theme, quickBarLocale === 'ar' ? COLOR_ROLE_NAMES_AR : undefined),
    [theme, quickBarLocale],
  );
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

  // ── block-parts (2026-10-06) ──
  // The quick bar over a focused PART of a registered block (DESIGN §2.14):
  // the same bar, its model writing `partStyles` in tokens mode and bound
  // values through the part planners — one transaction per control.
  const focusedPart = useMemo<PartTarget | undefined>(
    () =>
      partFocus !== null && partFocus.id === selectedId ? partTarget(partFocus.id, partFocus) : undefined,
    [partFocus, selectedId],
  );
  // The scope switch belongs to ONE part name on one node; moving on resets it.
  const focusedPartKey = focusedPart === undefined ? '' : `${focusedPart.nodeId}|${focusedPart.part}`;
  const [partScopeState, setPartScopeState] = useState<{ key: string; scope: 'all' | 'this' }>({
    key: '',
    scope: 'all',
  });
  // A click on an indexed instance ("Feature 1") means THAT instance: the bar
  // names one item, so styling starts on it, and the scope switch widens it.
  const partScope =
    partScopeState.key === focusedPartKey
      ? partScopeState.scope
      : (focusedPart?.index.length ?? 0) > 0
        ? 'this'
        : 'all';
  useEffect(() => {
    partScopeRef.current = partScope;
  }, [partScope]);
  const partLocale = canvasLabels.locale ?? 'en';
  const partWords = quickBarLabels.parts ?? PART_QUICK_BAR_LABELS_EN;
  const partModel = useMemo(
    () =>
      focusedPart === undefined || doc.nodes[focusedPart.nodeId] === undefined
        ? undefined
        : createPartBarModel(kernel, focusedPart, {
            bucket,
            state: styleState,
            pageDir: dir,
            scope: partScope,
            locale: partLocale,
            words: elementNameWords,
            namedStyles: namedStyleClasses,
          }),
    [kernel, doc, focusedPart, bucket, styleState, dir, partScope, partLocale, elementNameWords, namedStyleClasses],
  );
  const partDecl =
    focusedPart === undefined ? undefined : partDeclOf(kernel, focusedPart.nodeId, focusedPart.part);
  const partGroups = useMemo(
    () => (partModel === undefined ? undefined : quickGroupsForPart(partModel.kind, partDecl?.styleSections)),
    [partModel, partDecl],
  );
  const partActionContext = useMemo(
    () => ({ scope: partScope, locale: partLocale, words: partWords, nameWords: elementNameWords, editable }),
    [partScope, partLocale, partWords, elementNameWords, editable],
  );
  // Read at render time on purpose (cheap): the gates follow every edit.
  const partActions =
    focusedPart === undefined || partModel === undefined
      ? []
      : resolvePartActions(kernel, focusedPart, partActionContext);
  const runPartAction = useCallback(
    (id: PartActionId) => {
      const target = focusedPart;
      if (target === undefined) {
        return;
      }
      if (id === 'editText') {
        activatePart(target.nodeId, target, { kind: 'keyboard' });
        return;
      }
      if (id === 'scopeThis') {
        const next = partScope === 'this' ? 'all' : 'this';
        setPartScopeState({ key: focusedPartKey, scope: next });
        announceGestureRef.current(
          next === 'this' ? partWords.actions.scopeThis : partInstanceName(kernel, target.nodeId, { part: target.part, index: [] }, partLocale),
        );
        return;
      }
      if (id === 'selectBlock') {
        // Focus moves FIRST: the bar unmounts with the part focus.
        hostRef.current?.focus({ preventScroll: true });
      }
      const result = performPartAction(kernel, target, id, partActionContext);
      if ((kernel.context.store.getState().partFocus ?? null) === null) {
        hostRef.current?.focus({ preventScroll: true });
      }
      announceGestureRef.current(result.announcement);
    },
    [kernel, focusedPart, focusedPartKey, partScope, partWords, partLocale, partActionContext, activatePart],
  );
  const partLink = useMemo(() => {
    const node = focusedPart === undefined ? undefined : doc.nodes[focusedPart.nodeId];
    if (focusedPart === undefined || node === undefined || partDecl?.kind !== 'link') {
      return undefined;
    }
    return {
      text: partStringValue(node, partDecl, focusedPart, 'text') ?? '',
      href: partStringValue(node, partDecl, focusedPart, 'href') ?? '',
      pages: linkPages,
      onApply: (value: { readonly text: string; readonly href: string }) =>
        dispatchPartPlan(kernel, planPartLinkValue(kernel, focusedPart, value)),
    };
  }, [kernel, doc, focusedPart, partDecl, linkPages]);
  // ── /block-parts ──

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
          <CanvasFrame
            theme={theme}
            dir={dir}
            title={title}
            onFrame={setFrame}
            siteEngines={CANVAS_SITE_ENGINES} /* gsap-pixi additions (2026-10-08) */
          >
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
                  label={richLabels.formatting}
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
          {/* ── block-parts (2026-10-06) ── with a PART focused, its quick bar
            REPLACES the block action bar, as an element focus does. It is
            never shown over an open inline editor. */}
          {floating !== null &&
          editable &&
          !dragging &&
          !scrubbing &&
          inlineSession === null &&
          treeSession === null &&
          quickModel === undefined &&
          partModel !== undefined &&
          focusedPart !== undefined
            ? createPortal(
                <ElementQuickBar
                  model={partModel}
                  actions={NO_ELEMENT_ACTIONS}
                  onAction={ignoreElementAction}
                  groups={partGroups}
                  partActions={partActions}
                  onPartAction={runPartAction}
                  partLink={partLink}
                  onMore={(sector) => {
                    onOpenPartStyle?.(sector, focusedPart);
                  }}
                  {...(onEditWithAiPart === undefined
                    ? {}
                    : {
                        onEditWithAi: () => {
                          onEditWithAiPart(focusedPart);
                        },
                      })}
                  {...(onReplacePartImage === undefined
                    ? {}
                    : {
                        onReplaceMedia: () => {
                          onReplacePartImage(focusedPart);
                        },
                      })}
                  onReturnFocus={() => {
                    hostRef.current?.focus({ preventScroll: true });
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
          {/* ── /block-parts ── */}
          {floating !== null &&
          editable &&
          !dragging &&
          inlineSession === null &&
          quickModel === undefined &&
          // ── block-parts (2026-10-06) ──
          partModel === undefined &&
          // ── /block-parts ──
          selectedName !== null &&
          blockActions.length > 0
            ? createPortal(
                <BlockActionBar
                  label={canvasLabels.actionsFor(selectedName)}
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
      <output className="bldr-visually-hidden" aria-live="polite" aria-label={canvasLabels.selectionRegion}>
        {announcement}
        {selectionNonce % 2 === 1 ? '​' : ''}
      </output>
      <output className="bldr-visually-hidden" aria-live="polite" aria-label={canvasLabels.gestureRegion}>
        {gestureMessage.text}
        {gestureMessage.nonce % 2 === 1 ? '​' : ''}
      </output>
    </div>
  );
}
