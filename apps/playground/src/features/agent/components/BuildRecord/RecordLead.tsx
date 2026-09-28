import type { ReactNode } from 'react';

import { SpineSegment, type SegmentState, type SegmentTo } from '../SpineRow';

import './RecordLead.css';

/** The stretch of spine beside a record's first lines. */
export interface LeadSegment {
  readonly state: SegmentState;
  /** `node` reaches the first spine row below; `end` stops with the last line. */
  readonly to: SegmentTo;
  readonly live?: boolean | undefined;
  /** The first section's key, so its landing's stagger reaches this stretch too. */
  readonly landKey?: string | undefined;
}

export interface RecordLeadProps {
  /** Drawn from the head's node down, beside the lines. */
  readonly segment?: LeadSegment | null | undefined;
  /**
   * The lines, in the text column: captions, the DirectionLine, the estimate, an error's
   * sentences. A live line (the skeleton pass, an edit at work) is a `<p>` with the class
   * `ck-agent-lead__live`: Meta, in a Slate-to-Ink shimmer that moves in the reading direction.
   */
  readonly children?: ReactNode;
}

/**
 * The first lines of a record's body, with the spine beside them (SPEC §3.3 to §3.6, §3.10):
 * `┃ 8 sections on the page` under a finished build's head, `╎ Choosing sections and style…`
 * under a build laying out its page, `╎ Checking the change…` under an edit at work.
 *
 * It spans both of the body's columns and gives its lines the text column through subgrid, so
 * the stretch it draws runs down the glyph column, from just under the head's node to the
 * first row's node, or to its own last line.
 */
export function RecordLead({ segment = null, children }: RecordLeadProps) {
  return (
    <div className="ck-agent-lead">
      {segment === null ? null : (
        <SpineSegment
          state={segment.state}
          from="head"
          to={segment.to}
          live={segment.live}
          landKey={segment.landKey}
        />
      )}
      {children}
    </div>
  );
}
