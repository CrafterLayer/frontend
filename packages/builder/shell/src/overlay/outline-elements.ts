import type { NodeRect } from '../rects';

import './overlay.css';

export interface OutlineHandle {
  /** Position and reveal the outline; label text updates only when it changed. */
  show(rect: NodeRect, label: string): void;
  hide(): void;
  readonly element: HTMLElement;
}

/**
 * Prebuilt chrome (005 R6): the pointer path repositions these fixed elements —
 * it never creates DOM, so a hover sweep allocates nothing. Geometry is applied
 * with transforms only; labels carry the block display name visibly (the AT
 * announcement channel is the host live region, not these).
 */
export function createOutline(layer: HTMLElement, kind: 'hover' | 'selection'): OutlineHandle {
  const doc = layer.ownerDocument;
  const element = doc.createElement('div');
  element.className = `bldr-outline bldr-outline--${kind}`;
  element.setAttribute('aria-hidden', 'true'); // visual chrome; announcements live elsewhere
  const label = doc.createElement('span');
  label.className = 'bldr-outline__label';
  element.appendChild(label);
  layer.appendChild(element);

  let lastLabel = '';
  let visible = false;

  return {
    element,
    show(rect, text) {
      element.style.transform = `translate(${String(rect.x)}px, ${String(rect.y)}px)`;
      element.style.width = `${String(rect.width)}px`;
      element.style.height = `${String(rect.height)}px`;
      if (text !== lastLabel) {
        label.textContent = text;
        lastLabel = text;
      }
      if (!visible) {
        element.style.visibility = 'visible';
        visible = true;
      }
    },
    hide() {
      if (visible) {
        element.style.visibility = 'hidden';
        visible = false;
      }
    },
  };
}
