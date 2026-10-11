import type { AiAgentEvent, AiBuildEvent, AiPagePlanEvent } from '@craftkit/builder';

type MeasuredUsage = Extract<AiAgentEvent, { type: 'provider.usage' }>['usage'];
export type OperationalStage =
  'reading' | 'planning' | 'writing' | 'checking' | 'repairing' | 'applying';
export interface RunTelemetryState {
  readonly activity: readonly { readonly stage: OperationalStage; readonly scope?: string }[];
  readonly attempts: Readonly<Record<string, MeasuredUsage | null>>;
  readonly startedEvents?: readonly string[];
  /** The bounded ledger omitted additional physical attempts; no complete totals exist. */
  readonly overflowed?: true;
}
export const EMPTY_RUN_TELEMETRY: RunTelemetryState = { activity: [], attempts: {} };
const MAX_ACTIVITY = 16;
const MAX_ATTEMPTS = 64;
const STAGES = new Set<OperationalStage>([
  'reading',
  'planning',
  'writing',
  'checking',
  'repairing',
  'applying',
]);
const plainRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const countOf = (value: unknown): number | null =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 1_000_000_000_000
    ? value
    : null;
const costOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Optional persisted telemetry is advisory. Invalid receipts cannot crash a valid turn
 * or turn unknown charges into zero; oversize attempt ledgers are discarded as a whole. */
export function readRunTelemetry(value: unknown): RunTelemetryState | undefined {
  if (!plainRecord(value) || !Array.isArray(value['activity']) || !plainRecord(value['attempts']))
    return undefined;
  if (value['overflowed'] !== undefined && typeof value['overflowed'] !== 'boolean')
    return undefined;
  const entries = Object.entries(value['attempts']);
  if (
    entries.length > MAX_ATTEMPTS ||
    entries.some(
      ([id]) => id.length > 200 || !/^[^\u0000-\u001f]+\/attempt-[1-9]\d{0,2}$/u.test(id),
    )
  )
    return undefined;
  const attempts = Object.fromEntries(
    entries.map(([id, raw]): [string, MeasuredUsage | null] => {
      if (!plainRecord(raw)) return [id, null];
      const usage: MeasuredUsage = {
        inputTokens: countOf(raw['inputTokens']),
        outputTokens: countOf(raw['outputTokens']),
        cacheReadTokens: countOf(raw['cacheReadTokens']),
        cacheWriteTokens: countOf(raw['cacheWriteTokens']),
        costUsd: costOf(raw['costUsd']),
      };
      const cached =
        raw['cached'] === true &&
        usage.inputTokens === 0 &&
        usage.outputTokens === 0 &&
        usage.cacheReadTokens === 0 &&
        usage.cacheWriteTokens === 0 &&
        usage.costUsd === 0;
      return [id, cached ? { ...usage, cached: true } : usage];
    }),
  );
  const activity = (value['activity'] as readonly unknown[])
    .slice(-MAX_ACTIVITY)
    .flatMap((item) => {
      if (
        !plainRecord(item) ||
        typeof item['stage'] !== 'string' ||
        !STAGES.has(item['stage'] as OperationalStage)
      )
        return [];
      return [
        {
          stage: item['stage'] as OperationalStage,
          ...(typeof item['scope'] === 'string' ? { scope: item['scope'].slice(0, 120) } : {}),
        },
      ];
    });
  const startedEvents = Array.isArray(value['startedEvents'])
    ? (value['startedEvents'] as readonly unknown[])
        .filter((id): id is string => typeof id === 'string' && id.length <= 200)
        .slice(-MAX_ATTEMPTS)
    : undefined;
  return {
    activity,
    attempts,
    ...(startedEvents === undefined ? {} : { startedEvents }),
    ...(value['overflowed'] === true ? { overflowed: true } : {}),
  };
}
const PUBLIC_PHASES: Readonly<Record<string, OperationalStage>> = {
  'Understanding the request…': 'reading',
  'Planning the layout…': 'planning',
  'Writing the design…': 'writing',
  'Checking the generated result…': 'checking',
};

