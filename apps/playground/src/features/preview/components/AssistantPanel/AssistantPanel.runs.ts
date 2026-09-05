import {
  previewAiPlan,
  systemClock,
  systemIds,
  type AiBuildEvent,
  type AiBuildOwnEvent,
  type AiSkillRegistry,
  type AiValidatedProposal,
  type BuilderKernel,
  type DroppedAiPlanStep,
} from '@craftkit/builder';

import { planImpact, type PlanImpact } from './AssistantPanel.impact';
import type { AssistantMode } from './AssistantPanel.modes';
import type { Turn } from './AssistantPanel.turns';

export interface ActiveRunLease {
  readonly runId: string;
  readonly controller: AbortController;
}

export function ownsRun(activeRun: ActiveRunLease | null, runId: string): boolean {
  return activeRun !== null && activeRun.runId === runId;
}

/** Four openers, each a request that works exactly as written. */
/** The largest `-N` suffix among saved session and turn ids, so new ids never repeat one. */

export const BUILD_ARCHETYPES: ReadonlySet<string> = new Set([
  'craftkit.page-composition',
  'craftkit.cv-page',
  'craftkit.occasion-page',
]);

export function activatesBuildArchetype(registry: AiSkillRegistry, request: string): boolean {
  try {
    return registry
      .prepare({ request, auto: true })
      .activations.some((activation) => BUILD_ARCHETYPES.has(activation.id));
  } catch {
    // A registry that cannot resolve is a registry that cannot promise a
    // build. The ordinary path still works, so the request takes it.
    return false;
  }
}

/** The orchestrator's own events, told apart from every step's ordinary ones. */
export function isBuildOwnEvent(event: AiBuildEvent): event is AiBuildOwnEvent {
  return event.type.startsWith('build.') || event.type.startsWith('task.');
}

/**
 * The conversation as context: what was asked and what the assistant answered,
 * oldest first, capped so an old chat cannot crowd out the document. Thinking
 * bubbles, stop markers and section lists carry no meaning here.
 */

export function retrySkippedRequest(titles: readonly string[]): string {
  return `Write the sections that were skipped: ${titles
    .map((title) => `“${title}”`)
    .join(
      ', ',
    )}. Keep the direction the rest of the page already follows, and change nothing else.`;
}

export function blocksAtVersion(
  kernel: BuilderKernel,
  _version: number,
): ReturnType<BuilderKernel['context']['registry']['blocks']> {
  return kernel.context.registry.blocks(kernel.context.surface);
}

/** The built-in skill that makes a plan a plan, and makes it unable to write. */
export const PLAN_MODE_SKILL_ID = 'craftkit.plan-mode';

/**
 * The skills a run carries, with Plan's own added when the person chose Plan.
 *
 * This is what made Plan indistinguishable from Ask: the two sent a request
 * that differed only by an `apply` flag, so the model was never told it was
 * planning and answered with whatever it would have answered anyway.
 *
 * Adding the id here does two things at once, and the second is the one that
 * matters. It gives the model the four-part shape to answer in — and, because
 * `craftkit.plan-mode` declares `restrictToCommands: []` and skill restrictions
 * INTERSECT, it leaves the run with no command it is allowed to emit at all.
 * "Plan never applies" stops being a flag a caller must remember.
 *
 * The host's own selection is preserved: a host that pinned skills still gets
 * them, with Plan's added, and never twice.
 */
export function skillsForMode(
  mode: AssistantMode,
  selected: readonly string[] | undefined,
): readonly string[] | undefined {
  if (mode !== 'plan') return selected;
  const base = selected ?? [];
  return base.includes(PLAN_MODE_SKILL_ID) ? base : [...base, PLAN_MODE_SKILL_ID];
}

export function lastFollowUp(turns: readonly Turn[]): string | undefined {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn?.from !== 'assistant') continue;
    if (turn.kind === 'thinking') continue;
    if (turn.kind === 'plan') return turn.plan.followUp;
    /*
      An outline carries one too, and it is the one the plan skill is REQUIRED
      to produce — "what to say next" is half of what Plan mode was asked to
      fix. Reading only `plan` turns meant Plan's own follow-up was stored and
      then never shown, which is the same as not having it.
    */
    if (turn.kind === 'outline') return turn.followUp;
    return undefined;
  }
  return undefined;
}

/**
 * The steps the NEWEST answer's salvage left behind — and only the newest.
 *
 * Read exactly the way `lastFollowUp` is, and stopping at the same place: the
 * first assistant turn found reading backwards, whatever kind it is. A salvage
 * two answers ago belongs to a request the person has already moved on from,
 * and offering to retry it would put a stale gap above a fresh conversation.
 */
export function lastDropped(turns: readonly Turn[]): readonly DroppedAiPlanStep[] | undefined {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn?.from !== 'assistant') continue;
    if (turn.kind === 'thinking') continue;
    if (turn.kind === 'plan') return turn.salvaged?.dropped;
    return undefined;
  }
  return undefined;
}

/**
 * Fresh ports for every preflight.
 *
 * The dry run happens on a SCRATCH kernel and must not borrow the live one's id
 * source: a shared source would hand the rehearsal ids the real document then
 * claims, so the safety check would corrupt the thing it exists to protect.
 */
export function preflightPorts() {
  return { clock: systemClock, ids: systemIds };
}

/**
 * What the plan would change, or nothing when it cannot be rehearsed.
 *
 * A failure here is NOT a failure of the run: a plan whose preview throws is
 * still a plan a person may read and decide about, and the panel simply says
 * less rather than turning a working proposal into an error.
 */
export function impactOfProposal(
  kernel: BuilderKernel,
  proposal: AiValidatedProposal,
): PlanImpact | undefined {
  try {
    const previewed = previewAiPlan({ kernel, proposal, validationPorts: preflightPorts() });
    return planImpact(kernel.getDocument(), previewed);
  } catch {
    return undefined;
  }
}

/*
  `exactOptionalPropertyTypes` distinguishes "absent" from "present and
  undefined", and the turn means the first. Spreading an empty object is how a
  missing impact stays missing.
*/
export function withImpact(impact: PlanImpact | undefined): { impact?: PlanImpact } {
  return impact === undefined ? {} : { impact };
}
