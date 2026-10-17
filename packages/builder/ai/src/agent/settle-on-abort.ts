/** Preserve an explicit abort reason and the platform's default AbortError. */
function abortReason(signal: AbortSignal): unknown {
  return signal.reason === undefined
    ? new DOMException('The operation was aborted.', 'AbortError')
    : signal.reason;
}

/**
 * Bound a provider call even when it violates its cancellation contract. The
 * provider still receives the signal; its late answer or failure is consumed
 * without changing the settled result.
 */
export function settleOnAbort<T>(
  signal: AbortSignal,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- AbortSignal reasons may be any value and must retain their identity.
  if (signal.aborted) return Promise.reject(abortReason(signal));
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      outcome();
    };
    const onAbort = (): void => {
      finish(() => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Preserve the caller's cancellation reason, including non-Error values.
        reject(abortReason(signal));
      });
    };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    const fail = (cause: unknown): void => {
      if (signal.aborted) onAbort();
      else {
        finish(() => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- A settlement boundary forwards the provider's original rejection.
          reject(cause);
        });
      }
    };
    try {
      void Promise.resolve(work(signal)).then((value) => {
        if (signal.aborted) onAbort();
        else {
          finish(() => {
            resolve(value);
          });
        }
      }, fail);
    } catch (cause) {
      fail(cause);
    }
  });
}
