import type { SpineRowView } from '../../model/view-types';

import { miniSegmentKind } from './mini-segment-kind';

import './MiniSpine.css';

export interface MiniSpineProps {
  /** One segment per section, in page order. */
  readonly rows?: readonly SpineRowView[] | undefined;
  /**
   * The skeleton pass: no section exists yet, so one lit track spans the whole width and
   * makes no claim about how many there will be (SPEC §3.3, §3.17).
   */
  readonly indeterminate?: boolean | undefined;
  /** A live build: writing segments carry the travelling light (SPEC §5 moment 2). */
  readonly live?: boolean | undefined;
  /**
   * Play the arrival motion: a segment that turns to ink fills from the reading start
   * (SPEC §5 moment 1), and the whole spine takes one sweep of light when the last section
   * lands (moment 5). Keep it stable for the spine's life, as RunGlyph's `animate`.
   */
  readonly animate?: boolean | undefined;
  /** Appended to `ck-agent-mini-spine`. */
  readonly className?: string | undefined;
}

/**
 * The phone's horizontal spine (SPEC §4.19): one 4px segment per section with 2px gaps,
 * in the same states as the spine, drawn in the mini detent above the status line. The
 * page in miniature, read at a glance while the sections land on the canvas above it.
 *
 * `aria-hidden` and not interactive: the status line beside it carries the count in words
 * ("1 of 8 on the page"), so the spine says nothing a screen reader would need.
 */
export function MiniSpine({
  rows = [],
  indeterminate = false,
  live = false,
  animate = false,
  className,
}: MiniSpineProps) {
  const complete = !indeterminate && rows.length > 0 && rows.every((row) => row.state === 'landed');
  return (
    <div
      className={
        className === undefined ? 'ck-agent-mini-spine' : `ck-agent-mini-spine ${className}`
      }
      aria-hidden="true"
      data-indeterminate={indeterminate ? '' : undefined}
      data-live={live ? '' : undefined}
      data-animate={animate ? '' : undefined}
      data-complete={complete ? '' : undefined}
    >
      {indeterminate ? (
        <span className="ck-agent-mini-spine__segment" data-kind="writing" />
      ) : (
        rows.map((row) => (
          <span
            key={row.key}
            className="ck-agent-mini-spine__segment"
            data-kind={miniSegmentKind(row.state)}
          />
        ))
      )}
    </div>
  );
}
