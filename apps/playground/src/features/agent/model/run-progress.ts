import type { AiAgentEvent } from '@craftkit/builder';

import type { EditStageKey } from './view-types';

/**
 * One ordinary run as rows (SPEC §7.4 `AssistantPanel.progress.ts`, §4.9 EditRecord).
 *
 * Copied from the v1 module, then changed where SPEC §7.4 says: a row's `detail` is a
 * catalog key (`edit.checking`), never a sentence. v1 wrote English into it ("Checking
 * again", "Repairing 2", a failure's raw provider message) and the card rendered it, so
 * the Arabic UI showed English validator text on every repair. A settled row now keeps
 * a number (`elapsedMs`) instead of a pre-formatted `mm:ss.SSS`, which Technical details
 * formats itself.
 *
 * A run has three honest phases and no more: reading (skills, context), writing
 * (propose, check, repair) and, only when it may apply, applying. The rows no longer
 * borrow GenerationProgress's `sitemap`/`structure`/`assembly` ids: no v2 component
 * renders that component, and "sitemap" named a phase this run never had.
 *
 * Pure: time comes from the events' own `at` stamps and from the caller, never from
 * `Date.now`, so a replayed run and a live one produce identical rows.
 */

export type RunStageId = 'reading' | 'writing' | 'applying';

export type RunStageStatus = 'pending' | 'active' | 'done' | 'failed' | 'cancelled';

export interface RunStage {
  readonly id: RunStageId;
  readonly status: RunStageStatus;
  /** The visible line while the row is active (SPEC §4.3 edit keys); absent once settled. */
  readonly detail?: EditStageKey;
  /** How long the row took, once settled; on an active row only from `stagesWithLiveClock`. */
  readonly elapsedMs?: number;
}

export interface RunProgress {
  readonly stages: readonly RunStage[];
  /**
   * When the run began (the events' clock). Set once and never moved: rows measure
   * themselves from `stageSince`, but a record's final time is the WHOLE run.
   */
  readonly startedAt: number;
  /** When the active row became active (the events' clock), or null once settled. */
  readonly stageSince: number | null;
  /** The row that failed, so an error can say where it broke. */
  readonly failedAt: RunStageId | null;
}

/** What an ending says: how long the run took and where it ended. */
export interface RunReceipt {
  readonly elapsedMs: number;
  /** The failed row, the cancelled row, or the one still open; null when there is no row. */
  readonly stage: RunStageId | null;
}

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;

/** The line each row shows the moment it opens; `writing` refines it while checking. */
const OPENING_KEY: Readonly<Record<RunStageId, EditStageKey>> = {
  reading: 'edit.started',
  writing: 'edit.writing',
  applying: 'edit.applying',
};

export function initialRunProgress(apply: 'never' | 'auto', now: number): RunProgress {
  const stages: RunStage[] = [
    { id: 'reading', status: 'active', detail: OPENING_KEY.reading },
    { id: 'writing', status: 'pending' },
  ];
  if (apply === 'auto') stages.push({ id: 'applying', status: 'pending' });
  return { stages, startedAt: now, stageSince: now, failedAt: null };
}

/**
 * `m:ss`: the RunClock and a record's final time (SPEC §4.8 "final time `m:ss`", §4.17).
 * Coarse on purpose, it only ticks once a second. Minutes are unpadded ("2:21", not
 * "02:21") and grow past 59 rather than rolling into hours: a build's budget is 15
 * minutes. Latin digits only (SPEC §4.0), so it is safe inside `<bdi dir="ltr">`.
 */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

export function activeStageId(progress: RunProgress): RunStageId | null {
  return progress.stages.find((stage) => stage.status === 'active')?.id ?? null;
}

/**
 * The catalog key of the live line (SPEC §4.9 "the mapped stage phrase from
 * `reduceRunProgress` → catalog keys"), or null once nothing runs. The provider's own
 * narration never reaches this line.
 */
export function runStageKey(progress: RunProgress): EditStageKey | null {
  const active = progress.stages.find((stage) => stage.status === 'active');
  if (active === undefined) return null;
  return active.detail ?? OPENING_KEY[active.id];
}

function sinceActive(progress: RunProgress, at: number): number {
  return Math.max(0, at - (progress.stageSince ?? at));
}

/** One row, settled: its live line goes, its measured time stays. */
function settledRow(id: RunStageId, status: RunStageStatus, elapsedMs: number): RunStage {
  return { id, status, elapsedMs };
}

/** Settle the active row as done and, when there is a next row, open it. */
function advance(progress: RunProgress, at: number): RunProgress {
  const index = progress.stages.findIndex((stage) => stage.status === 'active');
  if (index === -1) return progress;
  const elapsedMs = sinceActive(progress, at);
  const next = progress.stages[index + 1];
  const stages = progress.stages.map((stage, position): RunStage => {
    if (position === index) return settledRow(stage.id, 'done', elapsedMs);
    if (position === index + 1) {
      return { id: stage.id, status: 'active', detail: OPENING_KEY[stage.id] };
    }
    return stage;
  });
  return {
    stages,
    startedAt: progress.startedAt,
    stageSince: next === undefined ? null : at,
    failedAt: null,
  };
}

