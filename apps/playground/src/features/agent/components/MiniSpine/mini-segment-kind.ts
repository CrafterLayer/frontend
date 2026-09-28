/**
 * The mini spine's segment kinds (SPEC §4.19), beside MiniSpine the way RunGlyph keeps
 * `run-glyph-state.ts`: a pure mapping, table-tested, that SheetMiniBar can read too.
 */
import type { RowState } from '../../model/view-types';

/**
 * How one segment is drawn: the spine's segment kinds (SPEC §4.8), laid on their side.
 * - `pencil`: dashed Track. Waiting, planned, not written, undone: nothing of it is ink.
 * - `writing`: Halo, with the travelling light while the build is live.
 * - `drafted`: Halo, still. Written, waiting its turn to land.
 * - `ink`: solid Indigo. On the page, and only on the page.
 * - `failed`: dashed Alarm.
 */
export type MiniSegmentKind = 'pencil' | 'writing' | 'drafted' | 'ink' | 'failed';

const SEGMENT_KIND = {
  planned: 'pencil',
  waiting: 'pencil',
  notWritten: 'pencil',
  undone: 'pencil',
  writing: 'writing',
  // A second attempt is still a writer on the section.
  retrying: 'writing',
  drafted: 'drafted',
  landed: 'ink',
  failed: 'failed',
} as const satisfies Readonly<Record<RowState, MiniSegmentKind>>;

/** A section's segment, by its row state. Only `landed` draws ink. */
export function miniSegmentKind(state: RowState): MiniSegmentKind {
  return SEGMENT_KIND[state];
}
