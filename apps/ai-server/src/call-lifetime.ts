/** One complete generation call, including cache waiting, streaming and backend fallback. */
export const DEFAULT_CALL_TIMEOUT_MS = 240_000;
const MAX_TIMER_MS = 2_147_483_647;

export class PlanCallTimeoutError extends Error {
  override readonly name = 'PlanCallTimeoutError';
  readonly httpStatus = 504;

  constructor(timeoutMs: number) {
    super(
      `The assistant generation exceeded its ${String(timeoutMs / 1_000)}s server budget and was stopped. ` +
        'Try a smaller change or increase CRAFTKIT_AI_CALL_TIMEOUT_MS for this deployment.',
    );
  }
}

export function callTimeoutMs(value: number | undefined): number {
  const timeoutMs = value ?? DEFAULT_CALL_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMER_MS) {
    throw new RangeError('The generation call timeout must be an integer from 1 to 2147483647ms.');
  }
  return timeoutMs;
}

/** A blank optional environment setting retains the default; malformed values fail startup. */
export function configuredCallTimeoutMs(value: string | undefined): number {
  return callTimeoutMs(value === undefined || value.trim() === '' ? undefined : Number(value));
}

/** Settle even a provider that ignores abort; observe and discard its late result or rejection. */
export function withCallLifetime<T>(
  caller: AbortSignal,
  timeoutMs: number | undefined,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const cap = callTimeoutMs(timeoutMs);
  const stopped = (): DOMException =>
    new DOMException('The generation request was cancelled.', 'AbortError');
  if (caller.aborted) return Promise.reject(stopped());
  const lifetime = new AbortController();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      caller.removeEventListener('abort', onCallerAbort);
      lifetime.signal.removeEventListener('abort', onAbort);
      outcome();
    };
    const onAbort = (): void => {
      finish(() => {
        reject(lifetime.signal.reason as Error);
      });
    };
    const onCallerAbort = (): void => {
      lifetime.abort(stopped());
    };
    const timer = setTimeout(() => {
      lifetime.abort(new PlanCallTimeoutError(cap));
    }, cap);
    lifetime.signal.addEventListener('abort', onAbort, { once: true });
    caller.addEventListener('abort', onCallerAbort, { once: true });
    if (caller.aborted) {
      onCallerAbort();
      return;
    }
    const fail = (cause: unknown): void => {
      if (lifetime.signal.aborted) onAbort();
      else
        finish(() => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Forward the provider's original failure without changing its classification.
          reject(cause);
        });
    };
    try {
      void Promise.resolve(work(lifetime.signal)).then((value) => {
        if (lifetime.signal.aborted) onAbort();
        else
          finish(() => {
            resolve(value);
          });
      }, fail);
    } catch (cause) {
      fail(cause);
    }
  });
}
