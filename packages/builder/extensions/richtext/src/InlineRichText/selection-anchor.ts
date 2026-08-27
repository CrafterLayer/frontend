import { isNodeSelection, posToDOMRect, type Editor } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Selection → anchor derivation for the inline text bubble (009 contract §5 b4).
 *
 * REIMPLEMENTED LOGIC, NOT COPIED CODE — adapted from TipTap's bubble-menu
 * plugin, `packages/extension-bubble-menu/src/bubble-menu-plugin.ts` (v3.30.x,
 * MIT © ueberdosis GmbH) — see `vendor/VENDOR.md`. Taken from upstream: the
 * from/to rect through `posToDOMRect`, and the NodeSelection special case (the
 * anchor is the selected node's own element, preferring its node-view wrapper).
 * Added here: per-line client rects read from the view's own DOM range — a
 * selection spanning lines is several rects, not one union box, and the bubble
 * should hug the FIRST or LAST line (§2 p4). Upstream leaves that to
 * `@floating-ui/dom`'s `inline` middleware, a dependency research R2 rejects;
 * `posToDOMRect` ships in the already-pinned `@tiptap/core`.
 *
 * COORDINATE SPACE: every box is relative to the FRAME document's viewport —
 * the viewport of the editor's OWN document, exactly what `getClientRects`
 * reports there. Layer-local IS preview-local (005 §1), so the shell can hand
 * an anchor straight to `positionFloating` with no conversion.
 */

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Structurally identical to the shell's `FloatingAnchor` (`{ box, rects }`,
 * 009 contract §2) — declared here because this extension package must not
 * depend on the shell at runtime.
 */
export interface SelectionAnchor {
  /** The union box of the whole selection. */
  box: SelectionBox;
  /** Per-line rects, in document order; never empty (falls back to `box`). */
  rects: SelectionBox[];
}

const toBox = (rect: { x: number; y: number; width: number; height: number }): SelectionBox => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
});

/** A collapsed caret has height; a rect with neither dimension is DOM noise. */
const hasArea = (box: SelectionBox): boolean => box.width > 0 || box.height > 0;

/**
 * Cross-realm-safe element check: the editor's DOM belongs to the FRAME
 * document, so a host-realm `instanceof HTMLElement` would be false there —
 * the exact bare-global bug class research R3 item 8 warns about.
 */
const asElement = (node: Node | null): Element | null =>
  node !== null && node.nodeType === Node.ELEMENT_NODE ? (node as Element) : null;

/**
 * The editor's live, attached view — or null. tiptap v3's `view` getter
 * answers with a proxy that THROWS for most members until the editor is
 * mounted, and `isInitialized` only flips in a deferred timeout after mount,
 * so the one dependable signal is whether the view's DOM is reachable and
 * attached. Never throws.
 */
export function liveViewOf(editor: Editor): EditorView | null {
  if (editor.isDestroyed) {
    return null;
  }
  try {
    const view = editor.view;
    return view.dom.parentNode === null ? null : view;
  } catch {
    return null;
  }
}

/** Per-line rects from the view's own document range; `fallback` on any DOM refusal. */
function lineRects(
  view: EditorView,
  from: number,
  to: number,
  fallback: SelectionBox,
): SelectionBox[] {
  try {
    const range = view.dom.ownerDocument.createRange();
    const start = view.domAtPos(from);
    const end = view.domAtPos(to);
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const rects = Array.from(range.getClientRects(), toBox).filter(hasArea);
    return rects.length > 0 ? rects : [fallback];
  } catch {
    // jsdom implements neither selection geometry nor every range position; a
    // rect the DOM cannot produce degrades to the union box, never a throw.
    return [fallback];
  }
}

/**
 * The anchor of the editor's CURRENT selection, in frame-viewport coordinates,
 * or `null` for an editor that has no live view (destroyed, never mounted, or
 * detached). Never throws. A collapsed selection still yields its caret rect —
 * visibility is `shouldShowBubble`'s decision, not geometry's.
 */
export function selectionAnchorOf(editor: Editor): SelectionAnchor | null {
  const view = liveViewOf(editor);
  if (view === null) {
    return null;
  }
  const { selection } = editor.state;

  // Upstream's NodeSelection case: anchor on the selected node's own element,
  // preferring a node-view wrapper when the node renders one.
  if (isNodeSelection(selection)) {
    const element = asElement(view.nodeDOM(selection.from));
    if (element !== null) {
      const target = element.hasAttribute('data-node-view-wrapper')
        ? element
        : (element.querySelector('[data-node-view-wrapper]') ?? element);
      const box = toBox(target.getBoundingClientRect());
      const rects = Array.from(target.getClientRects(), toBox).filter(hasArea);
      return { box, rects: rects.length > 0 ? rects : [box] };
    }
  }

  const box = toBox(posToDOMRect(view, selection.from, selection.to));
  return { box, rects: lineRects(view, selection.from, selection.to, box) };
}
