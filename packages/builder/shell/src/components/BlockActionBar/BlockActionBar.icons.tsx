import type { ReactElement } from 'react';

import type { BlockActionId } from '../../overlay/block-actions';

/**
 * The block actions, as marks.
 *
 * 16px grid, 1.5 stroke, round caps, `currentColor` — the same recipe the rail
 * and the assistant use, so a glyph here belongs to the same set as every other
 * glyph in the product rather than to whichever icon library was handy.
 *
 * The map is keyed by `BlockActionId`, so the type makes it TOTAL: add an
 * action and this file fails to compile until the action has a mark. That is
 * the point — an action bar that silently renders a nameless empty square is
 * the failure mode an optional icon field invites.
 *
 * Every glyph is decorative. The button carries the action's name as
 * visually-hidden text, which is what screen readers and the tests read.
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

/** Two offset sheets — the copy sits over the original. */
const DUPLICATE =
  '<rect x="5.6" y="5.6" width="8" height="8" rx="1.6"/>' +
  '<path d="M10.4 5.6V4a1.6 1.6 0 0 0-1.6-1.6H4A1.6 1.6 0 0 0 2.4 4v4.8A1.6 1.6 0 0 0 4 10.4h1.6"/>';
/** A bin: lid, body, and the two staves that say "this empties". */
const DELETE =
  '<path d="M2.8 4.4h10.4"/><path d="M6.2 4.4V3.2a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v1.2"/>' +
  '<path d="M4.2 4.4 4.8 13a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-8.6"/>' +
  '<path d="M6.8 6.8v4.6M9.2 6.8v4.6"/>';
/*
  Direction, not rotation: "earlier" is UP the document and "later" is DOWN it.
  A bar-and-arrow pair reads as a MOVE TO THE EDGE, which is what these do in a
  slot — the plain chevrons a media player uses would read as "skip".
*/
const MOVE_EARLIER = '<path d="M8 13.2V4.4"/><path d="M4.4 8 8 4.4 11.6 8"/><path d="M4 2.4h8"/>';
const MOVE_LATER = '<path d="M8 2.8v8.8"/><path d="M11.6 8 8 11.6 4.4 8"/><path d="M4 13.6h8"/>';
/** A pencil over a baseline: the text itself is what gets edited. */
const EDIT_TEXT =
  '<path d="M9.6 3.4 12.6 6.4"/>' +
  '<path d="M10.7 2.3a1.5 1.5 0 0 1 2.1 2.1L6.4 10.8 3.2 11.8l1-3.2z"/>' +
  '<path d="M2.4 14.2h11.2"/>';

/*
  Select parent: a corner turning UP and OUT of a box.

  Not a bare arrow — a plain ↑ reads as "move up", which is what `moveEarlier`
  does, and two actions in one bar must not share a mark. The path leaves the
  enclosing shape, which is the thing the action actually does.
*/
const SELECT_PARENT =
  '<path d="M4.5 13.5h7a2 2 0 0 0 2-2v-3"/>' +
  '<path d="M8 6.5V2.5"/>' +
  '<path d="M5.5 5 8 2.5 10.5 5"/>';

/*
  Deselect: a plain cross.

  Not a window's close box — nothing closes but the bar itself — and not a
  slashed cursor, which would read as "disabled". A cross is the mark for
  "none", which is what the selection becomes; it is the last action in the
  bar and the only one that ends with the bar gone.
*/
const DESELECT = '<path d="M4.4 4.4 11.6 11.6"/><path d="M11.6 4.4 4.4 11.6"/>';

export const BLOCK_ACTION_ICONS: Readonly<Record<BlockActionId, ReactElement>> = {
  selectParent: glyph(SELECT_PARENT),
  duplicate: glyph(DUPLICATE),
  delete: glyph(DELETE),
  moveEarlier: glyph(MOVE_EARLIER),
  moveLater: glyph(MOVE_LATER),
  editText: glyph(EDIT_TEXT),
  deselect: glyph(DESELECT),
};
