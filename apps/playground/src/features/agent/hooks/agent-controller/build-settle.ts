/**
 * How a page build ends: what it was asked (`BuildPlan`), and the record it leaves
 * when it settles (built, fallen back to an edit, stopped) or fails.
 */
import type {
  AiBuildOwnEvent,
  AiBuildRunResult,
  BuilderDocument,
  BuilderKernel,
  IntentTarget,
  PagePlan,
} from '@craftkit/builder';

import { buildEndAnnouncement } from '../../model/agent-status';
import { type BuildProgress, landedCount, reduceBuildProgress } from '../../model/build-progress';
import { initialRunProgress } from '../../model/run-progress';
import { answerFromPlan, type EditTurn, type ProposalTurn, type Turn } from '../../model/turns';
import type { EndNoteKey } from '../../model/view-types';

import type { Flow } from './controller-state';
import { markNotRun } from './exchange';
import { collected, type Slot } from './run-lease';
import { compare, failureOf, failureTurn, rehearse, say } from './run-outcomes';
import { learnStoryBible } from './story-bible-context';
import { insertAfter, locateTurn, patchKind, patchTurn } from './turn-plumbing';

export interface BuildPlan {
  /** Where the page lands. */
  readonly target?: IntentTarget | undefined;
  /** Build exactly this plan (Plan mode's Build). */
  readonly pagePlan?: PagePlan | undefined;
  /** Hold at the plan for the person's Build (Ask, or a start-over in Auto). */
  readonly approval: boolean;
  /** The page it lands on (a new page's kernel), when not the panel's own. */
  readonly kernel?: BuilderKernel | undefined;
  /** What the thread says after the record, once the build landed something. */
  readonly notes: readonly EndNoteKey[];
  /**
   * T230: the transactions THIS page landed, when the run writes several pages at once (a
   * site): page lenses share one log, so the run's own list holds every page's.
   */
  readonly landed?: (() => readonly string[]) | undefined;
}

/** A build's transactions: every AI transaction it landed (direction, skeleton, sections). */
function buildTransactions(
  flow: Flow,
  slot: Slot,
  kernel: BuilderKernel,
  logBefore: number,
  plan: BuildPlan,
): readonly string[] {
  if (plan.landed !== undefined) return plan.landed();
  const seen = collected(flow, slot);
  if (seen.length > 0) return seen;
  return kernel
    .transactions()
    .slice(logBefore)
    .filter((tx) => tx.author === 'ai')
    .map((tx) => tx.id);
}

/**
 * The build's own `build.completed`, for a result whose event never reached the record
 * (an observer that threw): the result is the build's last word.
 */
function completedFrom(progress: BuildProgress, result: AiBuildRunResult): AiBuildOwnEvent {
  return {
    type: 'build.completed',
    runId: progress.runId,
    seq: Number.MAX_SAFE_INTEGER,
    at: progress.lastEventAt,
    tasks: result.tasks,
    applied: result.applied,
    skipped: result.skipped,
    elapsedMs: result.elapsedMs,
    outcome: result.outcome,
  };
}

