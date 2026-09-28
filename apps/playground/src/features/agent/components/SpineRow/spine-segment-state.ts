/**
 * The spine's stretches (SPEC §1, §4.8 segment table), and what a row offers at its end.
 *
 * Kept beside SpineRow rather than in each drawing, so "ink means landed" is decided once:
 * only a landed row inks the stretch above its node. A finished draft stays pale, and a
 * failed or waiting section stays pencil, whatever the count says elsewhere.
 */
import type { RowState, SpineRowView, UndoView } from '../../model/view-types';

/**
 * How one stretch of spine is drawn:
 * - `pencil`: dashed Track, a section that waits, or is not on the page (not written, undone);
 * - `writing`: pale Halo with a light travelling down it while a writer is on it;
 * - `drafted`: pale Halo, still: written, waiting its turn to land;
 * - `ink`: solid Indigo, on the page;
 * - `failed`: dashed Alarm;
 * - `indeterminate`: pale Halo under a head whose sections do not exist yet (the skeleton
 *   pass, an edit at work).
 */
export const SEGMENT_STATES = [
  'pencil',
  'writing',
  'drafted',
  'ink',
  'failed',
  'indeterminate',
] as const;

export type SegmentState = (typeof SEGMENT_STATES)[number];

const ROW_SEGMENT = {
  planned: 'pencil',
  waiting: 'pencil',
  writing: 'writing',
  // A second attempt is still a writer on the section.
  retrying: 'writing',
  drafted: 'drafted',
  landed: 'ink',
  failed: 'failed',
  notWritten: 'pencil',
  undone: 'pencil',
} as const satisfies Readonly<Record<RowState, SegmentState>>;

/** The stretch above a node takes that node's state (SPEC §3.4). */
export function segmentForRow(state: RowState): SegmentState {
  return ROW_SEGMENT[state];
}

/**
 * What a row offers at its inline end (SPEC §4.8 SpineRow, "Trailing action"):
 * - its history action, `undo`, `redo` or an `unavailable` Undo that says why. The view sets
 *   `undo` only after `build.completed`, when the section's landing record exists;
 * - `retry` on a failed row that can be written again.
 */
export type TrailingAction = UndoView | { readonly kind: 'retry' };

export function trailingActionOf(row: SpineRowView): TrailingAction | null {
  if (row.state === 'failed') return row.canRetry ? { kind: 'retry' } : null;
  return row.undo ?? null;
}
