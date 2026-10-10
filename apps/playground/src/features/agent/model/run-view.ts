import type { AiRunFailure } from '@craftkit/builder';

import { lastEvidenceAt, type BuildProgress, type BuildTask } from './build-progress';
import { estimateRemainingMs } from './estimate-remaining';
import {
  classifyRunFailure,
  classifySectionFailure,
  errorClassOfSections,
  isRetryableErrorClass,
} from './failure-class';
import { runStageKey, type RunProgress } from './run-progress';
import { outcomeKeyOf, type BuildTurn, type ErrorTurn } from './turns';
import type {
  AgentCapabilities,
  AnswerView,
  BuildActionsView,
  BuildPhase,
  BuildRecordView,
  BuildStopReason,
  ChangeLineView,
  DirectionView,
  EditOrigin,
  EditPhase,
  EditRecordView,
  ErrorBodyView,
  ErrorPageState,
  ErrorView,
  FactView,
  FailureClass,
  RecordMenuItem,
  RowState,
  SpineRowView,
  UndoView,
} from './view-types';

/**
 * Turn + progress → the record views components render (SPEC §7.3, §4.8, §4.9, §4.14).
 *
 * Every honesty rule of SPEC §6.5 that is about what a record SAYS is decided here, once,
 * so no component can decide it differently:
 * - Ink means landed: a row is `landed` and counts toward `landed/total` only after its
 *   `task.completed`; a finished draft is `drafted`, never counted.
 * - "Page built" only when `build.completed.applied === total`; anything less is partial.
 * - Row Undo only after `build.completed` (the landing record arrives with it), and never
 *   a working one on a record revived after a reload.
 * - One clock per run: no final time while live (the RunBar owns the clock), the build's
 *   own `elapsedMs` once ended, the last evidence for a revived one.
 * - No engine text: failures are classified (`failure-class.ts`); the raw text reaches
 *   only `ErrorBodyView.details`, which only ever goes to the clipboard.
 * - No wall clock: every time a record shows comes from the run's own events, so a view
 *   rebuilt on a clock tick or a keystroke is the same view (SPEC §4.8).
 *
 * Pure: the capabilities and the developer flag come in through the context.
 */

export interface RunViewContext {
  /**
   * Not read. The estimate once used it and moved on every re-render; it now reads the
   * build's newest event instead. Optional so callers written against the first contract
   * still compile; drop it at cutover.
   */
  readonly now?: number | undefined;
  readonly capabilities: AgentCapabilities;
  /** The developer flag: RecordMenu offers Technical details (SPEC §4.15). */
  readonly developer: boolean;
}

/**
 * What happened to one landed section after its build, keyed on the input by
 * `outcomeKeyOf(task)`: the transaction id that LANDED it (SPEC §7.4: per-section outcomes
 * by transaction id), or `v1-section:<id>` for a v1 section, which never recorded one.
 * `turns.ts` stores exactly this type (`LandingOutcome`).
 * - `undone`: off the page. `transactionId` is the transaction the controller wrote to take
 *   it off, which Redo reverses; absent only on v1 data, whose record is revived and so
 *   never offers a working Redo.
 * - `redone`: back on the page through `transactionId`, which the next Undo reverses.
 * - `refused`: `revertBuildSection`'s honest no (`changed-since`, `region-missing`); the
 *   row keeps its ink and says why Undo is unavailable.
 */
export type SectionOutcome =
  | { readonly kind: 'undone'; readonly transactionId?: string | undefined }
  | { readonly kind: 'redone'; readonly transactionId: string }
  | { readonly kind: 'refused'; readonly why: 'changedSince' | 'regionMissing' };

/** A run that ended by throwing, not by its own events (SPEC §4.14). */
export interface RunFailureInput {
  readonly failure: AiRunFailure;
  /** When the run ended, by the caller's clock. */
  readonly at: number;
  /** `navigator.onLine === false` when it failed. */
  readonly offline?: boolean | undefined;
}

/**
 * The whole build's place in kernel history, from the controller: until engine E3 lands
 * Undo build is a kernel undo of exactly this build's transactions, valid only while
 * they are the newest history entries (SPEC §7.6 E3).
 */