export function settleBuild(
  flow: Flow,
  slot: Slot,
  turnId: string,
  anchor: string | null,
  kernel: BuilderKernel,
  result: AiBuildRunResult,
  plan: BuildPlan,
  before: { readonly logBefore: number; readonly documentBefore: BuilderDocument },
): void {
  const env = flow.env();
  const { logBefore } = before;
  const current = locateTurn(flow, turnId)?.turn;

  if (result.outcome === 'fallback' && result.fallback !== undefined) {
    /*
      NOT a build: fewer than two regions, so one ordinary run replaced it. It reads as
      the edit (or, asked in Ask, the proposal) it was, never as a build.
    */
    const fallback = result.fallback;
    const request = current !== undefined && 'request' in current ? (current.request ?? '') : '';
    // Words and no command: an answer, as `runEdit` reads one (`answerFromPlan`).
    const words =
      kernel.transactions().length === logBefore
        ? answerFromPlan({
            id: turnId,
            request,
            plan: fallback.plan,
            skills: fallback.proposal.skillActivations,
          })
        : null;
    if (words !== null) {
      patchTurn(flow, slot.sessionId, turnId, () => words);
      say(flow, 'answer.ready');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
    } else if (fallback.status === 'applied') {
      env.memory.note(fallback.proposal);
      const ids = buildTransactions(flow, slot, kernel, logBefore, plan);
      const transactionId = ids.at(-1);
      const changes = compare(flow, kernel, before.documentBefore, kernel.getDocument());
      const edit: EditTurn = {
        id: turnId,
        kind: 'edit',
        request,
        origin: 'request',
        status: transactionId === undefined || changes.empty ? 'noChange' : 'done',
        mode: 'auto',
        run: initialRunProgress('auto', flow.clock.now() - result.elapsedMs),
        elapsedMs: result.elapsedMs,
        changes: changes.lines,
        summary: fallback.plan.rationale,
        ...(transactionId === undefined ? {} : { transactionId }),
        skills: fallback.proposal.skillActivations,
      };
      patchTurn(flow, slot.sessionId, turnId, () => edit);
      say(flow, 'edit.donePage');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: true });
    } else {
      const proposal: ProposalTurn = {
        id: turnId,
        kind: 'proposal',
        request,
        status: 'ready',
        mode: 'ask',
        plan: fallback.plan,
        proposal: fallback.proposal,
        changes: rehearse(flow, kernel, fallback.proposal).lines,
        elapsedMs: result.elapsedMs,
        skills: fallback.proposal.skillActivations,
      };
      patchTurn(flow, slot.sessionId, turnId, () => proposal);
      say(flow, 'proposal.ready');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'plan', applied: false });
    }
    return;
  }

  if (result.tasks.length === 0) {
    /*
      NOTHING WAS WRITTEN: refused at the question, stopped while it was open, or stopped
      before the skeleton landed. A card that a Discard or a newer request answered keeps
      its own ending; anything else is a plain stop, with nothing to undo.
    */
    if (current?.kind === 'page-plan' && !flow.runtime.superseded.has(turnId)) {
      patchTurn(flow, slot.sessionId, turnId, () => ({
        id: turnId,
        kind: 'end',
        key: 'planDiscarded',
      }));
    } else if (current?.kind === 'build') {
      patchTurn(flow, slot.sessionId, turnId, () => ({
        id: turnId,
        kind: 'end',
        key: 'stoppedBeforeChange',
      }));
      markNotRun(flow, slot.sessionId, anchor);
      say(flow, 'stopped.none');
    }
    env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    return;
  }

  if (result.scaffold?.status === 'applied') env.memory.note(result.scaffold.proposal);
  learnStoryBible(env, kernel);
  flow.runtime.builds.set(turnId, { kernel, result });
  const transactionIds = buildTransactions(flow, slot, kernel, logBefore, plan);
  patchKind(flow, slot.sessionId, turnId, 'build', (turn) => ({
    ...turn,
    progress:
      turn.progress.report === null
        ? reduceBuildProgress(turn.progress, completedFrom(turn.progress, result))
        : turn.progress,
    status: 'settled',
    ...(result.pagePlan === undefined ? {} : { pagePlan: result.pagePlan }),
    transactionIds,
  }));
  const after = locateTurn(flow, turnId)?.turn;
  if (after?.kind !== 'build') return;
  const landed = landedCount(after.progress);
  const total = after.progress.tasks.length;
  const stopped =
    result.outcome === 'signal' || result.outcome === 'budget' || result.outcome === 'max-tasks';
  const announcement = buildEndAnnouncement({
    phase: stopped ? 'stopped' : landed === total ? 'done' : landed === 0 ? 'failed' : 'partial',
    stopReason:
      result.outcome === 'budget'
        ? 'budget'
        : result.outcome === 'max-tasks'
          ? 'maxTasks'
          : 'signal',
    landed,
    total,
    skeleton: after.progress.tasks.some((task) => task.status !== 'landed'),
  });
  if (announcement !== null) say(flow, announcement.key, announcement.params);
  if (landed > 0) {
    insertAfter(
      flow,
      slot.sessionId,
      turnId,
      plan.notes.map((key): Turn => ({ id: env.sessions.nextId('turn'), kind: 'end', key })),
    );
  }
  env.mood.settleTurn(
    stopped
      ? { runId: slot.runId, outcome: 'stopped' }
      : { runId: slot.runId, outcome: 'plan', applied: landed > 0 },
  );
}

export function failBuild(
  flow: Flow,
  slot: Slot,
  turnId: string,
  anchor: string | null,
  request: string,
  cause: unknown,
  /** T230: this page's own transactions, on one page of a site (`BuildPlan.landed`). */
  pageTransactions: () => readonly string[] = () => collected(flow, slot),
): void {
  const env = flow.env();
  const turn = locateTurn(flow, turnId)?.turn;
  if (turn?.kind === 'page-plan') {
    // Answered by Discard or by a newer request while it was held.
    if (!flow.runtime.superseded.has(turnId)) {
      patchTurn(flow, slot.sessionId, turnId, () => ({
        id: turnId,
        kind: 'end',
        key: 'planDiscarded',
      }));
    }
    env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    return;
  }
  if (turn?.kind !== 'build') return;
  const progress = turn.progress;
  const landed = landedCount(progress);
  if (slot.controller.signal.aborted) {
    if (progress.tasks.length === 0) {
      patchTurn(flow, slot.sessionId, turnId, () => ({
        id: turnId,
        kind: 'end',
        key: 'stoppedBeforeChange',
      }));
      markNotRun(flow, slot.sessionId, anchor);
      say(flow, 'stopped.none');
    } else {
      // Stopped mid-build: the rows the engine settled stay, the rest were not written.
      patchKind(flow, slot.sessionId, turnId, 'build', (current) => {
        const { stopping: _stopping, ...rest } = current;
        void _stopping;
        return { ...rest, status: 'settled', transactionIds: pageTransactions() };
      });
      const announcement = buildEndAnnouncement({
        phase: 'stopped',
        stopReason: 'signal',
        landed,
        total: progress.tasks.length,
        skeleton: true,
      });
      if (announcement !== null) say(flow, announcement.key, announcement.params);
    }
    env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
    return;
  }
  const failure = failureOf(cause);
  if (progress.tasks.length === 0) {
    patchTurn(flow, slot.sessionId, turnId, () =>
      failureTurn(
        turnId,
        request,
        cause,
        { kind: 'unchanged' },
        flow.clock.now() - progress.startedAt,
      ),
    );
    say(flow, 'failed');
  } else {
    patchKind(flow, slot.sessionId, turnId, 'build', (current) => ({
      ...current,
      status: 'failed',
      failure,
      transactionIds: pageTransactions(),
    }));
    say(flow, landed > 0 ? 'failed.kept' : 'failed.skeleton');
  }
  env.mood.settleTurn({ runId: slot.runId, outcome: 'refused', retryable: failure.retryable });
}
