import type { StyleSectorId, StyleState } from '@craftkit/builder-schema';

/**
 * A host asking the Inspector to show one place (style-manager DESIGN.md
 * §A.6): the quick bar's "More" opens Design at a sector, "Animate" opens
 * Interactions. A new `nonce` is a new request, so asking twice for the same
 * sector after a person wandered off still brings them back.
 */
export interface InspectorFocusRequest {
  readonly tab: 'design' | 'interactions';
  readonly sector?: StyleSectorId | undefined;
  readonly nonce: number;
}

/** What the element panel is editing, for canvas overlays (grid tracks, forced state). */
export interface InspectorStyleContext {
  /** The open Design sector, or null when Design is not showing. */
  readonly sector: StyleSectorId | null;
  readonly state: StyleState;
}
