import { useEffect, useState } from 'react';

import { GenerationProgress, systemClock } from '@craftkit/builder';

import {
  liveStageElapsed,
  stagesWithLiveClock,
  type RunProgress,
} from '../AssistantPanel/AssistantPanel.progress';

/** The live clock's beat, and the point at which a stage is worth mentioning. */
const CLOCK_TICK_MS = 1_000;
const SLOW_STAGE_MS = 90_000;

export interface LiveStageClockProps {
  /** The card's heading, and the region's accessible name. */
  readonly heading: string;
  /** The run as rows. Its active row is the one that ticks. */
  readonly run: RunProgress;
}

/**
 * The RUNNING clock on the active row.
 *
 * `GenerationProgress` is presentational and owns no timer (a replayed run and
 * a live one must render identically), and the reducer is pure — so the tick
 * lives here, in the smallest component that shows the number: one interval,
 * cleared the moment the run settles and on unmount, re-rendering this card
 * and nothing above it. A stage that settles keeps the reducer's exact detail;
 * only the open row counts up. Under `prefers-reduced-motion` nothing changes:
 * a clock is information, not motion.
 */
export function LiveStageClock({ heading, run }: LiveStageClockProps) {
  const since = run.stageSince;
  const [now, setNow] = useState(() => systemClock.now());
  useEffect(() => {
    // A settled run has no open row: nothing to count, so nothing is scheduled.
    if (since === null) {
      return;
    }
    /*
      No synchronous resync here: `liveStageElapsed` floors at zero, so a `now`
      left over from the previous row reads as 00:00 until the first tick —
      which is exactly what a row that just opened should show.
    */
    const ticker = window.setInterval(() => {
      setNow(systemClock.now());
    }, CLOCK_TICK_MS);
    return () => {
      window.clearInterval(ticker);
    };
  }, [since]);
  const elapsed = liveStageElapsed(run, now);
  return (
    <>
      <GenerationProgress
        heading={heading}
        stages={stagesWithLiveClock(run, now)}
        announce={false}
      />
      {/* Slow is not wrong: muted words, never a warning colour. */}
      {elapsed !== null && elapsed >= SLOW_STAGE_MS ? (
        <p className="pg-chat__slow">Taking longer than usual.</p>
      ) : null}
    </>
  );
}
