import type { IntentKind } from '@craftkit/builder';

import type { Key } from '../../copy/keys';

/** One next step after a first build: its chip, the request it sends, where that routes. */
export interface FollowUp {
  readonly id: 'colors' | 'style' | 'reorder' | 'addSection';
  /** The chip's words: «بدّل الألوان» / "Restyle colours". */
  readonly label: Key;
  /** The request it sends as the person's next turn, worded for the router. */
  readonly request: Key;
  /**
   * The route the request must take (`routeRequest` on a built page), proven per locale by
   * `follow-up-routing.test.ts`: an edit of the page, or one new section on it.
   */
  readonly routesTo: Extract<IntentKind, 'edit' | 'add-section'>;
}

/**
 * The next steps, in the order the row shows them: style first (the research's "Shuffle
 * colors / Shuffle layout", theme and palette pickers), then structure.
 */
export const FOLLOW_UPS: readonly FollowUp[] = [
  {
    id: 'colors',
    label: 'nextSteps.colors',
    request: 'nextSteps.colors.request',
    routesTo: 'edit',
  },
  { id: 'style', label: 'nextSteps.style', request: 'nextSteps.style.request', routesTo: 'edit' },
  {
    id: 'reorder',
    label: 'nextSteps.reorder',
    request: 'nextSteps.reorder.request',
    routesTo: 'edit',
  },
  {
    id: 'addSection',
    label: 'nextSteps.addSection',
    request: 'nextSteps.addSection.request',
    routesTo: 'add-section',
  },
];
