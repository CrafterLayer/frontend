import type {
  AiAgentEvent,
  AiBuildEvent,
  AiBuildOutcome,
  AiBuildOwnEvent,
  AiBuildSkipReasonCode,
  AiBuildStopReason,
  AiBuildTaskFact,
  AiBuildTaskReport,
  AiRunFailure,
} from '@craftkit/builder';

import { classifySectionFailure } from './failure-class';
import { initialRunProgress, reduceRunProgress, type RunProgress } from './run-progress';
import type { FailureClass } from './view-types';

/**
 * A SPLIT BUILD as rows (SPEC §4.8, §7.4 `AssistantPanel.build.ts`).
 *
 * The orchestrator (`runAiBuild`) narrates itself: a skeleton, a section list, then a
 * `task.started` … `task.completed | task.skipped` run per section, interleaved with
 * every step's own `AiAgentEvent`s. This module is the only place that turns that
 * stream into rows, and it is PURE: no clock, no kernel, no React. Times come from the
 * events' own `at` stamps, so a replayed build and a live one produce identical rows.
 *
 * Copied from the v1 module, then changed where SPEC §7.4 says:
 * - Step events are attributed by RUN ID. The build's own events carry its id, each
 *   step carries `<build>/<step>` (`scaffold`, `fill-N`, `fallback`). v1 fed every step
 *   event to "whatever is open right now" on the belief that steps ran strictly one at
 *   a time; since 2026-09-28 up to six writers run at once (`fillConcurrencyFor`), and
 *   that belief attributed one writer's events to another's section.
 * - A writer that FINISHED is not a section that LANDED. `fill-N` emits
 *   `run.completed {status: 'proposed'}` when its draft is done; the section lands
 *   later, in page order, on `task.completed`. v1 had no word between "Working" and
 *   "Done", so a finished draft waiting its turn read as still working.
 * - Tasks keep attempt start times (the estimate measures writes, SPEC §4.8) and the
 *   landing record from `build.completed` (row Undo is keyed by its transaction id).
 * - `landedCount` replaces `buildCount`, which counted skipped sections as progress:
 *   "4/8" said four were on the page when two of them had failed (SPEC §1 "Ink means
 *   landed").
 * - Deleted: `TASK_STATUS_LABEL` (English words; the catalog owns copy),
 *   `taskTransactionLabel` (undo by label reached the newer build from the older card)
 *   and `buildEta` (average × remaining: 240s where the pool finishes in 90s;
 *   `estimate-remaining.ts` replaces it).
 * - The provider's narration (`plan.progress`) is no longer kept here: it is never
 *   shown (SPEC §4.9), and a persisted record has no use for 32 lines of it.
 */

/**
 * Where one section is. `writing` covers both attempts (`attempts` says which);
 * `drafted` is a finished writer whose section waits its turn to land; `notWritten`
 * comes only from `build.completed` (the report's `not-started`): the build ended first.
 */
export type BuildTaskStatus =
  'waiting' | 'writing' | 'drafted' | 'landed' | 'failed' | 'notWritten';

/** Where a landed section came from, so it can be put back forward (`revertBuildSection`). */
export type BuildSectionLanding = NonNullable<AiBuildTaskReport['landing']>;

export interface BuildTask {
  /** The region's node id, which is also the row's key. */
  readonly id: string;
  readonly title: string;
  /** 1-based, page order. */
  readonly position: number;
  readonly status: BuildTaskStatus;
  /** Fill attempts begun so far: 0 while waiting, 1 or 2 otherwise. */
  readonly attempts: number;
  /** When the FIRST attempt began: a retry belongs to the same section's clock. */
  readonly startedAt?: number;
  /** When the LATEST attempt began: what a write duration is measured from. */
  readonly attemptStartedAt?: number;
  /** When the latest attempt's writer finished its draft; cleared by a new attempt. */
  readonly draftedAt?: number;
  /** When the section landed or failed. */
  readonly settledAt?: number;
  /** First attempt to settlement. */
  readonly elapsedMs?: number;
  /** The engine's reason for a failure or a not-started section: read, never rendered. */
  readonly reason?: string;
  /**
   * `reason` as data (engine E5, `task.skipped.reasonCode` and the report's), what
   * `failure-class.ts` reads first; absent on a build recorded before the engine sent it.
   */
  readonly reasonCode?: AiBuildSkipReasonCode;
  /** The latest attempt's own run failure, as classification evidence. */
  readonly failure?: AiRunFailure;
  /** From `build.completed`, present exactly when the section landed. */
  readonly landing?: BuildSectionLanding;
  /** Steps the target guard dropped from this section's plan. */
  readonly outOfScope?: number;
  /** The plan's sample facts this section shows (engine E4), from `build.completed`. */
  readonly facts?: readonly AiBuildTaskFact[];
  /** The `SectionContract.key` it was built from, on a page-plan build. */
  readonly sectionKey?: string;
}

