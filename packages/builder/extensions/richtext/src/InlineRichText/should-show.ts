import { isTextSelection, type Editor } from '@tiptap/core';

import { liveViewOf } from './selection-anchor';

/**
 * The text bubble's visibility predicate (009 contract §5 b1/b4).
 *
 * REIMPLEMENTED LOGIC, NOT COPIED CODE — the default `shouldShow` of TipTap's
 * bubble-menu plugin, `packages/extension-bubble-menu/src/bubble-menu-plugin.ts`
 * (v3.30.x, MIT © ueberdosis GmbH) — see `vendor/VENDOR.md`. Same decisions:
 * hidden for a non-editable editor, an empty selection, a selection inside an
 * empty text block, and an unfocused view — UNLESS the menu itself owns focus,
 * so clicking a bubble control never dismisses the bubble it lives in. One fix
 * over upstream: it reads the bare global `document.activeElement` (the
 * cross-document bug class research R3 item 8 catalogues), so focus is resolved
 * against the MENU's own document here. `isTextSelection` comes from the
 * already-pinned `@tiptap/core` — no new package (research R2).
 *
 * Pure: reads the editor and the optional menu element, mutates nothing.
 */
export function shouldShowBubble(editor: Editor, menuElement?: Element | null): boolean {
  // A destroyed or never-mounted editor has no live view — nothing to show.
  const view = liveViewOf(editor);
  if (view === null || !editor.isEditable) {
    return false;
  }
  const { doc, selection } = editor.state;

  // The menu owning focus keeps the bubble alive across a control click.
  const activeElement = menuElement?.ownerDocument.activeElement ?? null;
  const menuOwnsFocus =
    menuElement !== undefined &&
    menuElement !== null &&
    activeElement !== null &&
    menuElement.contains(activeElement);
  if (!view.hasFocus() && !menuOwnsFocus) {
    return false;
  }
  if (selection.empty) {
    return false;
  }
  // A range across empty text blocks selects nothing the user could format.
  const isEmptyTextBlock =
    doc.textBetween(selection.from, selection.to).length === 0 && isTextSelection(selection);
  return !isEmptyTextBlock;
}
