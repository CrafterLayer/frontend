import type { DroppedAiPlanStep } from '../plan/salvage-plan';
import type { BuilderKernel } from '@craftkit/builder-core';
import type { AiContextProvider, ClockPort, JsonValue, NodeId } from '@craftkit/builder-schema';

import type { AiCompositionPolicy } from '../context/composition-policy';

import type { AppliedAiPlan } from '../plan/apply-plan';
import type { AiValidatedProposal } from '../plan/validated-proposal';
import type { IntentTarget } from '../intent';
import type { AiRunFailure } from './errors';
import type { PagePlan, PagePlanIssue, SectionCheckIssue } from './page-plan/types';
import type {
  AiCommandPolicy,
  AiEffectiveCommandPolicy,
  AiPreparedSkillContext,
  AiSkillActivationPin,
  AiSkillOmission,
  AiSkillRegistry,
} from '../skills';
import type {
  AiChatTurn,
  AiPlan,
  AiPlanProvider,
  AiValidationPorts,
  AssembledAiContext,
} from '../types';

export interface AiAgentPolicy extends AiCommandPolicy {
  maxActiveSkills: number;
  maxSkillTokens: number;
  maxContextTokens: number;
  allowUntrustedSkills: boolean;
}

export interface RunAiAgentOptions {
  runId: string;
  clock: ClockPort;
  kernel: BuilderKernel;
  provider: AiPlanProvider;
  request: string;
  validationPorts: AiValidationPorts;
  selection?: readonly NodeId[];
  /** Backward-compatible additive alias. */
  contextProviders?: readonly AiContextProvider[];
  additionalContextProviders?: readonly AiContextProvider[];
  history?: readonly AiChatTurn[];
  skillRegistry?: AiSkillRegistry;
  selectedSkillIds?: readonly string[];
  /**
   * Whether a skill may activate on its own because the request's words or
   * script matched it. Default `true`.
   *
   * `false` leaves exactly the explicitly selected skills, the always-on ones
   * and their dependencies. It exists for a run whose request text is not the
   * person's ask: a build's section writer carries the whole page request "for
   * subject matter", and keyword matching on it handed every writer the
   * page-level skills — measured 2026-09-28 at ~10.7k characters of
   * contradictory instructions per writer ("you are the design lead… pick the
   * palette" against build-fill's "the direction was already decided").
   */
  autoSkills?: boolean;
  policy?: Partial<AiAgentPolicy>;
  /**
   * How much of the registry this run may see, and how strictly the classes it
   * writes are policed. Forwarded verbatim to `generateAiPlan`.
   *
   * Present here because a run that could not choose was a run stuck with the
   * most expensive catalog: the policy existed and the bounded runner — the
   * canonical path every real host takes — had no way to pass it.
   */
  composition?: AiCompositionPolicy;
  apply?: 'never' | 'auto';
  label?: string;
  signal?: AbortSignal;
  /**
   * Synchronous host lease check. Once a newer run owns the surface/session,
   * return false for this run id so no stale cached/provider result can apply.
   */
  isCurrentRun?: (runId: string) => boolean;
  onEvent?: (event: AiAgentEvent) => void;
}

export interface AiAgentEventBase {
  runId: string;
  seq: number;
  at: number;
}

export type AiAgentRunState =
  | 'started'
  | 'resolving-skills'
  | 'gathering-context'
  | 'proposing'
  | 'validating'
  | 'proposed'
  | 'applying'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type AiAgentEvent =
  | (AiAgentEventBase & { type: 'run.started'; apply: 'never' | 'auto' })
  | (AiAgentEventBase & { type: 'skills.resolving' })
  | (AiAgentEventBase & {
      type: 'skills.resolved';
      activations: readonly AiSkillActivationPin[];
      omitted: readonly AiSkillOmission[];
      totalTokens: number;
    })
  | (AiAgentEventBase & { type: 'context.gathering' })
  | (AiAgentEventBase & {
      type: 'context.ready';
      fragmentCount: number;
      totalTokens: number;
    })
  | (AiAgentEventBase & { type: 'plan.proposing' })
  | (AiAgentEventBase & { type: 'plan.progress'; text: string })
  | (AiAgentEventBase & { type: 'plan.validating'; attempt: 1 | 2 })
  | (AiAgentEventBase & { type: 'plan.repairing'; issues: readonly string[] })
  /*
    Both attempts failed and the run kept the part of the answer the door WILL
    accept. Emitted before `plan.proposed`, because what follows is a smaller
    plan than the model wrote and a person is owed that fact before they are
    shown the result.
  */
  | (AiAgentEventBase & {
      type: 'plan.salvaged';
      kept: number;
      dropped: readonly DroppedAiPlanStep[];
    })
  | (AiAgentEventBase & {
      type: 'plan.proposed';
      plan: AiPlan;
      proposal: AiValidatedProposal;
    })
  | (AiAgentEventBase & { type: 'plan.applying' })
  | (AiAgentEventBase & { type: 'run.completed'; status: 'proposed' | 'applied' })
  | (AiAgentEventBase & { type: 'run.cancelled'; error: AiRunFailure })
  | (AiAgentEventBase & { type: 'run.failed'; error: AiRunFailure });

