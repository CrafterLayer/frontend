import {
  previewAiPlan,
  routeIntent,
  summarizeDocumentForIntent,
  systemClock,
  systemIds,
  type AiBuildEvent,
  type AiBuildOwnEvent,
  type AiValidatedProposal,
  type BuilderKernel,
  type DroppedAiPlanStep,
  type IntentRoute,
  type NodeId,
} from '@craftkit/builder';

import { planImpact, type PlanImpact } from './impact';
import { mentionedIds } from './mentions';
import type { AssistantMode } from './modes';

/**
 * The run plumbing the controller (WP-16) shares with nothing else: who owns the live run,
 * what a request is FOR, which skills a mode adds, and what the newest answer left behind.
 *
 * Copied from v1 `AssistantPanel.runs.ts`, keeping exactly SPEC §7.4's list. Two v1
 * helpers are deliberately gone, and `runs.test.ts` holds them gone:
 * - the build-archetype check: routing by keyword substrings over the skill registry.
 *   Measured (agent-audit §2 P0-1 / P1-5, 2026-09-28): "change the wedding date to June
 *   12" scaffolded a wedding page over the one being edited, and 14 of 17 page asks missed
 *   the build. Routing is the engine's `routeIntent`, through `routeRequest` below, and
 *   nothing else.
 * - the skipped-sections retry sentence: English text posted as the PERSON's turn. Retry
 *   and "Finish the rest" are successor runs the controller starts (`retrySections`,
 *   `finishRest`); no action posts text the person did not write.
 */

export interface ActiveRunLease {
  readonly runId: string;
  readonly controller: AbortController;
}

/** Whether an event or result belongs to the run that holds the lease now. */
export function ownsRun(activeRun: ActiveRunLease | null, runId: string): boolean {
  return activeRun !== null && activeRun.runId === runId;
}

/**
 * The page a request is sent against: the kernel it runs on, and what the person was
 * pointing at when they sent it.
 */
export interface RequestScene {
  readonly kernel: BuilderKernel;
  /**
   * The ids of the request's mention CHIPS. In v2 a mention is a chip carrying its node
   * id; the text never holds one (`mentions.ts` `consumeMentionFragment`).
   */
  readonly mentions?: readonly NodeId[] | undefined;
  /**
   * The blocks selected when the request was sent (a queued request's captured
   * selection). Absent reads the kernel's canvas selection now, as the run itself does.
   */
  readonly selection?: readonly NodeId[] | undefined;
}

/**
 * What a request is FOR (build a page, build a site, add a section, edit, or answer),
 * answered by the engine's `routeIntent` against the page it would run on.
 *
 * What the request points at, in order: its mention chips; else `@id`s in its text (a
 * reused v1 request); else the scene's selection; else the canvas's. A pointer to a block
 * that no longer exists is dropped, so a stale chip cannot turn a build into an edit; the
 * page root is never "a block pointed at", or an empty page could never be built.
 *
 * Without a scene the page is UNKNOWN, which the router reads as a page with content: the
 * reading that never turns an edit into a build.
 */
export function routeRequest(request: string, scene?: RequestScene): IntentRoute {
  if (scene === undefined) return routeIntent({ request });
  const document = scene.kernel.getDocument();
  const exists = (id: NodeId): boolean =>
    document.nodes[id] !== undefined && id !== document.rootId;
  const chips = (scene.mentions ?? []).filter(exists);
  const typed = mentionedIds(request, document).filter(exists);
  const pointed =
    chips.length > 0
      ? chips
      : typed.length > 0
        ? typed
        : (scene.selection ?? scene.kernel.context.store.getState().selection).filter(exists);
  return routeIntent({
    request,
    document: summarizeDocumentForIntent(document),
    selection: pointed,
  });
}

/** The orchestrator's own events (`build.*`, `task.*`), told apart from every step's ordinary ones. */
export function isBuildOwnEvent(event: AiBuildEvent): event is AiBuildOwnEvent {
  return event.type.startsWith('build.') || event.type.startsWith('task.');
}

