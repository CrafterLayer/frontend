import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

import type { EditorCanvasLabels } from './EditorCanvas.labels';

/*
  Small pure readers the canvas's key, pointer and announcement paths share.
  No React, no state: each answers one question about an event target, a
  label, or the kernel's focus.
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

export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    isDomNode(target) &&
    target.nodeType === 1 &&
    (target as Element).closest(EDITABLE_TARGET_SELECTOR) !== null
  );
}

/** Frame event targets belong to another realm: host instanceof Node rejects them. */
export function isDomNode(target: EventTarget | null): target is Node {
  return target !== null && 'nodeType' in target;
}

// ── block-parts (2026-10-06) ──
/**
 * "Heading in Hero" — but never a name inside itself: a button block named for
 * its label read "Button label · Get started in Get started", and an icon
 * "Icon (sparkles) in Icon" (walk 2026-10-08). When the element's own name
 * already carries the region's, the region is left out.
 */
export function nameWithin(
  labels: Pick<EditorCanvasLabels, 'within'>,
  element: string,
  region: string,
): string {
  const own = element.trim();
  const around = region.trim();
  if (around === '' || own.toLocaleLowerCase().includes(around.toLocaleLowerCase())) return own;
  return labels.within(own, around);
}

/** The anchor path that means "the focused part" (no authored element path is negative). */
export const PART_ANCHOR_PATH = [-1] as const;

/** What the floating bars anchor to: the focused element's path, the part sentinel, or the block. */
export function anchorPathOf(
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