export interface AiAgentRunResult {
  runId: string;
  status: 'proposed' | 'applied';
  proposal: AiValidatedProposal;
  plan: AiPlan;
  context: AssembledAiContext;
  skills?: AiPreparedSkillContext;
  policy: AiEffectiveCommandPolicy;
  applied?: AppliedAiPlan;
}

/**
 * One section of a split build: the region the scaffold created, and the title
 * it was labelled with. The title is the correlation key — the scaffold plan
 * never returns the ids it made, so the orchestrator reads them back off the
 * applied patches and matches them by label, never by patch order.
 */
export interface AiBuildTask {
  id: NodeId;
  title: string;
}

/**
 * How one section ended.
 *
 * `not-started` means NOTHING of the section landed because the build stopped
 * first — before the section was begun (`attempts: 0`), or, when the person
 * pressed Stop, while it was being written (`attempts` counts the tries that
 * were cut off). Either way its placeholder is still on the page.
 */
export type AiBuildTaskStatus = 'applied' | 'skipped' | 'not-started';

/** The two props a section writer owns on its region. */
export type AiBuildSectionKey = 'tree' | 'css';

/** A region's writer-owned props at one moment, keyed by prop; a prop the node lacks is absent. */
export type AiBuildSectionValues = Readonly<Partial<Record<AiBuildSectionKey, JsonValue>>>;

/**
 * One step a section writer proposed OUTSIDE its own region, dropped by the
 * target guard before landing.
 *
 * A writer may write its own region's `tree` and `css` and nothing else. The
 * command policy only ever checked command NAMES, so a writer allowed
 * `setProp` could set any prop on any node: measured 2026-09-28, one writer
 * replaced the page CSS (the skeleton's font import went with it) and another
 * overwrote the hero, and both were reported "applied".
 */
export interface AiBuildOutOfScopeStep {
  readonly command: string;
  /** The node the step named, when it named one. */
  readonly id?: string;
  /** The prop the step named, when it named one. */
  readonly key?: string;
  readonly reason: string;
}

/**
 * Where a landed section came from, so it can be put back FORWARD.
 *
 * Keyed by the kernel transaction id, never by label: two builds in one
 * session both write "Assistant: 1/8 — Hero", and a revert found by label
 * reached the newer build from the older card.
 */
export interface AiBuildSectionLanding {
  /** The id of the one transaction that landed this section. */
  readonly transactionId: string;
  /** Its history label, e.g. `Assistant: 2/5 — Pricing`. */
  readonly label: string;
  /** Every prop the fill wrote, as it stood just before the fill landed. */
  readonly before: AiBuildSectionValues;
  /** The same props as the fill left them — how a later hand edit is recognised. */
  readonly after: AiBuildSectionValues;
}

