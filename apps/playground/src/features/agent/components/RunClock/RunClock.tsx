import { formatClock } from '../../copy';
import { useTicker } from '../../hooks/use-ticker';

import './RunClock.css';

export interface RunClockProps {
  /** When the run started, epoch ms. */
  readonly startedAt: number;
  /**
   * When it ended, epoch ms: the clock freezes on the final time and stops listening to
   * the ticker. A run revived after a reload passes its last evidence, never "now"
   * (SPEC §4.8: a revived run is measured to `lastEvidenceAt`).
   */
  readonly endedAt?: number | undefined;
  /** Appended to `ck-agent-clock`. */
  readonly className?: string | undefined;
}

/**
 * A run's one clock, `m:ss` (SPEC §4.17, §4.8). The RunBar shows it while the run is live;
 * nothing else shows a ticking clock, so there is never a second, disagreeing one.
 *
 * `aria-hidden`: the clock is never announced and never read in passing (SPEC §4.3); the
 * run's progress reaches a screen reader through LiveStatus. The figures sit in an LTR
 * `<bdi>` so `1:24` stays `1:24` inside an Arabic line, in a tabular slot so a changing
 * second never moves the words beside it.
 */
export function RunClock({ startedAt, endedAt, className }: RunClockProps) {
  const now = useTicker(endedAt === undefined);
  return (
    <bdi
      dir="ltr"
      aria-hidden="true"
      className={className === undefined ? 'ck-agent-clock' : `ck-agent-clock ${className}`}
    >
      {formatClock((endedAt ?? now) - startedAt)}
    </bdi>
  );
}
