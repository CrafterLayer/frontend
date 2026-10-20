import type { AiBuildSkipReasonCode, AiBuildTask, RunAiBuildOptions } from './types';
import { settleOnAbort } from './settle-on-abort';

/**
 * A section attempt that failed for a reason the build names itself, as data
 * (E5): a timeout, or a writer that wrote nothing inside its region.
 */
export class SectionAttemptError extends Error {
  override readonly name = 'SectionAttemptError';

  constructor(
    readonly code: AiBuildSkipReasonCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Run `work` under the section's own deadline, WITH the caller's signal
 * chained in.
 *
 * It used to be the deadline alone — "an outer abort ends the build after
 * this section" — and measured on 2026-09-28 that meant Stop did not stop:
 * all five sections in flight landed up to 1.7 s after it, their provider
 * requests ran (and cost) to the end, and a person's Stop took as long as
 * the slowest writer (up to 240 s, 480 s with a retry). Nothing is torn out
 * from under the kernel by aborting here: a fill only PROPOSES, and nothing
 * it proposed lands after a stop.
 *
 * A deadline that fired is re-thrown as a `timeout`, so the report can say
 * the section ran out of time rather than that something went wrong.
 */
export async function underDeadline<T>(
  options: RunAiBuildOptions,
  task: AiBuildTask,
  taskTimeoutMs: number,
  work: (signal: AbortSignal) => Promise<T>,
  /**
   * The section's own abort (the streamed build's): a speculative write whose
   * contract changed in the final plan is cancelled through it, and nothing
   * else is.
   */
  jobSignal?: AbortSignal,
): Promise<T> {
  const deadline = new AbortController();
  // A property, not a local: the flag is set in a timer the checker cannot see.
  const state = { timedOut: false };
  const timer = setTimeout(() => {
    state.timedOut = true;
    const timeout = new Error(
      `Section "${task.title}" exceeded its ${String(taskTimeoutMs)}ms budget.`,
    );
    timeout.name = 'AbortError';
    deadline.abort(timeout);
  }, taskTimeoutMs);
  const outer = options.signal;
  const forwardStop = (): void => {
    deadline.abort(outer?.reason);
  };
  if (outer?.aborted === true) forwardStop();
  else outer?.addEventListener('abort', forwardStop, { once: true });
  const forwardJob = (): void => {
    deadline.abort(jobSignal?.reason);
  };
  if (jobSignal?.aborted === true) forwardJob();
  else jobSignal?.addEventListener('abort', forwardJob, { once: true });
  try {
    return await settleOnAbort(deadline.signal, work);
  } catch (cause) {
    if (state.timedOut && outer?.aborted !== true) {
      throw new SectionAttemptError(
        'timeout',
        `Section "${task.title}" exceeded its ${String(taskTimeoutMs)}ms budget.`,
      );
    }
    throw cause;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', forwardStop);
    jobSignal?.removeEventListener('abort', forwardJob);
  }
}
