import {
  GENERATION_STAGE_LABELS,
  type AiAgentEvent,
  type GenerationStage,
  type GenerationStageId,
} from '@craftkit/builder';

/**
 * The run as rows.
 *
 * A plan run has three honest phases and no more: gathering (skills, context),
 * proposing (draft, check, repair) and — only when the run may apply —
 * applying. They map onto three ids of GenerationProgress's closed stage
 * vocabulary (`sitemap` "Plan", `structure` "Structure", `assembly` "Apply");
 * `content` and `design` are omitted because no such phases exist and a row
 * that never moves would be a lie.
 *
 * Pure: every function here is a function of its arguments. Time comes from
 * the events' own `at` stamps and from the caller, never from Date.now.
 */
export interface RunProgress {
  readonly stages: readonly GenerationStage[];
  /**
   * When the run began (the events' clock). Set once and never moved: rows
   * measure themselves from `stageSince`, but a receipt has to answer "how
   * long did that take?" about the WHOLE run, and no row remembers that.
   */
  readonly startedAt: number;
  /** When the active row became active (the events' clock), or null once settled. */
  readonly stageSince: number | null;
  /** The row that failed, so the refusal can say where it broke. */
  readonly failedAt: GenerationStageId | null;
}

/**
 * What an ENDING says: how long the run took, how far it got, and the
 * provider's own last words when it streamed any. Built at the moment the run
 * ends, kept on the turn, and durable — a stop is as much an outcome as a
 * plan, and a card that only says "Stopped." leaves a person guessing whether
 * it ran for a second or for six minutes.
 */
export interface RunReceipt {
  /** The whole run, first row to the ending, as `mm:ss.SSS`. */
  readonly elapsed: string;
  /** Where it ended: the failed row, the cancelled row, or the one still open. */
  readonly stage: GenerationStageId | null;
  /** That row in a person's words ("Structure"), or null when there is no row. */
  readonly stageLabel: string | null;
  /** The provider's last streamed line, when it streamed one. */
  readonly lastLine?: string;
}

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;

