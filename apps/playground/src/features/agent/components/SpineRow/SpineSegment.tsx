import './SpineSegment.css';
import type { SegmentState } from './spine-segment-state';

/**
 * Where a stretch starts: `head`, just under a record head's node (the head row is 32px with
 * its glyph centred, and the body starts 4px below it); `node`, just under the node of the
 * row it is drawn in.
 */
export type SegmentFrom = 'head' | 'node';

/**
 * Where it ends: `end`, the bottom of the element it is drawn in (a caption block that no row
 * follows); `node`, just above the node of the row that follows.
 */
export type SegmentTo = 'end' | 'node';

export interface SpineSegmentProps {
  readonly state: SegmentState;
  readonly from: SegmentFrom;
  readonly to: SegmentTo;
  /**
   * A live build: a writing stretch carries the travelling light, and a stretch that turns to
   * ink fills top-down. A record read back from history draws the same states standing still.
   */
  readonly live?: boolean | undefined;
  /**
   * The section whose landing inks this stretch. BuildRecord staggers consecutive landings by
   * setting `--ck-agent-land-delay` on every element carrying that section's key.
   */
  readonly landKey?: string | undefined;
}

/**
 * One stretch of the page spine (SPEC §1, §4.8): the 2px line down the centre of the glyph
 * column, between two status nodes. It is drawn in the element that holds it (absolutely
 * positioned there), from `from` to `to`, and stops 2px short of each node's visible edge:
 * the node's Paper ring, so the spine appears to run into it.
 *
 * Drawn with borders, not fills, so `forced-colors` keeps dashed, dotted and solid apart
 * (SPEC §4.8 table, §6.4). Always `aria-hidden`: the rows and captions say the state in words.
 */
export function SpineSegment({ state, from, to, live = false, landKey }: SpineSegmentProps) {
  return (
    <span
      aria-hidden="true"
      className="ck-agent-segment"
      data-state={state}
      data-from={from}
      data-to={to}
      data-live={live ? '' : undefined}
      data-land-key={landKey}
    />
  );
}