export interface AiBuildTaskReport extends AiBuildTask {
  status: AiBuildTaskStatus;
  /**
   * Fill attempts actually made: 0 when the task never started — or, on a
   * page-plan build, for an `applied` region the skeleton wrote in full (a
   * header or footer from the plan) — 1 or 2 otherwise.
   */
  attempts: number;
  /** Why it was skipped or never started. Absent for an applied task. */
  reason?: string;
  /** `reason` as data, for a UI to translate (E5). Absent for an applied task. */
  reasonCode?: AiBuildSkipReasonCode;
  /**
   * Steps of this section's plan that reached outside its region and were
   * dropped before landing. Absent when the writer stayed inside.
   */
  outOfScope?: readonly AiBuildOutOfScopeStep[];
  /**
   * Present exactly when `status` is `applied`. For a region the skeleton
   * wrote in full, it is the skeleton's own transaction with an empty
   * `before` — there was no region before it, so `revertBuildSection` has
   * nothing to put back and refuses (`not-landed`).
   */
  landing?: AiBuildSectionLanding;
  /** The `SectionContract.key` this section was built from, on a PagePlan build. */
  sectionKey?: string;
  /**
   * The facts ledger entries this section shows — sample values the owner must
   * replace (P1-13). From the plan's `facts` whose `section` is this one.
   */
  facts?: readonly AiBuildTaskFact[];
  /**
   * What `checkSection` found when the section landed, and whether the one
   * repair round fixed it. `issues` is what REMAINS after that round; empty
   * with `repaired: true` means the repair cleared everything.
   */
  check?: AiBuildSectionCheck;
}

export interface AiBuildTaskFact {
  readonly key: string;
  readonly sample: string;
}

export interface AiBuildSectionCheck {
  readonly issues: readonly SectionCheckIssue[];
  /** A repair round ran for this section (its first landing had issues). */
  readonly repaired: boolean;
}

/**
 * Why a section was skipped or never started, as data a UI can translate — the
 * `reason` prose is English and was the only thing a host could show (P2-22).
 *
 * - `timeout`: its writer ran out of `taskTimeoutMs`.
 * - `invalid`: both attempts failed the door or the checker.
 * - `out-of-scope`: the writer wrote only outside its region.
 * - `page-changed`: the region was edited or removed while it was being written.
 * - `unreachable`: the provider could not be reached or refused.
 * - `stopped`: the person pressed Stop.
 * - `budget`: the build's time budget, or its `maxTasks` limit, ran out before it started.
 * - `unknown`: anything else.
 *
 * A section whose first attempt failed and whose retry the spent budget
 * prevented keeps the FIRST failure's code: that is why it has no content.
 */
export type AiBuildSkipReasonCode =
  | 'timeout'
  | 'invalid'
  | 'out-of-scope'
  | 'page-changed'
  | 'unreachable'
  | 'stopped'
  | 'budget'
  | 'unknown';

/**
 * The answer to `RunAiBuildOptions.onPlanned`: go, stop, or go with the plan
 * the person EDITED on the plan card (it is validated again before use, held
 * to the intent of the plan that was shown).
 */
export type AiBuildPlanAnswer = 'build' | 'stop' | { readonly build: PagePlan };

/** A region the skeleton laid that no fill ever landed in: its placeholder is still on the page. */
export interface AiBuildUnfilledSection extends AiBuildTask {
  /** The region's writer-owned props as the skeleton laid them. */
  readonly placeholder: AiBuildSectionValues;
}

/** Why the build stopped starting new tasks before the list ran out. */
export type AiBuildStopReason = 'signal' | 'budget' | 'max-tasks';

/** How the whole build ended. */
export type AiBuildOutcome = 'completed' | 'fallback' | 'planned' | AiBuildStopReason;

/**
 * A section the skeleton WOULD create, from a build that wrote nothing.
 *
 * No id, and that is the point: under `apply: 'never'` no node exists yet, so
 * there is nothing to name. Giving it a synthetic one would be a lie in the
 * type — and the first caller to treat it as a real `AiBuildTask` would ask the
 * document for a node that was never created.
 */
export interface AiBuildPlannedTask {
  readonly title: string;
}

export interface AiBuildEventBase {
  /**
   * The BUILD's run id. Each step's own events carry `<runId>/<step>`
   * instead: `page-plan` (T1), `scaffold`, `fill-N`, `check-N` (a section's
   * one repair round) and `fallback`.
   */
  runId: string;
  seq: number;
  at: number;
}

/**
 * The orchestrator's own events. They interleave with every step's ordinary
 * `AiAgentEvent`s on the same `onEvent`, which is why each carries the build's
 * run id while the steps carry a prefixed one: every event is attributable.
 */