/**
 * How far the build is. `stopped` means `build.stopped` arrived: with `report` still
 * null, sections already in flight may yet land (a budget stop lets them finish).
 * `fallback`: the skeleton made fewer than two regions and one ordinary run replaced
 * the build, so nothing build-shaped may be shown (SPEC §4.8, it renders as an edit).
 */
export type BuildProgressPhase =
  'scaffolding' | 'planned' | 'building' | 'stopped' | 'completed' | 'fallback';

/** `build.completed`'s summary: the build's own last word. */
export interface BuildReport {
  readonly applied: number;
  readonly skipped: number;
  readonly elapsedMs: number;
  readonly outcome: AiBuildOutcome;
}

export interface BuildProgress {
  readonly runId: string;
  readonly phase: BuildProgressPhase;
  /** The scaffold's rationale, verbatim: every section obeyed this text. */
  readonly direction: string;
  readonly tasks: readonly BuildTask[];
  /** When the build began (the caller's clock at dispatch). Set once and never moved. */
  readonly startedAt: number;
  /**
   * How many sections are written at once (SPEC §7.6 E1): `build.planned.writers` when
   * the engine sends it, else whatever `withWriters` was told; null means unknown, and
   * then there is no estimate.
   */
  readonly writers: number | null;
  /** The skeleton step's rows (Technical details); null after a fallback. */
  readonly skeleton: RunProgress | null;
  readonly stopReason?: AiBuildStopReason;
  /** Null until `build.completed`: landing records are final only then. */
  readonly report: BuildReport | null;
  /** Why the split was abandoned for one ordinary run. */
  readonly fallbackReason?: string;
  /** The newest event stamp that moved this record: evidence the build was alive. */
  readonly lastEventAt: number;
}

/** What an ending says about a build, for the clipboard summary. Counts, no prose. */
export interface BuildReceipt {
  readonly landed: number;
  readonly total: number;
  readonly elapsedMs: number;
  readonly stopped: boolean;
  readonly failed: readonly {
    readonly position: number;
    readonly title: string;
    readonly failure: FailureClass;
  }[];
  readonly notWritten: number;
}

export function initialBuildProgress(runId: string, now: number): BuildProgress {
  return {
    runId,
    phase: 'scaffolding',
    direction: '',
    tasks: [],
    startedAt: now,
    writers: null,
    // The skeleton is an ordinary applying run, and the first thing a person waits on.
    skeleton: initialRunProgress('auto', now),
    report: null,
    lastEventAt: now,
  };
}

/**
 * The pool size learned some other way than `build.planned.writers`, e.g. the engine's
 * `fillConcurrencyFor` once it is exported (SPEC §7.6 E1). Same reference if unchanged.
 */
export function withWriters(progress: BuildProgress, writers: number): BuildProgress {
  const pool = Number.isSafeInteger(writers) && writers > 0 ? writers : null;
  return pool === progress.writers ? progress : { ...progress, writers: pool };
}

/** `build.planned.writers`, read structurally so the reducer works before and after E1. */
function writersOf(event: Extract<AiBuildOwnEvent, { type: 'build.planned' }>): number | null {
  const declared: unknown = 'writers' in event ? event.writers : undefined;
  return typeof declared === 'number' && Number.isSafeInteger(declared) && declared > 0
    ? declared
    : null;
}

function replaceTask(
  progress: BuildProgress,
  position: number,
  change: (task: BuildTask) => BuildTask | null,
): BuildProgress {
  const index = progress.tasks.findIndex((task) => task.position === position);
  const task = progress.tasks[index];
  if (task === undefined) return progress;
  const next = change(task);
  if (next === null || next === task) return progress;
  return { ...progress, tasks: progress.tasks.with(index, next) };
}

function stamped(progress: BuildProgress, at: number): BuildProgress {
  return at > progress.lastEventAt ? { ...progress, lastEventAt: at } : progress;
}

/** A writable copy of a task, so optional fields can be dropped rather than set undefined. */
type DraftTask = { -readonly [K in keyof BuildTask]: BuildTask[K] };

/** A task without the fields a new attempt invalidates. */
function withoutAttemptEvidence(task: BuildTask): BuildTask {
  const next: DraftTask = { ...task };
  delete next.draftedAt;
  delete next.failure;
  return next;
}

