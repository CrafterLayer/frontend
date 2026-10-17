// ── block-parts (2026-10-06) ──
/**
 * The canvas is an editing surface: a click on a link or a submit control
 * inside a rendered block means "select this", never "follow it". Without this
 * guard a click on the announcement bar's `#templates` link navigated the
 * canvas iframe and loaded the whole builder inside the canvas.
 *
 * CustomCode guards its own authored anchors (renderer `CustomCode.tsx`); this
 * covers every registered block's anchors, CTA links, nav links and card links,
 * plus native form submission. Script click handlers still run — only the
 * browser's default activation (navigation, submit) is cancelled.
 */
const NODE_SELECTOR = '[data-bldr-node]';
const ACTIVATION_SELECTOR =
  'a[href], area[href], button:not([type]), button[type="submit"], input[type="submit"], input[type="image"]';

function elementOf(target: EventTarget | null): Element | null {
  if (target === null || typeof target !== 'object') return null;
  const node = target as Node;
  if (node.nodeType === 1) return node as Element;
  return node.parentElement ?? null;
}

/** True when the click would navigate or submit from inside a canvas block. */
export function isCanvasActivation(target: EventTarget | null): boolean {
  const element = elementOf(target);
  if (element === null) return false;
  const control = element.closest(ACTIVATION_SELECTOR);
  if (control === null) return false;
  // A bare <button> only submits inside a form; outside one it is inert.
  if (control.tagName === 'BUTTON' && control.closest('form') === null) return false;
  return control.closest(NODE_SELECTOR) !== null;
}

/** Cancels the default activation of a canvas link or submit control. */
export function cancelCanvasActivation(event: Pick<Event, 'target' | 'preventDefault'>): void {
  if (isCanvasActivation(event.target)) event.preventDefault();
}
// ── /block-parts ──