export type AiBuildOwnEvent =
  | (AiBuildEventBase & { type: 'build.scaffolding' })
  /**
   * The build did not happen — the scaffold produced fewer than two regions and
   * one ordinary run replaced it. This is the ONLY build event on that path: a
   * build must never be worse than the single call it replaces, and it must not
   * pretend to be a build either.
   */
  | (AiBuildEventBase & { type: 'build.skipped'; reason: string })
  | (AiBuildEventBase & {
      type: 'build.planned';
      direction: string;
      tasks: readonly AiBuildTask[];
      /**
       * How many sections are written at once (`fillConcurrencyFor` over the
       * sections that need a writer), so a UI can say "writing 4 at a time"
       * (E1). Every build emits it since 2026-09-28; optional in the type so
       * a recorded event from before still reads.
       */
      writers?: number;
    })
  | (AiBuildEventBase & {
      type: 'task.started';
      /** 1-based, matching the transaction label (`Assistant: 2/5 — Pricing`). */
      position: number;
      total: number;
      task: AiBuildTask;
      attempt: 1 | 2;
    })
  | (AiBuildEventBase & {
      type: 'task.completed';
      position: number;
      total: number;
      task: AiBuildTask;
      attempts: number;
    })
  | (AiBuildEventBase & {
      type: 'task.skipped';
      position: number;
      total: number;
      task: AiBuildTask;
      attempts: number;
      reason: string;
      /**
       * `reason` as data (E5). Every skip carries it since 2026-09-28;
       * optional in the type so a recorded event from before still reads.
       */
      reasonCode?: AiBuildSkipReasonCode;
    })
  | (AiBuildEventBase & { type: 'build.stopped'; reason: AiBuildStopReason })
  | (AiBuildEventBase & {
      type: 'build.completed';
      tasks: readonly AiBuildTaskReport[];
      applied: number;
      skipped: number;
      elapsedMs: number;
      outcome: AiBuildOutcome;
    });

/** Everything a build's observer sees: its own events plus every step's. */
export type AiBuildEvent = AiAgentEvent | AiBuildOwnEvent;

/**
 * `apply`, `label` and `onEvent` are owned by the orchestrator: a build decides
 * when each step writes (see `apply` and `onPlanned` below), labels every step
 * itself, and widens the observer to the events above. Everything else is
 * forwarded to each step verbatim — except `signal`, which a section writer
 * receives chained with its own deadline, and `selectedSkillIds`, which the
 * build names per step.
 */