/** The blocks the kernel offers for its surface, for the catalog suggestions. */
export function blocksAtVersion(
  kernel: BuilderKernel,
  _version: number,
): ReturnType<BuilderKernel['context']['registry']['blocks']> {
  return kernel.context.registry.blocks(kernel.context.surface);
}

/** The built-in skill that makes a plan a plan, and makes it unable to write. */
export const PLAN_MODE_SKILL_ID = 'craftkit.plan-mode';

/**
 * The skills a run carries, with Plan's own added in Plan mode.
 *
 * Without it Plan was indistinguishable from Ask: both sent a request differing only by
 * an `apply` flag, so the model never knew it was planning. The id does two things: it
 * gives the model the plan's shape to answer in, and, because `craftkit.plan-mode`
 * declares `restrictToCommands: []` and skill restrictions INTERSECT, it leaves the run no
 * command it may emit. "Plan never applies" stops being a flag a caller must remember.
 * The host's own pins are kept, with Plan's added once.
 */
export function skillsForMode(
  mode: AssistantMode,
  selected: readonly string[] | undefined,
): readonly string[] | undefined {
  if (mode !== 'plan') return selected;
  const base = selected ?? [];
  return base.includes(PLAN_MODE_SKILL_ID) ? base : [...base, PLAN_MODE_SKILL_ID];
}

/**
 * The part of a v2 turn `lastFollowUp` and `lastDropped` read: `turns.ts`'s `Turn` fits it
 * as it is (`runs.test.ts` compiles `readonly Turn[]` into both). A salvaged answer keeps
 * its dropped steps under `salvaged` (`EditTurn`, `ProposalTurn`); a step plan's own
 * `dropped` is a COUNT of commands it proposed anyway, a different fact, so it is not read.
 * The person's own turn is kind `user`.
 */
export interface AnsweredTurn {
  readonly kind: string;
  /** The model's own follow-up on this answer, when it gave one. */
  readonly followUp?: string | readonly string[] | undefined;
  /** What validation salvaged of this answer's plan, and the steps it dropped. */
  readonly salvaged?: { readonly dropped: readonly DroppedAiPlanStep[] } | undefined;
}

/* The newest turn that is an ANSWER, reading backwards past what the person wrote. */
function newestAnswer(turns: readonly AnsweredTurn[]): AnsweredTurn | undefined {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn !== undefined && turn.kind !== 'user') return turn;
  }
  return undefined;
}

/**
 * The follow-up of the NEWEST answer, and only the newest: an older answer's "what next"
 * belongs to a request the person has moved on from. The newest answer decides even when
 * it has none.
 */
export function lastFollowUp(
  turns: readonly AnsweredTurn[],
): string | readonly string[] | undefined {
  return newestAnswer(turns)?.followUp;
}

/**
 * The steps the NEWEST answer's salvage left behind, read exactly as `lastFollowUp` is. A
 * salvage two answers ago would put a stale gap above a fresh conversation. The
 * controller resolves these to section titles for `salvageSuggestions`.
 */
export function lastDropped(
  turns: readonly AnsweredTurn[],
): readonly DroppedAiPlanStep[] | undefined {
  return newestAnswer(turns)?.salvaged?.dropped;
}

/**
 * Fresh ports for every preflight. The dry run happens on a SCRATCH kernel and must not
 * borrow the live one's id source: a shared source would hand the rehearsal ids the real
 * document then claims, so the safety check would corrupt what it exists to protect.
 */
export function preflightPorts(): {
  readonly clock: typeof systemClock;
  readonly ids: typeof systemIds;
} {
  return { clock: systemClock, ids: systemIds };
}

/**
 * What a proposal would change, or nothing when it cannot be rehearsed. A preview that
 * throws is not a failed run: the proposal is still one a person may read and decide on,
 * and the card simply says less rather than turning it into an error.
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
  Under `exactOptionalPropertyTypes` "absent" and "present but undefined" differ, and a
  turn means the first; spreading an empty object keeps a missing impact missing.
*/
export function withImpact(impact: PlanImpact | undefined): { readonly impact?: PlanImpact } {
  return impact === undefined ? {} : { impact };
}
