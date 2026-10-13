import {
  AiBuildRevertError,
  isBuildIntent,
  previewAiPlan,
  routeIntent,
  summarizeDocumentForIntent,
  systemClock,
  systemIds,
  type AiBuildEvent,
  type AiBuildOwnEvent,
  type AiBuildTaskReport,
  type AiSkillRegistry,
  type AiValidatedProposal,
  type BuilderKernel,
  type DroppedAiPlanStep,
  type IntentRoute,
  type IntentTarget,
  type NodeId,
} from '@craftkit/builder';

import type { BuildNotice } from './AssistantPanel.build';
import { planImpact, type PlanImpact } from './AssistantPanel.impact';
import { mentionedIds } from './AssistantPanel.mentions';
import type { AssistantMode } from './AssistantPanel.modes';
import type { BuildRevertRefusal, Turn } from './AssistantPanel.turns';

export interface ActiveRunLease {
  readonly runId: string;
  readonly controller: AbortController;
}

export function ownsRun(activeRun: ActiveRunLease | null, runId: string): boolean {
  return activeRun !== null && activeRun.runId === runId;
}

/** Four openers, each a request that works exactly as written. */
/** The largest `-N` suffix among saved session and turn ids, so new ids never repeat one. */

/**
 * The page a request is sent against: the kernel it will run on, and what the
 * person was pointing at when they sent it.
 */
export interface RequestScene {
  readonly kernel: BuilderKernel;
  /**
   * The blocks pointed at when the request was sent — the selection a queued
   * request captured, say. Absent reads the kernel's canvas selection now,
   * which is the fallback the run itself uses.
   */
  readonly selection?: readonly NodeId[];
}

/**
 * What a request is FOR — build a page, build a site, add a section, edit, or
 * answer — read against the page it would run on.
 *
 * This is the engine's `routeIntent` with the page filled in the way the run
 * fills it: @mentions ARE the selection when there are any (the rule `ask`
 * already applies to its runs), otherwise the scene's selection, otherwise the
 * canvas's. The page root is never "a block pointed at" — a selection that is
 * only the page is the whole page, and reading it as pointing would stop an
 * empty page from ever being built.
 *
 * Without a scene the page is UNKNOWN, which the router reads as a page with
 * content: the reading that never turns an edit into a build.
 */
export function routeRequest(request: string, scene?: RequestScene): IntentRoute {
  if (scene === undefined) return routeIntent({ request });
  const document = scene.kernel.getDocument();
  const mentioned = mentionedIds(request, document);
  const pointed =
    mentioned.length > 0
      ? mentioned
      : (scene.selection ?? scene.kernel.context.store.getState().selection);
  return routeIntent({
    request,
    document: summarizeDocumentForIntent(document),
    selection: pointed.filter((id) => id !== document.rootId),
  });
}

/**
 * Whether a request takes the BUILD path — a whole page (or site) written
 * section by section — rather than one ordinary run.
 *
 * The name is kept so the panel's call site is unchanged; what it asks is not.
 * It used to ask the skill registry whether a page-archetype skill
 * AUTO-ACTIVATED, and activation is keyword substrings: a keyword says what a
 * request mentions, not what it asks for. Measured (agent-audit §2 P0-1 / P1-5,
 * `routing.mjs`, 2026-09-28): "change the wedding date to June 12" scaffolded a
 * wedding page over the one being edited — 8 of 12 edits did the same — while
 * "Build a website for my bakery", "صفحه هبوط" spelled with ه, and every
 * multi-page ask took the single-call path: 14 of 17 page asks missed.
 *
 * It now asks the intent router, and the registry is no longer consulted — it
 * stays in the signature only so the call site compiles unchanged. Pass the
 * scene and the answer reads the page too: an empty page takes a bare subject
 * as its brief, and a pointed-at block keeps a noun phrase an edit. The
 * richer answer — which kind, where the build lands, how sure — is
 * `routeRequest`.
 */
export function activatesBuildArchetype(
  _registry: AiSkillRegistry,
  request: string,
  scene?: RequestScene,
): boolean {
  return isBuildIntent(routeRequest(request, scene));
}

/**
 * The path a routed request takes in THIS panel.
 *
 * - `build`: the split build, landing at `target`, with a notice for every way
 *   that differs from what the words asked for.
 * - `answer`: words only — no command vocabulary, no proposal, nothing to apply.
 * - `run`: the one ordinary run (an edit, or one new section).
 */
export type RequestPath =
  | {
      readonly path: 'build';
      readonly target: IntentTarget;
      readonly notices: readonly BuildNotice[];
      /** Ask the build's one question even where the mode would not (Auto). */
      readonly confirm: boolean;
    }
  | { readonly path: 'answer' }
  | { readonly path: 'run' };

