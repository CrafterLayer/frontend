import type { AiAgentEvent, GenerationStage, GenerationStageId } from '@craftkit/builder';

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
  /** When the active row became active (the events' clock), or null once settled. */
  readonly stageSince: number | null;
  /** The row that failed, so the refusal can say where it broke. */
  readonly failedAt: GenerationStageId | null;
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
  return { stages, stageSince: now, failedAt: null };
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
  return { stages, stageSince: next === undefined ? null : at, failedAt: null };
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
        stageSince: null,
        failedAt: null,
      };
    }
    case 'run.cancelled':
      return active === null
        ? progress
        : {
            stages: withStage(progress, active, { id: active, status: 'cancelled' }),
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
