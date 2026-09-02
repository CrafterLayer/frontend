import type { ReactElement } from 'react';

/**
 * The Inspector's marks.
 *
 * 16px grid, 1.5 stroke, round caps, `currentColor` — the same recipe the
 * action bar, the rail and the assistant use, so a glyph here belongs to the
 * same set as every other glyph in the product. Every attribute lives on the
 * element: CSS sizes the box, never the stroke.
 *
 * Every glyph is decorative. The control that carries it names itself with
 * text or an aria-label, which is what screen readers and the tests read.
 */
function glyph(paths: string): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  );
}

/** A plain cross: "none", which is what the selection becomes. */
const CLEAR_SELECTION = '<path d="M4.4 4.4 11.6 11.6"/><path d="M11.6 4.4 4.4 11.6"/>';
/** A smaller cross for the override pill — it removes one value, not a selection. */
const OVERRIDE_CLEAR = '<path d="m4 4 8 8M12 4l-8 8"/>';
/** Points down when expanded; CSS turns it 180° when the section is collapsed. */
const CHEVRON = '<path d="m4 6 4 4 4-4"/>';
/** A screen on a stand: this property can differ per device. */
const DEVICE_OVERRIDE =
  '<rect x="2.5" y="3" width="11" height="8" rx="1.25"/><path d="M6.5 13h3M8 11v2"/>';
/** A pointer: "pick something" — the fill comes from CSS on the element. */
const INVITATION = '<path d="M3 2.5 12.5 7 8 8.5 6.5 13 3 2.5Z"/>';
/** An arrow towards the inline start: out of an element, back to its region. */
const BACK = '<path d="M13 8H3.5"/><path d="m7 3.5-4.5 4.5L7 12.5"/>';

export type InspectorIconId =
  'clear-selection' | 'override-clear' | 'chevron' | 'device-override' | 'invitation' | 'back';

export const INSPECTOR_ICONS: Readonly<Record<InspectorIconId, ReactElement>> = {
  'clear-selection': glyph(CLEAR_SELECTION),
  'override-clear': glyph(OVERRIDE_CLEAR),
  chevron: glyph(CHEVRON),
  'device-override': glyph(DEVICE_OVERRIDE),
  invitation: glyph(INVITATION),
  back: glyph(BACK),
};