export interface BuildHistoryInput {
  readonly undone: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/**
 * A build turn as the record reads it. A stored `BuildTurn` becomes one through
 * `buildRecordInputOf`, and the controller adds what only the live session knows.
 */
export interface BuildRecordInput {
  readonly turnId: string;
  readonly progress: BuildProgress;
  /** Read back from storage after a reload: its history belongs to a session that is gone. */
  readonly revived: boolean;
  /** Stop was pressed and the engine has not yet reported the build's end. */
  readonly stopping: boolean;
  /**
   * The run's promise settled in this session. With no `build.completed` that means an
   * abort ended it (Stop during the skeleton throws without a single build event after).
   */
  readonly settled?: boolean | undefined;
  readonly failure?: RunFailureInput | undefined;
  readonly outcomes?: Readonly<Record<string, SectionOutcome>> | undefined;
  readonly history?: BuildHistoryInput | undefined;
  /** Interrupted only: the section list was saved, so "Finish the rest" can run. */
  readonly resumable?: boolean | undefined;
  /** `removeUnfilledSections` ran: every unfilled region is gone from the page. */
  readonly placeholdersRemoved?: boolean | undefined;
  /** Structured direction (engine E7); without it the direction prose is shown. */
  readonly direction?: DirectionView | undefined;
  /**
   * The sample-details ledger (engine E4). Absent: read from the build's own reports, whose
   * sections carry the plan's facts since 2026-09-28 (`AiBuildTaskReport.facts`).
   */
  readonly facts?: readonly FactView[] | undefined;
  /** A newer turn exists and this record is folded (SPEC §4.4). */
  readonly collapsed?: boolean | undefined;
  /** The page changed after this request, so "Restore page" means something (SPEC §4.15). */
  readonly laterPageChanges?: boolean | undefined;
}

const NO_ACTIONS: BuildActionsView = {
  undoBuild: false,
  redoBuild: false,
  finishRest: 0,
  removeEmpty: 0,
  retryFailed: 0,
};

const LIVE_PHASES: ReadonlySet<BuildPhase> = new Set(['skeleton', 'building', 'stopping']);

function stopReasonOf(outcome: string): BuildStopReason | null {
  switch (outcome) {
    case 'signal':
      return 'signal';
    case 'budget':
      return 'budget';
    case 'max-tasks':
      return 'maxTasks';
    default:
      return null;
  }
}

/** The part of the record menu every settled record shares, in RecordMenuItem order. */
function settledMenu(
  copy: 'copySummary' | 'copyAnswer' | 'copyError' | null,
  context: RunViewContext,
  restore: boolean,
): readonly RecordMenuItem[] {
  return [
    ...(restore && context.capabilities.restore ? (['restore'] as const) : []),
    'reuse',
    ...(copy === null ? [] : [copy]),
    ...(context.developer ? (['technical'] as const) : []),
  ];
}

/** Collapse the direction prose onto one line; the component clips it with an ellipsis. */
function proseDirection(direction: string): DirectionView | undefined {
  const mood = direction.replace(/\s+/gu, ' ').trim();
  return mood === '' ? undefined : { mood };
}

interface Derived {
  readonly phase: BuildPhase;
  readonly stopReason?: BuildStopReason;
  /** The rows are dead: nothing more will be written into them. */
  readonly ended: boolean;
}

/** SPEC §4.8's phase table, in precedence order. Null: not a build record. */
function derivePhase(input: BuildRecordInput): Derived | null {
  const { progress } = input;
  if (progress.phase === 'fallback') return null;
  const report = progress.report;
  const live =
    !input.revived && report === null && input.failure === undefined && input.settled !== true;
  const stopping = input.stopping || progress.stopReason === 'signal';

  if (progress.tasks.length === 0) {
    // A Stop here stays the skeleton: `stopping` heads with the count, and before
    // build.planned there is nothing to count (it read "0/0"). The RunBar says "Stopping".
    if (live) return { phase: 'skeleton', ended: false };
    if (input.failure !== undefined) return { phase: 'failed', ended: true };
    // Stopped or reloaded before any section existed: an EndNote, not a build.
    return null;
  }
  if (input.history?.undone === true) return { phase: 'undone', ended: true };
  if (input.failure !== undefined) return { phase: 'failed', ended: true };
  if (report !== null) {
    const stopReason = stopReasonOf(report.outcome);
    if (stopReason !== null) return { phase: 'stopped', stopReason, ended: true };
    if (report.applied === progress.tasks.length) return { phase: 'done', ended: true };
    return { phase: report.applied === 0 ? 'failed' : 'partial', ended: true };
  }
  if (input.revived) return { phase: 'interrupted', ended: true };
  if (input.settled === true) return { phase: 'stopped', stopReason: 'signal', ended: true };
  return { phase: stopping ? 'stopping' : 'building', ended: false };
}

function rowState(
  task: BuildTask,
  derived: Derived,
  outcome: SectionOutcome | undefined,
): RowState {
  switch (task.status) {
    case 'landed':
      return derived.phase === 'undone' || outcome?.kind === 'undone' ? 'undone' : 'landed';
    case 'failed':
      return 'failed';
    case 'notWritten':
      return 'notWritten';
    case 'writing':
      if (derived.ended) return 'notWritten';
      return task.attempts >= 2 ? 'retrying' : 'writing';
    case 'drafted':
      return derived.ended ? 'notWritten' : 'drafted';
    case 'waiting':
      return derived.ended ? 'notWritten' : 'waiting';
  }
}

function sectionReason(task: BuildTask): FailureClass {
  return classifySectionFailure({
    reason: task.reason,
    reasonCode: task.reasonCode,
    failure: task.failure,
    drafted: task.draftedAt !== undefined,
  });
}

function rowUndo(
  input: BuildRecordInput,
  task: BuildTask,
  state: RowState,
  derived: Derived,
  capabilities: AgentCapabilities,
  outcome: SectionOutcome | undefined,
): UndoView | undefined {
  if (!capabilities.rowUndo || input.progress.report === null) return undefined;
  if (derived.phase === 'undone' || (state !== 'landed' && state !== 'undone')) return undefined;
  if (input.revived) return { kind: 'unavailable', why: 'revived' };
  const landing = task.landing;
  if (landing === undefined) return undefined;
  switch (outcome?.kind) {
    case 'undone':
      // No id to reverse (v1 data): say why there is no Redo rather than offer a dead one.
      return outcome.transactionId === undefined
        ? { kind: 'unavailable', why: 'revived' }
        : { kind: 'redo', transactionId: outcome.transactionId };
    case 'redone':
      return { kind: 'undo', transactionId: outcome.transactionId };
    case 'refused':
      return { kind: 'unavailable', why: outcome.why };
    case undefined:
      return { kind: 'undo', transactionId: landing.transactionId };
  }
}

function spineRows(
  input: BuildRecordInput,
  derived: Derived,
  capabilities: AgentCapabilities,
): readonly SpineRowView[] {
  const { tasks } = input.progress;
  return tasks.map((task) => {
    // By `outcomeKeyOf`, the key `BuildTurn.outcomes` is stored under: a v1 section's undo
    // is keyed by its section id, and reading only landing ids left it inked (turn-25).
    const outcome = input.outcomes?.[outcomeKeyOf(task)];
    const state = rowState(task, derived, outcome);
    const unfilled = state === 'notWritten' || state === 'failed';
    // A row is a button only while its section exists on the page (SPEC §4.8 SpineRow).
    const present = derived.phase !== 'undone' && !(unfilled && input.placeholdersRemoved === true);
    const undo = rowUndo(input, task, state, derived, capabilities, outcome);
    return {
      key: task.id,
      ...(present ? { nodeId: task.id } : {}),
      position: task.position,
      total: tasks.length,
      title: task.title,
      state,
      ...(state === 'failed' ? { reason: sectionReason(task) } : {}),
      ...(undo === undefined ? {} : { undo }),
      // `present` already rules out an undone build, whose regions went with it.
      canRetry: state === 'failed' && derived.ended && present,
    };
  });
}

function buildActions(
  input: BuildRecordInput,
  derived: Derived,
  rows: readonly SpineRowView[],
): BuildActionsView {
  const onPage = (row: SpineRowView) => row.nodeId !== undefined;
  const notWritten = rows.filter((row) => row.state === 'notWritten' && onPage(row)).length;
  const unfilled = rows.filter(
    (row) => (row.state === 'notWritten' || row.state === 'failed') && onPage(row),
  ).length;
  const canUndo = !input.revived && input.history?.canUndo === true;
  switch (derived.phase) {
    case 'done':
      return { ...NO_ACTIONS, undoBuild: canUndo };
    case 'partial':
      return {
        ...NO_ACTIONS,
        undoBuild: canUndo,
        retryFailed: rows.filter((row) => row.canRetry).length,
      };
    case 'stopped':
      return { ...NO_ACTIONS, finishRest: notWritten, removeEmpty: unfilled };
    case 'interrupted':
      return {
        ...NO_ACTIONS,
        finishRest: input.resumable === true ? notWritten : 0,
        removeEmpty: unfilled,
      };
    case 'undone':
      return { ...NO_ACTIONS, redoBuild: !input.revived && input.history?.canRedo === true };
    default:
      // Live phases have no footer (Stop is in the RunBar); `failed` has Try again, and
      // its "Remove the empty layout" rides on the error's page state.
      return NO_ACTIONS;
  }
}

/** Technical text for "Copy error details" (clipboard only, never rendered). */
function failureDetails(failure: AiRunFailure): string {
  const status = failure.status === undefined ? '' : ` ${String(failure.status)}`;
  return `${failure.source}/${String(failure.code)}${status}: ${failure.message}`;
}

function buildError(
  input: BuildRecordInput,
  rows: readonly SpineRowView[],
  landed: number,
): ErrorBodyView {
  const { progress } = input;
  const unfilledOnPage = rows.some((row) => row.state !== 'landed' && row.nodeId !== undefined);
  const pageState: ErrorPageState =
    landed > 0
      ? { kind: 'kept', landed }
      : unfilledOnPage
        ? { kind: 'skeleton' }
        : { kind: 'unchanged' };
  if (input.failure !== undefined) {
    const failure = classifyRunFailure(input.failure.failure, { offline: input.failure.offline });
    return {
      failure,
      pageState,
      retryable: isRetryableErrorClass(failure),
      details: failureDetails(input.failure.failure),
    };
  }
  // Every section failed: the build is named by what failed them.
  const failed = progress.tasks.filter((task) => task.status === 'failed');
  const failure = errorClassOfSections(failed.map(sectionReason));
  return {
    failure,
    pageState,
    retryable: isRetryableErrorClass(failure),
    details: failed
      .map((task) => `${String(task.position)}. ${task.title}: ${task.reason ?? ''}`)
      .join('\n'),
  };
}

function buildElapsed(input: BuildRecordInput, derived: Derived): number | undefined {
  if (LIVE_PHASES.has(derived.phase) || derived.phase === 'interrupted') return undefined;
  const { progress } = input;
  if (progress.report !== null) return progress.report.elapsedMs;
  const end = input.failure?.at ?? lastEvidenceAt(progress);
  return Number.isFinite(end) && Number.isFinite(progress.startedAt)
    ? Math.max(0, end - progress.startedAt)
    : undefined;
}

/*
  The facts the build's reports carry, in page order, each shown where it appears: the
  section's title, and its region to reveal. A section no longer on the page is still
  listed, because its sample may have been copied elsewhere; the row just cannot reveal.
*/
function factsOf(progress: BuildProgress): readonly FactView[] {
  return progress.tasks.flatMap((task) =>
    (task.facts ?? []).map((fact) => ({
      sample: fact.sample,
      section: task.title,
      nodeId: task.id,
    })),
  );
}

function buildMenu(
  input: BuildRecordInput,
  derived: Derived,
  context: RunViewContext,
): readonly RecordMenuItem[] {
  switch (derived.phase) {
    case 'skeleton':
    case 'building':
    case 'stopping':
      return [];
    case 'failed':
      return settledMenu('copyError', context, false);
    case 'interrupted':
    case 'undone':
      return settledMenu('copySummary', context, false);
    default:
      return settledMenu('copySummary', context, !input.revived && input.laterPageChanges === true);
  }
}

/**
 * A build turn's record, or null when the turn is not a build record: after a fallback
 * (it renders as an EditRecord, SPEC §4.8) or when it ended before any section existed
 * (an EndNote: `stoppedBeforeChange`, or `interrupted` for a revived one, SPEC §4.10).
 */
export function buildRecordView(
  input: BuildRecordInput,
  context: RunViewContext,
): BuildRecordView | null {
  const derived = derivePhase(input);
  if (derived === null) return null;
  const { capabilities } = context;
  const rows = spineRows(input, derived, capabilities);
  const landed = rows.filter((row) => row.state === 'landed').length;
  const elapsedMs = buildElapsed(input, derived);
  const direction =
    capabilities.structuredDirection && input.direction !== undefined
      ? input.direction
      : proseDirection(input.progress.direction);
  return {
    turnId: input.turnId,
    phase: derived.phase,
    ...(derived.stopReason === undefined ? {} : { stopReason: derived.stopReason }),
    landed,
    total: rows.length,
    writers: input.progress.writers,
    ...(elapsedMs === undefined ? {} : { elapsedMs }),
    /*
      Read at the newest build event, never at `context.now`: this view is rebuilt on every
      clock tick and every keystroke in the composer, and the same rows read at the caller's
      clock said 50s, 40s, then nothing as time passed. At the last event the line moves only
      when the build does (SPEC §4.8), and a writer's elapsed time stops at its last evidence,
      so the estimate errs long, never short.
    */
    remainingMs:
      derived.phase === 'building' && capabilities.estimate
        ? estimateRemainingMs(input.progress, input.progress.lastEventAt)
        : null,
    ...(direction === undefined ? {} : { direction }),
    rows,
    facts: capabilities.facts ? (input.facts ?? factsOf(input.progress)) : [],
    collapsed: input.collapsed ?? false,
    revived: input.revived,
    actions: buildActions(input, derived, rows),
    menu: buildMenu(input, derived, context),
    ...(derived.phase === 'failed' ? { error: buildError(input, rows, landed) } : {}),
  };
}

/* ── Edits (SPEC §4.9) ─────────────────────────────────────────────────────────── */

/** An edit turn as the controller holds it. */
export interface EditRecordInput {
  readonly turnId: string;
  readonly origin: EditOrigin;
  /** The block it edits, by display name; absent for the whole page. */
  readonly target?: string | undefined;
  readonly run: RunProgress;
  readonly revived: boolean;
  /**
   * The run finished applying. `at` is when, by the caller's clock. `transactionId` is the
   * kernel transaction that landed, absent when nothing did. `empty` is
   * `planImpact(...).empty`: pass it whenever it is known, because only it can say that a
   * transaction which landed moved nothing.
   */
  readonly applied?:
    | {
        readonly changes: readonly ChangeLineView[];
        readonly transactionId?: string | undefined;
        readonly empty?: boolean | undefined;
        readonly revealNodeId?: string | undefined;
        readonly at: number;
      }
    | undefined;
  readonly stopped?: { readonly at: number } | undefined;
  /** Undone; `transactionId` is the undo's own, which Redo reverses. */
  readonly undone?: { readonly transactionId: string } | undefined;
  /** Kernel history can no longer undo it cleanly. */
  readonly undoUnavailable?: 'changedSince' | 'regionMissing' | undefined;
  readonly laterPageChanges?: boolean | undefined;
}

/**
 * Whether the applied run changed the page. A transaction that landed is that evidence,
 * lines or none: `impactLines` now reads a style change or a move as a `restyled` / `moved`
 * line, but a change it has no line for (a prop outside every schema it can read) still
 * landed, and reading it as `noChange` told the person the page had not moved and hid its
 * Undo. `planImpact(...).empty`, when the caller has it, is the only thing that can say a
 * landed transaction moved nothing.
 */
function editLanded(applied: NonNullable<EditRecordInput['applied']>): boolean {
  if (applied.empty !== undefined) return !applied.empty;
  return applied.transactionId !== undefined || applied.changes.length > 0;
}

function editPhase(input: EditRecordInput): EditPhase {
  if (input.undone !== undefined) return 'undone';
  if (input.stopped !== undefined) return 'stopped';
  if (input.applied !== undefined) return editLanded(input.applied) ? 'done' : 'noChange';
  // A revived edit that never finished did not change the page (WP-05 migrates these
  // to an EndNote; this is the safe reading if one reaches here).
  return input.revived ? 'stopped' : 'running';
}

function editUndo(input: EditRecordInput, phase: EditPhase): UndoView | undefined {
  if (phase === 'undone' && input.undone !== undefined) {
    return input.revived
      ? { kind: 'unavailable', why: 'revived' }
      : { kind: 'redo', transactionId: input.undone.transactionId };
  }
  const transactionId = input.applied?.transactionId;
  if (phase !== 'done' || transactionId === undefined) return undefined;
  if (input.revived) return { kind: 'unavailable', why: 'revived' };
  if (input.undoUnavailable !== undefined) {
    return { kind: 'unavailable', why: input.undoUnavailable };
  }
  return { kind: 'undo', transactionId };
}

function editMenu(
  input: EditRecordInput,
  phase: EditPhase,
  context: RunViewContext,
): readonly RecordMenuItem[] {
  switch (phase) {
    case 'running':
      return [];
    case 'stopped':
      return settledMenu(null, context, false);
    case 'undone':
      return settledMenu('copySummary', context, false);
    case 'done':
    case 'noChange':
      return settledMenu('copySummary', context, !input.revived && input.laterPageChanges === true);
  }
}

export function editRecordView(input: EditRecordInput, context: RunViewContext): EditRecordView {
  const phase = editPhase(input);
  const endedAt = input.stopped?.at ?? input.applied?.at;
  const elapsedMs =
    phase === 'running' || endedAt === undefined
      ? undefined
      : Math.max(0, endedAt - input.run.startedAt);
  const stage = phase === 'running' ? (runStageKey(input.run) ?? 'edit.started') : undefined;
  const undo = editUndo(input, phase);
  const revealNodeId = phase === 'done' ? input.applied?.revealNodeId : undefined;
  const changes = input.applied?.changes ?? [];
  return {
    turnId: input.turnId,
    phase,
    origin: input.origin,
    ...(input.target === undefined ? {} : { target: input.target }),
    ...(stage === undefined ? {} : { stage }),
    changes,
    // Landed, and no line reads it: the record says so in words, and keeps its Undo.
    ...(phase === 'done' && changes.length === 0 ? { unlisted: true } : {}),
    ...(elapsedMs === undefined ? {} : { elapsedMs }),
    ...(revealNodeId === undefined ? {} : { revealNodeId }),
    ...(undo === undefined ? {} : { undo }),
    menu: editMenu(input, phase, context),
  };
}

/* ── Errors and answers (SPEC §4.14, §4.10) ────────────────────────────────────── */

export interface ErrorRecordInput {
  readonly turnId: string;
  readonly failure: AiRunFailure;
  readonly offline?: boolean | undefined;
  /** What the turn stored about the page; when given it wins over `landed` / `skeleton`. */
  readonly pageState?: ErrorPageState | undefined;
  /** Sections that landed before the error. */
  readonly landed?: number | undefined;
  /** An empty skeleton is still on the page. */
  readonly skeleton?: boolean | undefined;
}

/** A stored error turn as `errorRecordView` reads it: nothing converted, nothing dropped. */
export function errorRecordInputOf(turn: ErrorTurn): ErrorRecordInput {
  return {
    turnId: turn.id,
    failure: turn.failure,
    pageState: turn.pageState,
    ...(turn.offline === true ? { offline: true } : {}),
  };
}

/**
 * A stored build turn as `buildRecordView` reads it: what the turn itself knows. The
 * controller spreads what only the live session knows over it (`history` from the kernel,
 * `resumable`, `placeholdersRemoved`, `collapsed`, `laterPageChanges`, `direction`).
 * `settled` is `status === 'settled'`: the engine ended it, with or without a report yet.
 */
export function buildRecordInputOf(turn: BuildTurn): BuildRecordInput {
  return {
    turnId: turn.id,
    progress: turn.progress,
    revived: turn.revived === true,
    stopping: turn.stopping === true,
    settled: turn.status === 'settled',
    outcomes: turn.outcomes,
    ...(turn.failure === undefined
      ? {}
      : { failure: { failure: turn.failure, at: lastEvidenceAt(turn.progress) } }),
    ...(turn.undone === true ? { history: { undone: true, canUndo: false, canRedo: false } } : {}),
  };
}

export function errorRecordView(input: ErrorRecordInput, context: RunViewContext): ErrorView {
  const failure = classifyRunFailure(input.failure, { offline: input.offline });
  const landed = input.landed ?? 0;
  const pageState: ErrorPageState =
    input.pageState ??
    (landed > 0
      ? { kind: 'kept', landed }
      : input.skeleton === true
        ? { kind: 'skeleton' }
        : { kind: 'unchanged' });
  return {
    turnId: input.turnId,
    failure,
    pageState,
    retryable: isRetryableErrorClass(failure),
    details: failureDetails(input.failure),
    menu: settledMenu('copyError', context, false),
  };
}

export function answerRecordView(
  turnId: string,
  text: string,
  context: RunViewContext,
): AnswerView {
  return { turnId, text, menu: settledMenu('copyAnswer', context, false) };
}
