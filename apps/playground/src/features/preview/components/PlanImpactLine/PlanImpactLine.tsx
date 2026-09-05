import type { AgentLocale } from '../AgentFace';
import {
  describeCost,
  describeImpact,
  type PlanImpact,
} from '../AssistantPanel/AssistantPanel.impact';

export interface PlanImpactLineProps {
  /** What the plan would change, diffed from its own rehearsal. Absent when it could not be rehearsed. */
  readonly impact: PlanImpact | undefined;
  /** What the request cost to send, estimated with the engine's own estimator. */
  readonly costTokens: number | undefined;
  readonly locale: AgentLocale;
}

/**
 * The size of the decision, before the decision.
 *
 * Two facts a person needs before pressing Apply, and neither is in the step
 * list. WHAT WOULD CHANGE comes from diffing the plan's rehearsal against the
 * live document, so it accounts for what the commands actually did rather than
 * what they were named — a `setProp` to the value already there reads like work
 * and moves nothing. WHAT IT COST is the engine's own estimate of the request,
 * labelled an estimate because that is what it is.
 *
 * Renders nothing when it knows neither. An empty line that says "we could not
 * tell" is worse than no line, because it takes space to say nothing.
 */
export function PlanImpactLine({ impact, costTokens, locale }: PlanImpactLineProps) {
  if (impact === undefined && costTokens === undefined) return null;
  return (
    /*
      `lang` as well as `dir`: this sentence is written by the PANEL, in a
      language the panel knows for certain, so leaving it to `dir="auto"` alone
      had an English voice reading Arabic and the wrong typeface chosen for it.
    */
    <p className="pg-chat__impact" dir="auto" lang={locale}>
      {impact === undefined ? null : describeImpact(impact, locale)}
      {costTokens === undefined ? null : (
        <>
          {impact === undefined ? null : ' '}
          <span className="pg-chat__cost">{describeCost(costTokens, locale)}</span>
        </>
      )}
    </p>
  );
}