function reportStatus(status: AiBuildTaskReport['status']): BuildTaskStatus {
  switch (status) {
    case 'applied':
      return 'landed';
    case 'skipped':
      return 'failed';
    case 'not-started':
      return 'notWritten';
  }
}

/** Reconcile one row against its final report: the report is the build's last word. */
function reconciled(task: BuildTask, report: AiBuildTaskReport): BuildTask {
  const rest: DraftTask = { ...task };
  delete rest.landing;
  delete rest.reason;
  delete rest.reasonCode;
  delete rest.outOfScope;
  delete rest.facts;
  delete rest.sectionKey;
  return {
    ...rest,
    status: reportStatus(report.status),
    attempts: report.attempts,
    ...(report.reason === undefined ? {} : { reason: report.reason }),
    ...(report.reasonCode === undefined ? {} : { reasonCode: report.reasonCode }),
    ...(report.landing === undefined ? {} : { landing: report.landing }),
    ...(report.facts === undefined || report.facts.length === 0 ? {} : { facts: report.facts }),
    ...(report.sectionKey === undefined ? {} : { sectionKey: report.sectionKey }),
    ...(report.outOfScope === undefined || report.outOfScope.length === 0
      ? {}
      : { outOfScope: report.outOfScope.length }),
  };
}

function reduceOwnEvent(progress: BuildProgress, event: AiBuildOwnEvent): BuildProgress {
  switch (event.type) {
    case 'build.scaffolding':
      // The skeleton is the opening phase already: idempotent, like `run.started`.
      return progress;
    case 'build.skipped':
      /*
        Not a build. The ordinary run that replaced it owns the turn from here, so the
        rows close and every later step event is a no-op: a fallback that kept ticking a
        section list would be claiming work nobody did.
      */
      return { ...progress, phase: 'fallback', fallbackReason: event.reason, skeleton: null };
    case 'build.planned': {
      const writers = writersOf(event) ?? progress.writers;
      return {
        ...progress,
        phase: 'planned',
        direction: event.direction,
        writers,
        tasks: event.tasks.map((task, index) => ({
          id: task.id,
          title: task.title,
          position: index + 1,
          status: 'waiting' as const,
          attempts: 0,
        })),
      };
    }
    case 'task.started': {
      const next = replaceTask(progress, event.position, (task) => ({
        ...withoutAttemptEvidence(task),
        status: 'writing',
        attempts: event.attempt,
        startedAt: task.startedAt ?? event.at,
        attemptStartedAt: event.at,
      }));
      // A stop is the more specific truth: sections in flight after it do not reopen it.
      return progress.phase === 'stopped' ? next : { ...next, phase: 'building' };
    }
    case 'task.completed':
      return replaceTask(progress, event.position, (task) => ({
        ...task,
        status: 'landed',
        attempts: event.attempts,
        settledAt: event.at,
        elapsedMs: Math.max(0, event.at - (task.startedAt ?? event.at)),
      }));
    case 'task.skipped':
      return replaceTask(progress, event.position, (task) => ({
        ...task,
        status: 'failed',
        attempts: event.attempts,
        reason: event.reason,
        ...(event.reasonCode === undefined ? {} : { reasonCode: event.reasonCode }),
        settledAt: event.at,
        elapsedMs: Math.max(0, event.at - (task.startedAt ?? event.at)),
      }));
    case 'build.stopped':
      return { ...progress, phase: 'stopped', stopReason: event.reason };
    case 'build.completed': {
      const reports = new Map(event.tasks.map((task) => [task.id, task]));
      return {
        ...progress,
        phase: progress.phase === 'stopped' ? 'stopped' : 'completed',
        tasks: progress.tasks.map((task) => {
          const settled = reports.get(task.id);
          return settled === undefined ? task : reconciled(task, settled);
        }),
        report: {
          applied: event.applied,
          skipped: event.skipped,
          elapsedMs: event.elapsedMs,
          outcome: event.outcome,
        },
      };
    }
  }
}

/** `<build>/fill-N[-invocation]` → N, or null for any other step. */
function fillPosition(prefix: string, runId: string): number | null {
  if (!runId.startsWith(prefix)) return null;
  const rest = runId.slice(prefix.length);
  const match = /^(\d+)(?:-\d+)?$/u.exec(rest);
  if (match === null) return null;
  const position = Number(match[1]);
  return Number.isSafeInteger(position) && position > 0 ? position : null;
}