export interface RunAiBuildOptions extends Omit<RunAiAgentOptions, 'apply' | 'label' | 'onEvent'> {
  /**
   * Whether this build may WRITE.
   *
   * `'auto'` (the default) is the build as it has always been: the skeleton
   * lands, then every section is filled and applied in page order.
   *
   * `'never'` stops after the skeleton, and never applies it. The scaffold is
   * proposed rather than dispatched, the section list is read from the plan it
   * proposed, and the run returns `outcome: 'planned'` with nothing written and
   * no section filled. It is what a planning mode asks for: the shape of the
   * page and what it would cost, before spending a model call per section.
   *
   * It deliberately does NOT rehearse the whole page. Filling every section on
   * a scratch kernel would cost exactly what building it costs, to produce a
   * result that must then be applied against a document that may have moved —
   * and a person who only wanted to see the plan would have paid for the page.
   */
  apply?: 'auto' | 'never';
  /** Most sections to fill. Later ones are reported `not-started`. Default 12. */
  maxTasks?: number;
  /** Per-section ceiling; only that section's run is aborted. Default 240_000. */
  taskTimeoutMs?: number;
  /**
   * Whole-build ceiling. No section starts (and no retry, and no check
   * repair) once it is spent; a section already being written still finishes
   * and lands. Default 900_000.
   *
   * It measures WORK: planning and writing count, the time a person spends
   * answering `onPlanned` does not (E2) — a careful reader of the plan card
   * used to get a build that ran out before its first section.
   *
   * The caller's `signal` is the other kind of end: it aborts every section in
   * flight and nothing lands after it.
   */
  buildBudgetMs?: number;
  /**
   * How many sections are WRITTEN at once. When omitted, automatic mode starts
   * at 3, grows by one writer for each further group of three sections, and is
   * capped at 6. Pass `1` to restore strictly sequential work.
   *
   * Only the writing overlaps, and it is bounded by this number alone: a slow
   * section never holds back the writers behind it. Sections still LAND one
   * after another in page order, so the transaction log reads top to bottom.
   */
  fillConcurrency?: number;
  /**
   * Asked once, with the sections the skeleton WOULD create, BEFORE anything is
   * written. Answer `'build'` and the approved skeleton lands, then every
   * section is filled; answer `'stop'` (or stop the signal while the question
   * is open) and the build ends with the document exactly as it was — outcome
   * `'signal'`, no task, the list in `plannedTasks`.
   *
   * It exists because the approval a person actually wants is on the LIST — "you
   * understood me, go" — not on each of eight sections in turn. Absent, the
   * build runs straight through, which is what an automatic mode wants.
   *
   * A build that asks and cannot split (fewer than two planned sections) does
   * not ask about a list: its one ordinary run is PROPOSED, never applied, and
   * comes back in `fallback` for the host to approve like any other plan.
   *
   * The planned sections carry no id, because no node exists yet; the build's
   * `build.planned` event, with real ids, follows only once the skeleton lands.
   *
   * PagePlan builds (2026-09-28): the third argument is the validated plan the
   * list was read from — what a plan card shows and lets the person edit — and
   * `{ build: editedPlan }` builds the EDITED plan (validated again first; a
   * plan that fails validation is not built — the build rejects with
   * `AiPlanRejectedError`, classified `plan-rejected`, and nothing is
   * written; on a scaffold build, which has no plan to edit, it reads as
   * `'build'`). An edit changes WHAT is built, never where it lands: the
   * edited plan is held to the intent the shown plan was validated under, so
   * an `intent` flipped on the card is put back, and an edit that brings a
   * header, hero or footer to an appended page is refused. The approval wait
   * is not charged to `buildBudgetMs` (E2). The plan comes third, not first,
   * so every existing `(planned, direction) => …` caller compiles unchanged;
   * it is `undefined` on a scaffold build that has no PagePlan.
   */
  onPlanned?: (
    planned: readonly AiBuildPlannedTask[],
    direction: string,
    plan?: PagePlan,
  ) => Promise<AiBuildPlanAnswer> | AiBuildPlanAnswer;
  /**
   * Build THIS plan verbatim: step T1 (planning) is skipped and the skeleton is
   * written from it by code. It is what Plan mode's "Build" hands over, so the
   * plan the person saw is the plan that is built (P1-7b). Must have passed
   * `validatePagePlan`; it is validated again, and one that fails rejects the
   * build with `AiPlanRejectedError` before anything is written.
   */
  pagePlan?: PagePlan;
  /**
   * Where the page lands (the router's `IntentRoute.target`): a new page, the
   * current page's content replaced, or sections appended (P1-15). When
   * `pagePlan` is given its `intent` wins.
   *
   * Absent, it is read from the page: an empty page, or one holding only an
   * unfilled skeleton, is `replace`d; a page with content is `append`ed to —
   * the one target that never removes what a person made. (A bare `append`
   * default would refuse every whole-page plan on a blank page: appended
   * plans carry no header, hero or footer.)
   *
   * `new-page` lays the plan into the root this build was given, removing
   * nothing: the HOST adds the page and hands the build that page's kernel.
   * `replace` removes the root's children in the skeleton's own transaction,
   * so one Undo restores the old page. `append` lands before a trailing
   * footer. Read only by page-plan builds; a scaffold build appends into the
   * root as it always did.
   */
  target?: IntentTarget;
  onEvent?: (event: AiBuildEvent) => void;
}

