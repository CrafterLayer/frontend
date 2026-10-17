import { GENERATION_STAGE_LABELS } from '@craftkit/builder';

import type { RunProgress } from '../AssistantPanel/AssistantPanel.progress';

export interface StageTimingsProps {
  /** The finished run. Undefined on a revived card, which kept no timings. */
  readonly run: RunProgress | undefined;
}

/**
 * The receipt on a settled card: every row that finished, with how long it
 * took — "Plan 00:01.123 · Structure 00:00.310".
 *
 * Renders nothing when the run left no done row. That is the case for a card
 * revived from storage — timings are not persisted, because a duration is only
 * true of the run that produced it — and for a failure that fell over before
 * the first row settled. An empty receipt line would claim the run took no time
 * at all, which is a worse answer than saying nothing.
 */
export function StageTimings({ run }: StageTimingsProps) {
  const done =
    run?.stages.filter((stage) => stage.status === 'done' && stage.detail !== undefined) ?? [];
  if (done.length === 0) return null;
  return (
    <p className="pg-chat__timing">
      {done
        .map((stage) => `${GENERATION_STAGE_LABELS[stage.id]} ${stage.detail ?? ''}`)
        .join(' · ')}
    </p>
  );
}