/** One writer's own event: only its draft and its failure move the row. */
function reduceFillEvent(
  progress: BuildProgress,
  position: number,
  event: AiAgentEvent,
): BuildProgress {
  switch (event.type) {
    case 'run.completed':
      if (event.status !== 'proposed') return progress;
      return replaceTask(progress, position, (task) =>
        task.status === 'writing' ? { ...task, status: 'drafted', draftedAt: event.at } : null,
      );
    case 'run.failed':
    case 'run.cancelled':
      return replaceTask(progress, position, (task) =>
        task.status === 'writing' ? { ...task, failure: event.error } : null,
      );
    default:
      return progress;
  }
}

function reduceStepEvent(progress: BuildProgress, event: AiAgentEvent): BuildProgress {
  if (event.runId === `${progress.runId}/scaffold`) {
    if (progress.skeleton === null) return progress;
    const skeleton = reduceRunProgress(progress.skeleton, event);
    return skeleton === progress.skeleton ? progress : { ...progress, skeleton };
  }
  const position = fillPosition(`${progress.runId}/fill-`, event.runId);
  // The fallback run is an ordinary run with its own record; other ids are not ours.
  return position === null ? progress : reduceFillEvent(progress, position, event);
}

function isOwnEvent(event: AiBuildEvent): event is AiBuildOwnEvent {
  return event.type.startsWith('build.') || event.type.startsWith('task.');
}

/**
 * The event → rows mapping. Returns the SAME reference for anything that does not move
 * a row (every narration line, every stage event of a writer), so a host can compare by
 * identity and skip a render.
 */
export function reduceBuildProgress(progress: BuildProgress, event: AiBuildEvent): BuildProgress {
  let next: BuildProgress;
  if (isOwnEvent(event)) {
    if (event.runId !== progress.runId) return progress;
    next = reduceOwnEvent(progress, event);
  } else {
    next = reduceStepEvent(progress, event);
  }
  return next === progress ? progress : stamped(next, event.at);
}

/* ── Reading the rows ───────────────────────────────────────────────────────── */

/** Sections on the page: `task.completed` arrived. Never drafted, never failed. */
export function landedCount(progress: BuildProgress): number {
  return progress.tasks.filter((task) => task.status === 'landed').length;
}

/** Sections a writer is on right now (the RunBar's "Writing {n} sections"). */
export function writingCount(progress: BuildProgress): number {
  return progress.tasks.filter((task) => task.status === 'writing').length;
}

/**
 * The one section the build is waiting on (SPEC §3.4 "Blocked"): exactly one section is
 * still being written and at least one section below it is drafted, so everything
 * written after it waits its turn to land. Null otherwise.
 */
export function blockingTask(progress: BuildProgress): BuildTask | null {
  if (progress.report !== null) return null;
  const writing = progress.tasks.filter((task) => task.status === 'writing');
  const only = writing[0];
  if (writing.length !== 1 || only === undefined) return null;
  const waitsOnIt = progress.tasks.some(
    (task) => task.status === 'drafted' && task.position > only.position,
  );
  return waitsOnIt ? only : null;
}

/**
 * The last moment there is EVIDENCE the build was alive. A build revived after a reload
 * is measured to this, never to now: the wall clock kept running while the tab was
 * closed, the build did not.
 */
export function lastEvidenceAt(progress: BuildProgress): number {
  const times = progress.tasks.flatMap((task) =>
    [task.attemptStartedAt, task.draftedAt, task.settledAt].filter(
      (at): at is number => at !== undefined,
    ),
  );
  return Math.max(progress.startedAt, progress.lastEventAt, ...times);
}

/**
 * What an ENDING says about a build: how many sections landed, out of how many, in how
 * long, which failed and why (classified, never the raw text), and how many were never
 * written. Null when there is no usable clock.
 */
export function buildReceipt(progress: BuildProgress, endedAt: number): BuildReceipt | null {
  if (!Number.isFinite(progress.startedAt) || !Number.isFinite(endedAt)) return null;
  return {
    landed: landedCount(progress),
    total: progress.tasks.length,
    elapsedMs: progress.report?.elapsedMs ?? Math.max(0, endedAt - progress.startedAt),
    stopped: progress.phase === 'stopped',
    failed: progress.tasks
      .filter((task) => task.status === 'failed')
      .map((task) => ({
        position: task.position,
        title: task.title,
        failure: classifySectionFailure({
          reason: task.reason,
          reasonCode: task.reasonCode,
          failure: task.failure,
          drafted: task.draftedAt !== undefined,
        }),
      })),
    notWritten: progress.tasks.filter((task) => task.status === 'notWritten').length,
  };
}