export interface AiBuildRunResult {
  runId: string;
  tasks: readonly AiBuildTaskReport[];
  /** Sections whose fill landed, and regions the skeleton wrote in full. */
  applied: number;
  /** Sections attempted twice and given up on. */
  skipped: number;
  /** Time the build WORKED: the wait on `onPlanned` is not counted (E2). */
  elapsedMs: number;
  /**
   * The model-run skeleton, when there was one. Absent when the scaffold
   * itself failed and the build fell back to a single ordinary run, and on
   * every page-plan build — its skeleton is written by code, not a run.
   */
  scaffold?: AiAgentRunResult;
  /**
   * What every fill obeyed: the scaffold plan's rationale, verbatim; on a
   * page-plan build, one line summarising the plan (the planner's rationale
   * or the signature, the two faces, the numbered sections with variants).
   */
  direction: string;
  outcome: AiBuildOutcome;
  /** The one ordinary run that replaced the build under `outcome: 'fallback'`. */
  fallback?: AiAgentRunResult;
  /**
   * The sections the skeleton would create, under `outcome: 'planned'` — and
   * for a build whose `onPlanned` answered `'stop'`, the list that was refused.
   *
   * Present only where `tasks` is empty because no region was ever created.
   */
  plannedTasks?: readonly AiBuildPlannedTask[];
  /**
   * Every region the skeleton laid that no fill landed in — never started,
   * cut off by Stop, or given up on — in page order, with the placeholder it
   * still holds.
   *
   * Present on every build that reached its sections: outcome `completed`,
   * `budget`, `max-tasks`, or `signal` after the skeleton landed. Absent on
   * `planned`, on a refused approval (nothing was written) and on `fallback`
   * — including the one fallback that follows an automatically applied
   * skeleton with fewer than two labelled regions, whose placeholders stay on
   * the page unlisted (agent-audit P1-16, still open; found by the wave-1
   * verifier, 2026-09-28).
   *
   * The build never removes them itself: a stopped page keeps its shape until
   * the host offers `removeUnfilledSections`, one labelled transaction.
   */
  unfilled?: readonly AiBuildUnfilledSection[];
  /**
   * The page plan this build was built from (given, planned, or edited at
   * `onPlanned`) — the Built card's source for the facts ledger. Absent on a
   * scaffold build.
   */
  pagePlan?: PagePlan;
}

// ── Plan mode: step T1 alone ────────────────────────────────────────────────

/**
 * Options for `planAiPage` — Plan mode's one model call, which writes nothing.
 *
 * Same context inputs as a run (kernel, provider, skills, history, signal); no
 * `apply`, `label` or `validationPorts`, because nothing is proposed to the
 * door. The provider must implement `AiPlanProvider.proposePagePlan`; one that
 * does not yields `{ error }` with code `'unsupported'`, and the host falls
 * back to the scaffold build's planning (`runAiBuild({ apply: 'never' })`).
 */
export interface PlanAiPageOptions extends Omit<
  RunAiAgentOptions,
  'request' | 'apply' | 'label' | 'onEvent' | 'validationPorts'
> {
  /**
   * Where the page will land; forced onto the plan's `intent`. Absent, the
   * page decides by the build's own rule: an empty page, or one holding only
   * an unfilled skeleton, is `'replace'`d; a page with content is
   * `'append'`ed to — so `runAiBuild({ pagePlan })` lands the plan where
   * a direct build on that page would. The model's own intent never stands.
   */
  target?: IntentTarget;
  /** A lower section ceiling, e.g. the build's `maxTasks`. Default `PAGE_PLAN_MAX_SECTIONS`. */
  maxSections?: number;
  onEvent?: (event: AiPagePlanEvent) => void;
}

/**
 * `{ plan }`: validated and normalised, after 1 or 2 provider calls (one repair
 * round at most, fed the validation issues). `{ error }`: why not — with the
 * last validation `issues` when the plan itself was the problem.
 */
export type PlanAiPageResult =
  | { readonly plan: PagePlan; readonly attempts: 1 | 2; readonly rationale?: string }
  | { readonly error: AiRunFailure; readonly issues?: readonly PagePlanIssue[] };

/** The signature `planAiPage` implements. */
export type PlanAiPage = (request: string, options: PlanAiPageOptions) => Promise<PlanAiPageResult>;

/** What Plan mode's one call reports while it works. `runId` is the plan's. */
export type AiPagePlanEvent =
  | (AiAgentEventBase & { type: 'page-plan.started' })
  | (AiAgentEventBase & { type: 'page-plan.progress'; text: string })
  | (AiAgentEventBase & { type: 'page-plan.repairing'; issues: readonly PagePlanIssue[] })
  | (AiAgentEventBase & { type: 'page-plan.ready'; plan: PagePlan })
  | (AiAgentEventBase & { type: 'page-plan.failed'; error: AiRunFailure });
