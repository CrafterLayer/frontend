import { creativeCreationRequest } from '../intent/route-intent';

import { settleOnAbort } from './settle-on-abort';
import type { RunAiAgentOptions } from './types';

export interface AiRunDeadlineOptions {
  signal?: AbortSignal;
  /** Total edit or page-planning budget, including proposal, repair and retries: 120 s normally,
   * 180 s for creative creation. Positive caller overrides win; Stop settles promptly.
   * Build section writers inherit their outer budget unless this override is given. */
  timeoutMs?: number;
}

interface DeadlineRequest extends AiRunDeadlineOptions {
  runId: string;
  request: string;
  isCurrentRun?: (runId: string) => boolean;
}

const INHERITED = new WeakSet<object>();
const SCAFFOLDS = new WeakSet<object>();

/** Only the build coordinator marks a writer whose outer section owns its deadline. */
export function withInheritedRunDeadline<T extends RunAiAgentOptions & { signal: AbortSignal }>(
  options: T,
): T {
  INHERITED.add(options);
  return options;
}

export function isInheritedRunDeadline(options: RunAiAgentOptions): boolean {
  return INHERITED.has(options);
}

/** A coordinator-owned scaffold creates a shell; its subsequent fills create the scenes. */
export function withScaffoldRun<T extends RunAiAgentOptions>(options: T): T {
  SCAFFOLDS.add(options);
  return options;
}

export function isScaffoldRun(options: RunAiAgentOptions): boolean {
  return SCAFFOLDS.has(options);
}

export class AiRunTimeoutError extends Error {
  override readonly name = 'AiRunTimeoutError';
  constructor(timeoutMs: number) {
    super(
      `The assistant did not finish this request within ${String(Math.ceil(timeoutMs / 1_000))} seconds. Try a smaller change or allow more time for this request.`,
    );
  }
}

/** One signal and one budget for the entire request, including non-cooperative work. */
export async function withinRunDeadline<TOptions extends DeadlineRequest, T>(
  options: TOptions,
  work: (live: TOptions) => Promise<T>,
): Promise<T> {
  const timeoutMs =
    options.timeoutMs ??
    (INHERITED.has(options)
      ? undefined
      : creativeCreationRequest(options.request)
        ? 180_000
        : 120_000);
  if (
    timeoutMs !== undefined &&
    (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)
  ) {
    throw new RangeError('timeoutMs must be a positive safe integer no greater than 2147483647.');
  }
  if (timeoutMs === undefined && options.signal === undefined) return work(options);
  const controller = new AbortController();
  const started = performance.now();
  const cancel = (): void => {
    controller.abort(options.signal?.reason);
  };
  if (options.signal?.aborted === true) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  const expire = (): void => {
    if (options.signal?.aborted === true) cancel();
    else controller.abort(new AiRunTimeoutError(timeoutMs ?? 0));
  };
  const timer = timeoutMs === undefined ? undefined : setTimeout(expire, timeoutMs);
  const live: TOptions = {
    ...options,
    signal: controller.signal,
    isCurrentRun: () => {
      // Synchronous validation cannot yield to a timer; check again before applying.
      if (timeoutMs !== undefined && performance.now() - started >= timeoutMs) expire();
      controller.signal.throwIfAborted();
      return options.isCurrentRun === undefined ? true : options.isCurrentRun(options.runId);
    },
  };
  if (INHERITED.has(options)) INHERITED.add(live);
  if (SCAFFOLDS.has(options)) SCAFFOLDS.add(live);
  try {
    return await settleOnAbort(controller.signal, () => work(live));
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
