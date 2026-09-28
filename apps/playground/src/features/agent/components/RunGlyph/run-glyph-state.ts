/**
 * RunGlyph's states (SPEC §4.7), and the two mappings every record needs: a spine row's
 * state to its node, and a build's phase to its head (SPEC §4.8 phase table).
 *
 * Kept beside the glyph rather than in each record so "ink means landed" is decided once:
 * only `landed` and `partial` draw the Indigo disc, and only a landed row or a finished
 * build reaches them.
 */
import type { BuildPhase, RowState } from '../../model/view-types';

/** Every node RunGlyph draws, in SPEC §4.7 order. */
export const RUN_GLYPH_STATES = [
  'waiting',
  'working',
  'drafted',
  'landed',
  'absent',
  'failed',
  'partial',
  'decision',
  'note',
] as const;

/**
 * - `waiting`: an open ring (rows; a plan's pencil nodes).
 * - `working`: a pale ring with a turning Indigo arc (heads, rows, the RunBar).
 * - `drafted`: an Indigo ring with a core: written, waiting its turn to land.
 * - `landed`: the Indigo disc with a check: on the page.
 * - `absent`: a dashed ring: not written, stopped, undone.
 * - `failed`: the Alarm disc with a cross.
 * - `partial`: the landed disc with an Alarm dot at the reading end (heads only).
 * - `decision`: an Indigo diamond: waiting for the person (proposal and step-plan heads).
 * - `note`: three short lines: an answer, words only.
 */
export type RunGlyphState = (typeof RUN_GLYPH_STATES)[number];

const ROW_GLYPH = {
  planned: 'waiting',
  waiting: 'waiting',
  writing: 'working',
  // A second attempt is still a writer on the section.
  retrying: 'working',
  drafted: 'drafted',
  landed: 'landed',
  failed: 'failed',
  notWritten: 'absent',
  undone: 'absent',
} as const satisfies Readonly<Record<RowState, RunGlyphState>>;

/** A spine or plan row's node (SPEC §4.7 "Where": rows). */
export function glyphForRow(state: RowState): RunGlyphState {
  return ROW_GLYPH[state];
}

const PHASE_GLYPH = {
  skeleton: 'working',
  building: 'working',
  done: 'landed',
  partial: 'partial',
  stopping: 'working',
  stopped: 'absent',
  interrupted: 'absent',
  failed: 'failed',
  undone: 'absent',
} as const satisfies Readonly<Record<BuildPhase, RunGlyphState>>;

/** A build record's head node, by phase (SPEC §4.8 "Head glyph" column). */
export function glyphForBuildPhase(phase: BuildPhase): RunGlyphState {
  return PHASE_GLYPH[phase];
}
