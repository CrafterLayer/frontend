import type { BuilderKernel } from '@craftkit/builder-core';
import type { RenderBreakpoint, Theme } from '@craftkit/builder-renderer';
import type {
  CustomCodeNode,
  CustomCodeRoot,
  NodeId,
  PaletteColor,
  StyleBucket,
  StyleSectorId,
  StyleState,
} from '@craftkit/builder-schema';

import type { ElementNameWords, ElementTarget } from '../../custom-code/element-target';
import type { AnchorChannel } from '../../overlay/anchor-channel';
import type { DragSession } from '../../overlay/drag-session';
import type { DropTarget } from '../../overlay/drop-resolver';
import type { StyleClipboard } from '../../overlay/element-actions';
import type { ElementHandles } from '../../overlay/element-handles';
import type { FloatingHostPorts } from '../../overlay/floating-host';
import type { ForcedStatePreview } from '../../overlay/forced-state';
import type { GridOverlay } from '../../overlay/grid-overlay';
import type { RichTextActionLabels } from '../../overlay/inline-dock-anchor';
import type { OverlayController } from '../../overlay/overlay-controller';
import type { PartTarget } from '../../overlay/part-target';
import type { ToolHost } from '../../overlay/tool-host';
import type { TreeDragPayload, TreeDropPorts } from '../../overlay/tree-drop-resolver';
import type { TreeTextActionLabels } from '../../overlay/tree-text-actions';
import type { GeometryPorts, RectIndex } from '../../rects';
import type { ElementSelection } from '../../selection/element-selection';
import type { ElementQuickBarLabels, NamedStyleChoice, PartLinkPage } from '../ElementQuickBar';
import type { EditorCanvasLabels } from './EditorCanvas.labels';

/*
  The canvas's public contract (props and the two host handles) and the
  internal shapes its modules hand each other. Types only.
*/

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
  beginInsert(
    type: string,
    hostX: number,
    hostY: number,
    onDrop?: (target: DropTarget) => void,
  ): { didActivate: () => boolean };
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

/** The plain-TS machinery one frame mount builds (and its cleanup tears down). */
export interface Machinery {
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
export interface FloatingMounts {
  text: HTMLElement;
  block: HTMLElement;
  /** The element quick bar: above the element, flipping below when clipped (§A.6). */
  element: HTMLElement;
}
