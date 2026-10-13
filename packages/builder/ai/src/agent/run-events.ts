import type { AiAgentEvent, RunAiAgentOptions } from './types';

type EventPayload<T = AiAgentEvent> = T extends AiAgentEvent
  ? Omit<T, 'runId' | 'seq' | 'at'>
  : never;

export type Emit = (payload: EventPayload) => AiAgentEvent | undefined;

const TERMINAL_EVENTS: ReadonlySet<AiAgentEvent['type']> = new Set([
  'run.completed',
  'run.cancelled',
  'run.failed',
]);

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function normalizeCancellation(cause: unknown): Error {
  if (cause instanceof Error && cause.name === 'AbortError') return cause;
  const error = new Error(errorMessage(cause));
  error.name = 'AbortError';
  return error;
}

function supersededRunError(runId: string): Error {
  const error = new Error(`AI run "${runId}" was superseded by a newer run.`);
  error.name = 'AbortError';
  return error;
}

export function assertRunActive(
  options: Pick<RunAiAgentOptions, 'isCurrentRun' | 'runId' | 'signal'>,
): void {
  if (options.signal?.aborted === true) options.signal.throwIfAborted();
  if (options.isCurrentRun !== undefined) {
    const current: unknown = options.isCurrentRun(options.runId);
    if (current !== true) throw supersededRunError(options.runId);
  }
}

export function mayEmitLiveProgress(
  options: Pick<RunAiAgentOptions, 'isCurrentRun' | 'runId' | 'signal'>,
): boolean {
  if (options.signal?.aborted === true) return false;
  try {
    if (options.isCurrentRun === undefined) return true;
    const current: unknown = options.isCurrentRun(options.runId);
    return current === true;
  } catch {
    // A broken lease port is surfaced at the next guarded run boundary. It
    // must never let late provider narration escape in the meantime.
    return false;
  }
}

export function normalizeApplyMode(value: unknown): 'never' | 'auto' {
  if (value === undefined || value === 'never') return 'never';
  if (value === 'auto') return 'auto';
  throw new RangeError('apply must be either "never" or "auto".');
}

export function isCancellation(cause: unknown, signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true || (cause instanceof Error && cause.name === 'AbortError');
}

/**
 * Every event is stamped once from the run's clock — one `clock.now()` per
 * event, as before — and an event that says where its plan came from
 * (`source`) also carries `elapsedMs` since `run.started`, measured between
 * those same stamps, so timing a run never adds a clock read.
 */
export function createEventEmitter(options: RunAiAgentOptions): Emit {
  let seq = 0;
  let terminal = false;
  let startedAt: number | undefined;
  return (payload) => {
    if (terminal) return undefined;
    const at = options.clock.now();
    startedAt ??= at;
    const event = Object.freeze({
      ...payload,
      ...(payload.source === undefined ? {} : { elapsedMs: Math.max(0, at - startedAt) }),
      runId: options.runId,
      seq,
      at,
    }) as AiAgentEvent;
    seq += 1;
    if (TERMINAL_EVENTS.has(event.type)) terminal = true;
    try {
      options.onEvent?.(event);
    } catch {
      // Observers are telemetry consumers; they cannot acquire run authority.
    }
    return event;
  };
}
