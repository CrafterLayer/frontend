import type { AgentLocale } from '../AgentFace';
import { describeImpact, type PlanImpact } from '../AssistantPanel/AssistantPanel.impact';

export interface PlanImpactLineProps {
  /** What the plan would change, diffed from its own rehearsal. Absent when it could not be rehearsed. */
  readonly impact: PlanImpact | undefined;
  /**
   * The request's token estimate. Accepted and NOT shown (2026-09-28): see the
   * component comment. Kept on the props so the v1 callers compile unchanged
   * until the v2 panel replaces them.
   */
  readonly costTokens: number | undefined;
  readonly locale: AgentLocale;
}

/**
 * The size of the decision, before the decision.
 *
 * WHAT WOULD CHANGE comes from diffing the plan's rehearsal against the live
 * document, so it accounts for what the commands actually did rather than what
 * they were named — a `setProp` to the value already there reads like work and
 * moves nothing.
 *
 * The token estimate that used to sit beside it is gone (2026-09-28). The owner
 * pasted a one-step plan «تغيير عنوان قسم التعليم والشهادات إلى مرحبا» that read
 * "تقدير: ~11.3k توكن": the number estimated the whole context this panel would
 * have sent, not what the change cost — and a title change like that is now
 * applied by the engine's direct-edit path without calling a model at all. A
 * number that is wrong on the most common request is worse than none; cost
 * belongs in telemetry (SPEC §7.4), not on the decision.
 *
 * Renders nothing when it knows no impact. An empty line that says "we could
 * not tell" is worse than no line, because it takes space to say nothing.
 */
export function PlanImpactLine({ impact, locale }: PlanImpactLineProps) {
  if (impact === undefined) return null;
  return (
    /*
      `lang` as well as `dir`: this sentence is written by the PANEL, in a
      language the panel knows for certain, so leaving it to `dir="auto"` alone
      had an English voice reading Arabic and the wrong typeface chosen for it.
    */
    <p className="pg-chat__impact" dir="auto" lang={locale}>
      {describeImpact(impact, locale)}
    </p>
  );
}
