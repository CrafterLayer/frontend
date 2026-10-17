import type { InlineFormatAction } from '@craftkit/builder-schema';

import type { FloatingAnchor } from './floating-position';

/*
  ── The docked formatting bar (block-parts, 2026-10-06)

  A rich inline edit keeps its formatting chrome beside the editor for the
  whole session, the way GrapesJS docks its RTE toolbar: over the selection
  when there is one, and docked at the editing SURFACE while the caret is
  collapsed. The editor still owns semantics (which actions exist, which are
  enabled); this file only answers "where" for the no-selection case, and
  "what is it called" for the editor's English action labels.
*/

/** The editing surface inside the edited element: the contenteditable root, else the element. */
export function inlineDockElement(edited: HTMLElement): HTMLElement {
  return edited.querySelector<HTMLElement>('[contenteditable="true"]') ?? edited;
}

/**
 * The docked anchor, in FRAME coordinates (the space selection rects use), or
 * null when the surface has no layout box yet. Read only when the anchor
 * channel flushes, never retained.
 */
export function measureInlineDock(edited: HTMLElement | undefined): FloatingAnchor | null {
  if (edited?.isConnected !== true) {
    return null;
  }
  const rect = inlineDockElement(edited).getBoundingClientRect();
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !(rect.width > 0) ||
    !(rect.height > 0)
  ) {
    return null;
  }
  return { box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
}

/** A selection measurement first, the docked surface when it has nothing. */
export function withDockFallback(
  selection: (() => FloatingAnchor | null) | null,
  dock: () => FloatingAnchor | null,
): () => FloatingAnchor | null {
  return () => selection?.() ?? dock();
}

/** Labels for the rich editor's actions, by action id. */
export interface RichTextActionLabels {
  readonly bold: string;
  readonly italic: string;
  readonly link: string;
  readonly heading2: string;
  readonly heading3: string;
  readonly bulletList: string;
  readonly orderedList: string;
  readonly clear: string;
  readonly formatting: string;
}

export const RICH_TEXT_ACTION_LABELS_EN: RichTextActionLabels = {
  bold: 'Bold',
  italic: 'Italic',
  link: 'Link',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  bulletList: 'Bulleted list',
  orderedList: 'Numbered list',
  clear: 'Clear formatting',
  formatting: 'Formatting',
};

export const RICH_TEXT_ACTION_LABELS_AR: RichTextActionLabels = {
  bold: 'عريض',
  italic: 'مائل',
  link: 'رابط',
  heading2: 'عنوان 2',
  heading3: 'عنوان 3',
  bulletList: 'قائمة نقطية',
  orderedList: 'قائمة مرقّمة',
  clear: 'مسح التنسيق',
  formatting: 'التنسيق',
};

const LABELLED_IDS = new Set<string>([
  'bold',
  'italic',
  'link',
  'heading2',
  'heading3',
  'bulletList',
  'orderedList',
  'clear',
]);

/**
 * The editor's actions with the editor locale's labels. An id this map does
 * not know keeps the label its editor reported (a contributed editor may
 * offer more than these).
 */
export function localizeRichActions(
  actions: readonly InlineFormatAction[],
  labels: RichTextActionLabels,
): InlineFormatAction[] {
  return actions.map((action) =>
    LABELLED_IDS.has(action.id)
      ? { ...action, label: labels[action.id as keyof Omit<RichTextActionLabels, 'formatting'>] }
      : action,
  );
}
