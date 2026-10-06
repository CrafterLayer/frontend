import { CANVAS_STATE_ATTRIBUTE } from '@craftkit/builder-renderer';
import type { StyleState } from '@craftkit/builder-schema';

/*
  ── Forced state preview on the canvas (style-manager DESIGN.md §A.7) ───────

  While the panel's state switcher is on Hover (Focus, Active, Open), the
  canvas stamps `data-ck-state` on the focused element's DOM, and the canvas's
  live Tailwind compiler — created with `canvasStateVariants: true` — lets
  `hover:` (and the others) match that attribute. The person sees and edits
  the hover look without hovering. Nothing here writes the document, and the
  published sheet never has the variant, so the stamp means nothing there.

  `group-hover` is the hover of the nearest `.group` ancestor, so that is
  where the stamp goes (the element itself when it has no group ancestor).
*/

/** The `data-ck-state` token for an engine state; `null` for Default. */
export function canvasStateToken(state: StyleState): string | null {
  switch (state) {
    case 'default':
      return null;
    case 'focus':
      return 'focus-visible';
    case 'group-hover':
      return 'hover';
    default:
      return state;
  }
}

export interface ForcedStatePreview {
  /** Stamp `state` on `element` (or its group), clearing any previous stamp. */
  apply(element: HTMLElement | undefined, state: StyleState): void;
  /** Remove the stamp. */
  clear(): void;
}

function stampTarget(element: HTMLElement, state: StyleState): HTMLElement {
  if (state !== 'group-hover') return element;
  return element.parentElement?.closest<HTMLElement>('.group') ?? element;
}

export function createForcedStatePreview(): ForcedStatePreview {
  let stamped: HTMLElement | null = null;
  let token: string | null = null;

  const clear = () => {
    if (stamped !== null && token !== null) {
      const remaining = (stamped.getAttribute(CANVAS_STATE_ATTRIBUTE) ?? '')
        .split(/\s+/u)
        .filter((entry) => entry !== '' && entry !== token);
      if (remaining.length === 0) stamped.removeAttribute(CANVAS_STATE_ATTRIBUTE);
      else stamped.setAttribute(CANVAS_STATE_ATTRIBUTE, remaining.join(' '));
    }
    stamped = null;
    token = null;
  };

  return {
    apply(element, state) {
      const nextToken = canvasStateToken(state);
      const nextTarget = element === undefined || nextToken === null ? null : stampTarget(element, state);
      if (nextTarget === stamped && nextToken === token) {
        // Same stamp — but React may have re-created the attribute list; make sure it holds.
        if (nextTarget !== null && nextToken !== null) {
          const current = (nextTarget.getAttribute(CANVAS_STATE_ATTRIBUTE) ?? '').split(/\s+/u);
          if (!current.includes(nextToken)) {
            nextTarget.setAttribute(CANVAS_STATE_ATTRIBUTE, [...current.filter((t) => t !== ''), nextToken].join(' '));
          }
        }
        return;
      }
      clear();
      if (nextTarget === null || nextToken === null) return;
      const current = (nextTarget.getAttribute(CANVAS_STATE_ATTRIBUTE) ?? '')
        .split(/\s+/u)
        .filter((entry) => entry !== '');
      if (!current.includes(nextToken)) current.push(nextToken);
      nextTarget.setAttribute(CANVAS_STATE_ATTRIBUTE, current.join(' '));
      stamped = nextTarget;
      token = nextToken;
    },
    clear,
  };
}
