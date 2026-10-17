import { useEffect } from 'react';

import type { StyleState } from '@craftkit/builder-schema';

/** The attribute the canvas-only `@custom-variant`s read (DESIGN §A.7). */
export const FORCED_STATE_ATTRIBUTE = 'data-ck-state';

/** The token each state is stamped as: `focus` previews `focus-visible`. */
const STATE_TOKEN: Readonly<Record<Exclude<StyleState, 'default'>, string>> = {
  hover: 'hover',
  focus: 'focus-visible',
  active: 'active',
  open: 'open',
  'group-hover': 'group-hover',
};

/** The canvas element a tree target renders as (its `data-ck-path` stamp). */
export function findCanvasElement(
  frameDocument: Document,
  regionId: string,
  path: readonly number[],
): HTMLElement | null {
  const region = frameDocument.querySelector<HTMLElement>(`[data-bldr-node="${CSS.escape(regionId)}"]`);
  const scope: ParentNode = region ?? frameDocument;
  return scope.querySelector<HTMLElement>(`[data-ck-path="${path.join('.')}"]`);
}

/**
 * Forced state preview: while the state switcher is on Hover (Focus,
 * Active…), stamp `data-ck-state` on the focused element's CANVAS DOM so the
 * person sees and edits the hover look without hovering. Canvas only: the
 * attribute never reaches the document, and it is removed when the state
 * returns to Default, the target changes or the panel unmounts.
 *
 * `target` is the element itself, or a resolver run inside the effect (the
 * frame's DOM is only reliable after commit).
 */
export function useForcedStatePreview(
  frameDocument: Document | null | undefined,
  target: HTMLElement | null | undefined | ((frame: Document) => HTMLElement | null),
  state: StyleState,
): void {
  useEffect(() => {
    if (state === 'default' || frameDocument === null || frameDocument === undefined) return undefined;
    const element = typeof target === 'function' ? target(frameDocument) : target;
    if (element === null || element === undefined) return undefined;
    const token = STATE_TOKEN[state];
    const previous = element.getAttribute(FORCED_STATE_ATTRIBUTE);
    const tokens = new Set((previous ?? '').split(/\s+/u).filter((part) => part !== ''));
    tokens.add(token);
    element.setAttribute(FORCED_STATE_ATTRIBUTE, [...tokens].join(' '));
    return () => {
      if (previous === null) element.removeAttribute(FORCED_STATE_ATTRIBUTE);
      else element.setAttribute(FORCED_STATE_ATTRIBUTE, previous);
    };
  }, [frameDocument, target, state]);
}
