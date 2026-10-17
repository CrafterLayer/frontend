import type { ReactElement } from 'react';

import type { ElementActionId } from '../../overlay/element-actions';
import type { PartActionId } from './part-actions';
import type { QuickGroupId } from './quick-bar-groups';

/**
 * The quick bar's marks: 16px grid, 1.5 stroke, round caps, `currentColor` —
 * the recipe of BlockActionBar.icons, so both bars read as one set. Both maps
 * are keyed by their id unions, which makes them TOTAL: a new group or action
 * fails to compile until it has a mark. Every glyph is decorative; the button
 * carries its name as visually-hidden text.
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

const TEXT_SIZE = '<path d="M2.5 4h6M5.5 4v8.5"/><path d="M9 8h4.5M11.25 8v4.5"/>';
const WEIGHT = '<path d="M4.5 2.8h4.2a2.5 2.5 0 0 1 0 5H4.5zM4.5 7.8h5a2.7 2.7 0 0 1 0 5.4h-5z"/>';
const COLOUR =
  '<path d="M8 2.2c2.6 3 4.2 5.2 4.2 7.2a4.2 4.2 0 0 1-8.4 0c0-2 1.6-4.2 4.2-7.2z"/>';
const ALIGN = '<path d="M2.5 3.5h11M2.5 6.5h7M2.5 9.5h11M2.5 12.5h7"/>';
const LINE_HEIGHT = '<path d="M7 4h6.5M7 8h6.5M7 12h6.5"/><path d="M3.5 3v10M2 4.5 3.5 3 5 4.5M2 11.5 3.5 13 5 11.5"/>';
const DIRECTION = '<path d="M2.5 5h11M11 2.5 13.5 5 11 7.5"/><path d="M13.5 11h-11M5 8.5 2.5 11 5 13.5"/>';
const BACKGROUND =
  '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M2.5 10.5 6 7l3 3 1.5-1.5 3 3"/>';
const PADDING =
  '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><rect x="5.5" y="5.5" width="5" height="5" rx="0.5"/>';
const GAP = '<rect x="2.5" y="3" width="4" height="10" rx="1"/><rect x="9.5" y="3" width="4" height="10" rx="1"/>';
const FLEX_DIRECTION = '<path d="M2.5 8h10M10 5.5 12.5 8 10 10.5"/><path d="M3 3.5h3M3 12.5h3"/>';
const ALIGN_JUSTIFY =
  '<path d="M8 2v12"/><rect x="3" y="4" width="10" height="3" rx="1"/><rect x="5" y="9" width="6" height="3" rx="1"/>';
const RADIUS = '<path d="M3 13V8a5 5 0 0 1 5-5h5"/>';
const BORDER = '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke-dasharray="2 1.6"/>';
const SHADOW = '<rect x="2.5" y="2.5" width="9" height="9" rx="1.5"/><path d="M13.5 5v7a1.5 1.5 0 0 1-1.5 1.5H5"/>';
const REPLACE = '<path d="M3 6.5a5 5 0 0 1 9-2M13 9.5a5 5 0 0 1-9 2"/><path d="M12 2v2.5H9.5M4 14v-2.5h2.5"/>';
const FIT =
  '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5.5 8h5M8 5.5v5"/>';
const ASPECT = '<rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M4.5 6.5v3h3"/>';
const ALT = '<path d="M2.5 12.5 6 3.5l3.5 9M3.8 9.5h4.4"/><path d="M11 6v6.5M11 6h2.5"/>';
const LINK =
  '<path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6"/><path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6"/>';
const STYLE_PRESET = '<path d="M3 3h10v4H3zM3 9h4v4H3zM9 9h4v4H9z"/>';
const HOVER = '<path d="M5 2.5v8l2-1.8 1.6 3.6 1.4-.6-1.6-3.6h2.8z"/>';
const ICON = '<path d="m8 2.5 1.7 3.4 3.8.5-2.7 2.7.6 3.7L8 11l-3.4 1.8.6-3.7-2.7-2.7 3.8-.5z"/>';
const ICON_SIZE = '<path d="M2.5 13.5 13.5 2.5M9 2.5h4.5V7M7 13.5H2.5V9"/>';
const MOTION =
  '<circle cx="10" cy="8" r="3.5"/><path d="M2 5.5h3M1.5 8h3M2 10.5h3"/>';

export const QUICK_GROUP_ICONS: Readonly<Record<QuickGroupId, ReactElement>> = {
  fontSize: glyph(TEXT_SIZE),
  fontWeight: glyph(WEIGHT),
  textColor: glyph(COLOUR),
  textAlign: glyph(ALIGN),
  lineHeight: glyph(LINE_HEIGHT),
  direction: glyph(DIRECTION),
  background: glyph(BACKGROUND),
  padding: glyph(PADDING),
  gap: glyph(GAP),
  flexDirection: glyph(FLEX_DIRECTION),
  align: glyph(ALIGN_JUSTIFY),
  radius: glyph(RADIUS),
  border: glyph(BORDER),
  shadow: glyph(SHADOW),
  replace: glyph(REPLACE),
  fit: glyph(FIT),
  aspect: glyph(ASPECT),
  alt: glyph(ALT),
  link: glyph(LINK),
  stylePreset: glyph(STYLE_PRESET),
  hoverPreset: glyph(HOVER),
  icon: glyph(ICON),
  iconSize: glyph(ICON_SIZE),
  motion: glyph(MOTION),
};

const SELECT_PARENT =
  '<path d="M4.5 13.5h7a2 2 0 0 0 2-2v-3"/><path d="M8 6.5V2.5"/><path d="M5.5 5 8 2.5 10.5 5"/>';
const DUPLICATE =
  '<rect x="5.6" y="5.6" width="8" height="8" rx="1.6"/>' +
  '<path d="M10.4 5.6V4a1.6 1.6 0 0 0-1.6-1.6H4A1.6 1.6 0 0 0 2.4 4v4.8A1.6 1.6 0 0 0 4 10.4h1.6"/>';
const DELETE =
  '<path d="M2.8 4.4h10.4"/><path d="M6.2 4.4V3.2a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v1.2"/>' +
  '<path d="M4.2 4.4 4.8 13a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-8.6"/><path d="M6.8 6.8v4.6M9.2 6.8v4.6"/>';
const MOVE_EARLIER = '<path d="M8 13.2V4.4"/><path d="M4.4 8 8 4.4 11.6 8"/><path d="M4 2.4h8"/>';
const MOVE_LATER = '<path d="M8 2.8v8.8"/><path d="M11.6 8 8 11.6 4.4 8"/><path d="M4 13.6h8"/>';
const WRAP = '<rect x="2" y="2" width="12" height="12" rx="2" stroke-dasharray="2 1.6"/><rect x="5" y="5" width="6" height="6" rx="1"/>';
const UNWRAP = '<rect x="5" y="5" width="6" height="6" rx="1"/><path d="M2 5V3a1 1 0 0 1 1-1h2M11 2h2a1 1 0 0 1 1 1v2M14 11v2a1 1 0 0 1-1 1h-2M5 14H3a1 1 0 0 1-1-1v-2"/>';
const COPY_STYLE = '<path d="M3 3h7v3H3z"/><path d="M10 4.5h2.5V8H6.5v2"/><path d="M5.5 10h2v4h-2z"/>';
const PASTE_STYLE =
  '<rect x="3.5" y="3" width="9" height="11" rx="1.5"/><path d="M6 3V2h4v1"/><path d="M6 7h4M6 10h4"/>';
const SAVE_TEMPLATE = '<path d="M4 2.5h8v11l-4-2.5-4 2.5z"/>';
const ANIMATE =
  '<path d="M2.5 8h3M3.5 5h3M3.5 11h3"/><circle cx="10.5" cy="8" r="3"/>';
const HIDE =
  '<path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="1.8"/><path d="M3 13 13 3"/>';
const DESELECT = '<path d="M4.4 4.4 11.6 11.6"/><path d="M11.6 4.4 4.4 11.6"/>';

export const ELEMENT_ACTION_ICONS: Readonly<Record<ElementActionId, ReactElement>> = {
  selectParent: glyph(SELECT_PARENT),
  duplicate: glyph(DUPLICATE),
  delete: glyph(DELETE),
  moveEarlier: glyph(MOVE_EARLIER),
  moveLater: glyph(MOVE_LATER),
  wrap: glyph(WRAP),
  unwrap: glyph(UNWRAP),
  copyStyle: glyph(COPY_STYLE),
  pasteStyle: glyph(PASTE_STYLE),
  saveTemplate: glyph(SAVE_TEMPLATE),
  animate: glyph(ANIMATE),
  hideOnBucket: glyph(HIDE),
  deselect: glyph(DESELECT),
};

// ── block-parts (2026-10-06) ──
const EDIT_TEXT = '<path d="M3 13h3l7-7-3-3-7 7z"/><path d="M8.5 4.5l3 3"/>';
const ADD_AFTER = '<rect x="2.5" y="2.5" width="11" height="5" rx="1"/><path d="M8 10v4M6 12h4"/>';
const SCOPE_THIS = '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1" stroke-dasharray="1.6 1.4"/><rect x="2" y="9" width="5" height="5" rx="1" stroke-dasharray="1.6 1.4"/><rect x="9" y="9" width="5" height="5" rx="1" stroke-dasharray="1.6 1.4"/>';
const DIR_AUTO = '<path d="M3 12.5 6 3.5l3 9M4 9.5h4"/><path d="M11 5.5h3M12.5 4v3"/><path d="M11 11.5h3"/>';
const DIR_LTR = '<path d="M2.5 8h10M10 5.5 12.5 8 10 10.5"/><path d="M2.5 3.5h5M2.5 12.5h5"/>';
const DIR_RTL = '<path d="M13.5 8h-10M6 5.5 3.5 8 6 10.5"/><path d="M8.5 3.5h5M8.5 12.5h5"/>';

/** The part bar's actions (block-parts §2.14); total over `PartActionId`, like the maps above. */
export const PART_ACTION_ICONS: Readonly<Record<PartActionId, ReactElement>> = {
  editText: glyph(EDIT_TEXT),
  link: glyph(LINK),
  addAfter: glyph(ADD_AFTER),
  duplicate: glyph(DUPLICATE),
  moveUp: glyph(MOVE_EARLIER),
  moveDown: glyph(MOVE_LATER),
  remove: glyph(DELETE),
  scopeThis: glyph(SCOPE_THIS),
  dirAuto: glyph(DIR_AUTO),
  dirLtr: glyph(DIR_LTR),
  dirRtl: glyph(DIR_RTL),
  selectBlock: glyph(SELECT_PARENT),
};
// ── /block-parts ──

export const MORE_ICON = glyph('<circle cx="3.5" cy="8" r="0.6"/><circle cx="8" cy="8" r="0.6"/><circle cx="12.5" cy="8" r="0.6"/>');
export const SETTINGS_ICON = glyph(
  '<path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6"/><circle cx="10" cy="4.5" r="1.5"/><circle cx="6" cy="11.5" r="1.5"/>',
);
export const AI_ICON = glyph(
  '<path d="M7 2.5 8.2 6 11.5 7.2 8.2 8.4 7 11.9 5.8 8.4 2.5 7.2 5.8 6z"/><path d="M12 10.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
);
export const GRIP_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
    <circle cx="5" cy="4" r="1" />
    <circle cx="11" cy="4" r="1" />
    <circle cx="5" cy="8" r="1" />
    <circle cx="11" cy="8" r="1" />
    <circle cx="5" cy="12" r="1" />
    <circle cx="11" cy="12" r="1" />
  </svg>
);