/**
 * Turn the router's answer into a path this panel can actually take.
 *
 * Two routes cannot be honoured as asked, and both are said out loud rather
 * than done quietly differently (2026-09-28) — as is a start-over the build
 * cannot do (below):
 *
 * - `new-page`: the host hands this panel ONE page lens
 *   (`siteKernel.page(currentPage)` in App.tsx) and no site, so there is no page
 *   it could open. The build appends below the content — the placement every
 *   build had before the router existed — and the card says so.
 * - `build-site`: no site stage provider reaches the chat (the site builder's
 *   provider is offline and lives on its own rail destination), so a site ask
 *   is built as one page, and the card says that too.
 *
 * A build that would start a page WITH CONTENT over asks first, in every
 * writing mode. The engine's PagePlan path removes the page's children in the
 * skeleton's own transaction on `replace` (2026-09-28), and the router says
 * `replace` over content for "start over"-like words — "start over" alone at
 * 0.5. Undoing the build would bring the page back, but a misread must not
 * remove a person's page without a question first, and Auto is the product
 * default.
 *
 * ONLY the PagePlan path removes anything. The scaffold path lays its skeleton
 * after what is there whatever the target, and the playground's own provider
 * has no `proposePagePlan`, so its every build is a scaffold build (wave-2
 * verifier, scaffold-replace.mjs, 2026-09-28: "start over" over one region
 * left "Existing, Hero, Proof, Pricing" — after the person had confirmed a
 * start-over and been promised an Undo for what was replaced). Where the build
 * cannot start over (`canStartOver: false`), it appends, says so, and asks
 * nothing: nothing will be removed.
 *
 * `add-section` stays on the ONE-call path. The router defines it as one new
 * section, and a build needs two to split: it would run the scaffold, find one
 * region, and fall back to this same call — a second model call in front of
 * every "add a pricing section" (the owner's first priority is speed).
 */
export function requestPath(
  route: IntentRoute,
  page: {
    readonly holdsContent: boolean;
    /**
     * Whether a build here can remove what is on the page before laying its
     * own: a provider that can plan a page, and a registry holding the region
     * block a plan is laid as. Otherwise every build is a scaffold build.
     */
    readonly canStartOver: boolean;
  },
): RequestPath {
  switch (route.kind) {
    case 'build-page':
    case 'build-site': {
      const opensPage = route.target === 'new-page';
      const asksToStartOver = route.target === 'replace' && page.holdsContent;
      const startsOver = asksToStartOver && page.canStartOver;
      const notices: BuildNotice[] = [];
      if (route.kind === 'build-site') notices.push('site-as-one-page');
      if (opensPage) notices.push('new-page-appended');
      if (startsOver) notices.push('starts-over');
      if (asksToStartOver && !startsOver) notices.push('appended-not-replaced');
      return {
        path: 'build',
        target:
          opensPage || route.target === undefined || (asksToStartOver && !startsOver)
            ? 'append'
            : route.target,
        notices,
        confirm: startsOver,
      };
    }
    case 'question':
      return { path: 'answer' };
    case 'add-section':
    case 'edit':
      return { path: 'run' };
  }
}

/**
 * Why a section was not put back, in the card's terms.
 *
 * The engine's `not-landed` covers two facts (build-revert.ts): a section that
 * never landed, and one that landed with nothing recorded from before it — a
 * region a PagePlan skeleton wrote in full. The report tells them apart: only
 * the second is `applied`. Anything that is not a revert refusal is the door
 * turning the revert's own write down.
 */
export function revertRefusalOf(cause: unknown, report: AiBuildTaskReport): BuildRevertRefusal {
  if (!(cause instanceof AiBuildRevertError)) return 'refused';
  if (cause.code === 'not-landed' && report.status === 'applied') return 'no-earlier-version';
  return cause.code;
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

/**
 * Ask again for the sections a build gave up on — and ONLY those.
 *
 * Deliberately worded without any page noun: the routing above reads the same
 * registry, and a retry that said "landing page" again would scaffold a second
 * skeleton over the one already on the canvas.
 */
export function retrySkippedRequest(titles: readonly string[]): string {
  return `Write the sections that were skipped: ${titles
    .map((title) => `“${title}”`)
    .join(
      ', ',
    )}. Keep the direction the rest of the page already follows, and change nothing else.`;
}

/**
 * The blocks a kernel holds, as of a given registry version.
 *
 * The version is an argument it does not use, and that is the point: the
 * registry is mutable and hands back the same object identity after an
 * extension registers, so a memo keyed on the kernel alone never learns that
 * the catalog grew. Threading the version through a real parameter is what
 * turns "please re-run" into a dependency the compiler and the linter can both
 * see.
 */
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

/**
 * The `followUp` of the NEWEST answer — and only if that answer had one.
 *
 * Stops at the first assistant turn found reading backwards, whatever kind it
 * is, rather than skipping past newer answers hunting for a plan. The first
 * version did skip, and the effect was a suggestion that outlived its
 * conversation: a plan proposed "now add pricing", the person then asked
 * something else and got a refusal or a report, and the strip still offered
 * "now add pricing" as though nothing had happened since.
 *
 * `thinking` turns are passed over on purpose — they are the spinner, not an
 * answer, and the strip must not go blank while the assistant is mid-sentence.
 */
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