/** Re-key the live line of the `writing` row; the same reference when nothing changes. */
function withDetail(progress: RunProgress, detail: EditStageKey): RunProgress {
  const stage = progress.stages.find((candidate) => candidate.id === 'writing');
  if (stage?.status !== 'active' || stage.detail === detail) return progress;
  return {
    ...progress,
    stages: progress.stages.map((candidate) =>
      candidate.id === 'writing' ? { id: 'writing', status: 'active', detail } : candidate,
    ),
  };
}

/** End the run on its active row: done, failed or cancelled, measured from `stageSince`. */
function settle(
  progress: RunProgress,
  at: number,
  status: 'done' | 'failed' | 'cancelled',
): RunProgress {
  const active = activeStageId(progress);
  if (active === null) return progress;
  const elapsedMs = sinceActive(progress, at);
  return {
    stages: progress.stages.map((stage) =>
      stage.id === active ? settledRow(active, status, elapsedMs) : stage,
    ),
    startedAt: progress.startedAt,
    stageSince: null,
    failedAt: status === 'failed' ? active : null,
  };
}

/**
 * The event → row mapping. Returns the SAME reference for anything that does not move a
 * row, so a host can compare by identity and skip a render; `plan.progress` streams many
 * times a second and moves nothing.
 */
export function reduceRunProgress(progress: RunProgress, event: AiAgentEvent): RunProgress {
  const active = activeStageId(progress);
  switch (event.type) {
    case 'context.ready':
      return active === 'reading' ? advance(progress, event.at) : progress;
    case 'plan.validating':
      return active === 'writing' ? withDetail(progress, 'edit.checking') : progress;
    case 'plan.repairing':
      return active === 'writing' ? withDetail(progress, 'edit.repairing') : progress;
    case 'plan.proposed':
    case 'plan.applying':
      return active === 'writing' ? advance(progress, event.at) : progress;
    case 'run.completed':
      return settle(progress, event.at, 'done');
    case 'run.cancelled':
      return settle(progress, event.at, 'cancelled');
    case 'run.failed':
      // The failure itself belongs to the turn (and, classified, to ErrorRecord); the row
      // only remembers WHERE it broke, so no provider text is ever kept here.
      return settle(progress, event.at, 'failed');
    default:
      // run.started, skills.*, context.gathering, plan.proposing, plan.progress,
      // plan.salvaged.
      return progress;
  }
}

/**
 * The receipt for an ENDING: a stop, a failure, or a reload that killed the request.
 * `endedAt` is the caller's, so a revived run is measured to the last moment there is
 * evidence for rather than to now. Null when there is nothing honest to say.
 */
export function receiptOf(run: RunProgress, endedAt: number): RunReceipt | null {
  if (!Number.isFinite(run.startedAt) || !Number.isFinite(endedAt)) return null;
  const stage =
    run.failedAt ??
    run.stages.find((candidate) => candidate.status === 'cancelled')?.id ??
    activeStageId(run);
  return { elapsedMs: Math.max(0, endedAt - run.startedAt), stage };
}

/** How long the ACTIVE row has been running, or null once nothing runs. */
export function liveStageElapsed(run: RunProgress, now: number): number | null {
  if (run.stageSince === null || activeStageId(run) === null) return null;
  return Math.max(0, now - run.stageSince);
}

/* ── Technical details only (SPEC §7.4, §4.15): never on the record itself ────── */

/** Keep the provider's narration bounded; the controller holds it in memory only. */
export const MAX_LIVE_PROGRESS_LINES = 32;
const MAX_LIVE_PROGRESS_LINE_LENGTH = 1_000;

/** Append one provider line, preserving order and dropping immediate duplicates. */
export function appendLiveProgress(
  previous: readonly string[] | undefined,
  text: string,
): readonly string[] {
  const trimmed = text.trim();
  const line =
    trimmed.length > MAX_LIVE_PROGRESS_LINE_LENGTH
      ? `${trimmed.slice(0, MAX_LIVE_PROGRESS_LINE_LENGTH - 1)}…`
      : trimmed;
  const current = previous ?? [];
  if (line === '' || current.at(-1) === line) return current;
  return [...current, line].slice(-MAX_LIVE_PROGRESS_LINES);
}

/** `mm:ss.SSS`: a stage timing, always padded, never negative. */
export function formatElapsed(ms: number): string {
  const whole = Math.max(0, Math.round(ms));
  const minutes = Math.floor(whole / MS_PER_MINUTE);
  const seconds = Math.floor((whole % MS_PER_MINUTE) / MS_PER_SECOND);
  const millis = whole % MS_PER_SECOND;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/**
 * The rows with the active one measured to `now` (the caller's ticker). Hands back the
 * same reference once nothing runs, so a settled run can never tick.
 */
export function stagesWithLiveClock(run: RunProgress, now: number): readonly RunStage[] {
  const elapsedMs = liveStageElapsed(run, now);
  if (elapsedMs === null) return run.stages;
  return run.stages.map((stage) => (stage.status === 'active' ? { ...stage, elapsedMs } : stage));
}