/** Only allowlisted lifecycle phases are visible. Old peers' private narration is ignored. */
export function reduceRunTelemetry(
  current: RunTelemetryState | undefined,
  event: AiBuildEvent | AiPagePlanEvent,
  scope?: string,
): RunTelemetryState {
  const previous = current ?? EMPTY_RUN_TELEMETRY;
  let stage: OperationalStage | undefined;
  let attempts = previous.attempts;
  let startedEvents = previous.startedEvents;
  let overflowed = previous.overflowed;
  switch (event.type) {
    case 'context.gathering':
      stage = 'reading';
      break;
    case 'page-plan.started':
      stage = 'reading';
      break;
    case 'plan.proposing':
      stage = 'writing';
      break;
    case 'page-plan.proposing':
      stage = 'writing';
      break;
    case 'plan.progress':
      stage = PUBLIC_PHASES[event.text];
      break;
    case 'page-plan.progress':
      stage = PUBLIC_PHASES[event.text];
      break;
    case 'plan.validating':
      stage = 'checking';
      break;
    case 'plan.repairing':
      stage = 'repairing';
      break;
    case 'page-plan.repairing':
      stage = 'repairing';
      break;
    case 'plan.applying':
      stage = 'applying';
      break;
    case 'task.completed':
      stage = 'applying';
      break;
    case 'provider.usage': {
      // Duplicate delivery cannot double charge a run. No arbitrary keys from model text.
      if (Object.hasOwn(attempts, event.attemptId) && attempts[event.attemptId] !== null) break;
      if (!event.attemptId.startsWith(`${event.runId}/attempt-`) || event.attemptId.length > 200)
        break;
      if (
        Object.keys(attempts).length >= MAX_ATTEMPTS &&
        !Object.hasOwn(attempts, event.attemptId)
      ) {
        overflowed = true;
        break;
      }
      attempts = { ...attempts, [event.attemptId]: event.usage };
      break;
    }
    default:
      break;
  }
  const startKey = `${event.runId}/${String(event.seq)}`;
  if (
    (event.type === 'plan.proposing' ||
      event.type === 'plan.repairing' ||
      event.type === 'page-plan.proposing') &&
    !startedEvents?.includes(startKey)
  ) {
    const position =
      Object.keys(attempts).filter((id) => id.startsWith(`${event.runId}/attempt-`)).length + 1;
    const attemptId = `${event.runId}/attempt-${String(position)}`;
    if (Object.keys(attempts).length < MAX_ATTEMPTS) attempts = { ...attempts, [attemptId]: null };
    else overflowed = true;
    startedEvents = [...(startedEvents ?? []), startKey].slice(-MAX_ATTEMPTS);
  }
  const latest = previous.activity.at(-1);
  const activity =
    stage === undefined || (latest?.stage === stage && latest.scope === scope)
      ? previous.activity
      : [
          ...previous.activity,
          { stage, ...(scope === undefined ? {} : { scope: scope.slice(0, 120) }) },
        ].slice(-MAX_ACTIVITY);
  return activity === previous.activity &&
    attempts === previous.attempts &&
    overflowed === previous.overflowed
    ? previous
    : {
        activity,
        attempts,
        ...(startedEvents === undefined ? {} : { startedEvents }),
        ...(overflowed === true ? { overflowed: true } : {}),
      };
}

export function telemetryTotals(
  state: RunTelemetryState,
): MeasuredUsage & { readonly cachedReplies: number; readonly requests: number } {
  const attempts = Object.values(state.attempts);
  const sum = (
    key: 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens' | 'costUsd',
  ): number | null => {
    if (
      state.overflowed === true ||
      attempts.length === 0 ||
      attempts.some((usage) => usage?.[key] == null)
    )
      return null;
    const total = attempts.reduce((value, usage) => value + (usage?.[key] ?? 0), 0);
    return Number.isFinite(total) && (Number.isSafeInteger(total) || key === 'costUsd')
      ? total
      : null;
  };
  return {
    inputTokens: sum('inputTokens'),
    outputTokens: sum('outputTokens'),
    cacheReadTokens: sum('cacheReadTokens'),
    cacheWriteTokens: sum('cacheWriteTokens'),
    costUsd: sum('costUsd'),
    cachedReplies: attempts.filter((usage) => usage?.cached === true).length,
    requests: attempts.length,
  };
}