/** `mm:ss.SSS` — a receipt, always padded, never negative. */
export function formatElapsed(ms: number): string {
  const whole = Math.max(0, Math.round(ms));
  const minutes = Math.floor(whole / MS_PER_MINUTE);
  const seconds = Math.floor((whole % MS_PER_MINUTE) / MS_PER_SECOND);
  const millis = whole % MS_PER_SECOND;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function initialRunProgress(apply: 'never' | 'auto', now: number): RunProgress {
  const stages: GenerationStage[] = [
    { id: 'sitemap', status: 'active' },
    { id: 'structure', status: 'pending' },
  ];
  if (apply === 'auto') stages.push({ id: 'assembly', status: 'pending' });
  return { stages, startedAt: now, stageSince: now, failedAt: null };
}

/** `mm:ss` — the RUNNING clock, coarse on purpose: it only ticks once a second. */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function activeStageId(progress: RunProgress): GenerationStageId | null {
  return progress.stages.find((stage) => stage.status === 'active')?.id ?? null;
}

function stageOf(progress: RunProgress, id: GenerationStageId): GenerationStage | undefined {
  return progress.stages.find((stage) => stage.id === id);
}

function withStage(
  progress: RunProgress,
  id: GenerationStageId,
  next: GenerationStage,
): readonly GenerationStage[] {
  return progress.stages.map((stage) => (stage.id === id ? next : stage));
}

function elapsedSince(progress: RunProgress, at: number): string {
  return formatElapsed(at - (progress.stageSince ?? at));
}

/** Settle the active row as done and, when there is a next row, open it. */
function advance(progress: RunProgress, at: number): RunProgress {
  const active = activeStageId(progress);
  if (active === null) return progress;
  const detail = elapsedSince(progress, at);
  const index = progress.stages.findIndex((stage) => stage.id === active);
  const next = progress.stages[index + 1];
  const stages = progress.stages.map((stage, position) => {
    if (position === index) return { id: stage.id, status: 'done' as const, detail };
    if (next !== undefined && position === index + 1)
      return { id: stage.id, status: 'active' as const };
    return stage;
  });
  return {
    stages,
    startedAt: progress.startedAt,
    stageSince: next === undefined ? null : at,
    failedAt: null,
  };
}

function withDetail(progress: RunProgress, id: GenerationStageId, detail: string): RunProgress {
  const stage = stageOf(progress, id);
  if (stage?.status !== 'active' || stage.detail === detail) return progress;
  return { ...progress, stages: withStage(progress, id, { id, status: 'active', detail }) };
}

/**
 * The event → row mapping. Returns the SAME reference for anything that does
 * not move a row, so a host can compare by identity and skip a render.
 */
export function reduceRunProgress(progress: RunProgress, event: AiAgentEvent): RunProgress {
  const active = activeStageId(progress);
  switch (event.type) {
    case 'run.started':
      // Plan is active from the first instant; a second start is idempotent.
      return progress;
    case 'context.ready':
      return active === 'sitemap' ? advance(progress, event.at) : progress;
    case 'plan.validating':
      return active === 'structure'
        ? withDetail(progress, 'structure', event.attempt === 1 ? 'Checking' : 'Checking again')
        : progress;
    case 'plan.repairing':
      return active === 'structure'
        ? withDetail(progress, 'structure', `Repairing ${String(event.issues.length)}`)
        : progress;
    case 'plan.proposed':
      return active === 'structure' ? advance(progress, event.at) : progress;
    case 'plan.applying':
      // Apply became active the moment the proposal landed (auto runs only).
      return progress;
    case 'run.completed': {
      if (active === null) return progress;
      const detail = elapsedSince(progress, event.at);
      return {
        stages: withStage(progress, active, { id: active, status: 'done', detail }),
        startedAt: progress.startedAt,
        stageSince: null,
        failedAt: null,
      };
    }
    case 'run.cancelled':
      return active === null
        ? progress
        : {
            stages: withStage(progress, active, { id: active, status: 'cancelled' }),
            startedAt: progress.startedAt,
            stageSince: null,
            failedAt: null,
          };
    case 'run.failed':
      return active === null
        ? progress
        : {
            stages: withStage(progress, active, {
              id: active,
              status: 'failed',
              detail: event.error.message,
            }),
            startedAt: progress.startedAt,
            stageSince: null,
            failedAt: active,
          };
    default:
      // skills.*, context.gathering, plan.proposing, plan.progress and any
      // event this file does not know: the voice and the thinking line narrate
      // those; the rows do not move.
      return progress;
  }
}

/**
 * The receipt for an ENDING — a stop, a failure, or a reload that killed the
 * request. `endedAt` is the caller's: this module never reads a clock, so a
 * revived run can be measured to the last moment there is evidence for rather
 * than to now (the wall clock kept running while the tab was closed; the run
 * did not).
 *
 * Null when there is nothing honest to say — revived data from before runs
 * carried an origin, or an unusable stamp. A blank last line is not a line.
 */
export function receiptOf(run: RunProgress, endedAt: number, lastLine?: string): RunReceipt | null {
  if (!Number.isFinite(run.startedAt) || !Number.isFinite(endedAt)) return null;
  const stage =
    run.failedAt ??
    run.stages.find((candidate) => candidate.status === 'cancelled')?.id ??
    activeStageId(run);
  return {
    elapsed: formatElapsed(endedAt - run.startedAt),
    stage,
    stageLabel: stage === null ? null : GENERATION_STAGE_LABELS[stage],
    ...(lastLine === undefined || lastLine.trim() === '' ? {} : { lastLine }),
  };
}

/** How long the ACTIVE row has been running, or null once nothing runs. */
export function liveStageElapsed(run: RunProgress, now: number): number | null {
  if (run.stageSince === null || activeStageId(run) === null) return null;
  return Math.max(0, now - run.stageSince);
}

/**
 * The rows a LIVE card renders: the active one carries the running clock
 * beside whatever the reducer wrote there ("Checking · 00:12"), every settled
 * row keeps its final detail. Pure — `now` comes from the caller's ticker — and
 * it hands back the same reference once nothing runs, so a settled card can
 * never tick.
 */
export function stagesWithLiveClock(run: RunProgress, now: number): readonly GenerationStage[] {
  const active = activeStageId(run);
  const elapsed = liveStageElapsed(run, now);
  if (active === null || elapsed === null) return run.stages;
  const clock = formatClock(elapsed);
  return run.stages.map((stage) =>
    stage.id === active
      ? {
          ...stage,
          detail: stage.detail === undefined ? clock : `${stage.detail} · ${clock}`,
        }
      : stage,
  );
}
