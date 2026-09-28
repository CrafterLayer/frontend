import type { Ref } from 'react';

import { t } from '../../copy';
import type { EndNoteKey, EndNoteView, Locale } from '../../model/view-types';
import type { RunGlyphState } from '../RunGlyph';
import { RunRecord } from '../RunRecord';

import './EndNote.css';

/**
 * The dashed ring says "not on the page" (SPEC §4.7): true of a discarded proposal or plan, a
 * superseded plan, a run stopped or reloaded before any output. The last three endings are
 * notes said after a build that DID land, about where it landed (one page, below this page,
 * after what was there): the dashed ring would claim nothing landed, so they take the note glyph.
 */
const GLYPH = {
  proposalDiscarded: 'absent',
  planDiscarded: 'absent',
  planSuperseded: 'absent',
  stoppedBeforeChange: 'absent',
  interrupted: 'absent',
  siteAsOnePage: 'note',
  newPageAppended: 'note',
  appendedNotReplaced: 'note',
} as const satisfies Readonly<Record<EndNoteKey, RunGlyphState>>;

export interface EndNoteProps {
  readonly locale: Locale;
  readonly view: EndNoteView;
  /** The note's heading, for callers that send focus to it. */
  readonly headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** Appended to `ck-agent-record ck-agent-end`. */
  readonly className?: string | undefined;
}

/**
 * A turn that ended in one line (SPEC §4.10 EndNote): "Proposal discarded", "Replaced by a newer
 * plan", "Stopped before anything changed". One Slate line beside its glyph, no footer: the
 * quietest thing in the thread, because nothing on the page came of it.
 *
 * It is still an `<article>` named by its line, like every record, so a screen reader moving by
 * headings hears how each turn ended. A long note wraps instead of ending in an ellipsis.
 */
export function EndNote({ locale, view, headingRef, className }: EndNoteProps) {
  return (
    <RunRecord
      className={className === undefined ? 'ck-agent-end' : `ck-agent-end ${className}`}
      data-end={view.key}
      glyph={GLYPH[view.key]}
      title={t(locale, `end.${view.key}`)}
      headingRef={headingRef}
    />
  );
}
