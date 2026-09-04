import type { DroppedAiPlanStep } from '../plan/salvage-plan';
import type { BuilderKernel } from '@craftkit/builder-core';
import type { AiContextProvider, ClockPort, NodeId } from '@craftkit/builder-schema';

import type { AiCompositionPolicy } from '../context/composition-policy';

import type { AppliedAiPlan } from '../plan/apply-plan';
import type { AiValidatedProposal } from '../plan/validated-proposal';
import type { AiRunFailure } from './errors';
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

export type AiBuildTaskStatus = 'applied' | 'skipped' | 'not-started';

export interface AiBuildTaskReport extends AiBuildTask {
  status: AiBuildTaskStatus;
  /** Fill attempts actually made: 0 when the task never started, 1 or 2 otherwise. */
  attempts: number;
  /** Why it was skipped or never started. Absent for an applied task. */
  reason?: string;
}

/** Why the build stopped starting new tasks before the list ran out. */
export type AiBuildStopReason = 'signal' | 'budget' | 'max-tasks';

/** How the whole build ended. */
export type AiBuildOutcome = 'completed' | 'fallback' | AiBuildStopReason;

export interface AiBuildEventBase {
  /** The BUILD's run id. Each step's own events carry `<runId>/<step>` instead. */
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
 * `apply`, `label` and `onEvent` are owned by the orchestrator: a build always
 * applies, labels every step itself, and widens the observer to the events
 * above. Everything else is forwarded to each step verbatim.
 */
export interface RunAiBuildOptions extends Omit<RunAiAgentOptions, 'apply' | 'label' | 'onEvent'> {
  /** Most sections to fill. Later ones are reported `not-started`. Default 12. */
  maxTasks?: number;
  /** Per-section ceiling; only that section's run is aborted. Default 240_000. */
  taskTimeoutMs?: number;
  /** Whole-build ceiling. The running section still finishes. Default 900_000. */
  buildBudgetMs?: number;
  /**
   * How many sections are WRITTEN at once. Default 3; `1` restores strictly
   * sequential work.
   *
   * Only the writing overlaps. Sections still LAND one after another in page
   * order, so the transaction log reads top to bottom and undoing one section
   * still means exactly that one.
   */
  fillConcurrency?: number;
  /**
   * Asked once, after the skeleton is down and the section list is known, and
   * before a single section is filled. Answer `'stop'` and the build ends there
   * with every section reported `not-started`; the skeleton stays, because it is
   * already a transaction a person can undo like any other.
   *
   * It exists because the approval a person actually wants is on the LIST — "you
   * understood me, go" — not on each of eight sections in turn. Absent, the
   * build runs straight through, which is what an automatic mode wants.
   */
  onPlanned?: (
    tasks: readonly AiBuildTask[],
    direction: string,
  ) => Promise<'build' | 'stop'> | 'build' | 'stop';
  onEvent?: (event: AiBuildEvent) => void;
}

export interface AiBuildRunResult {
  runId: string;
  tasks: readonly AiBuildTaskReport[];
  /** Sections whose fill landed. */
  applied: number;
  /** Sections attempted twice and given up on. */
  skipped: number;
  elapsedMs: number;
  /**
   * The skeleton run, when there was one. Absent only when the scaffold itself
   * failed and the build fell back to a single ordinary run — the one case
   * where a build produces no skeleton at all.
   */
  scaffold?: AiAgentRunResult;
  /** The scaffold plan's rationale, verbatim — every fill obeyed this text. */
  direction: string;
  outcome: AiBuildOutcome;
  /** The one ordinary run that replaced the build under `outcome: 'fallback'`. */
  fallback?: AiAgentRunResult;
}
