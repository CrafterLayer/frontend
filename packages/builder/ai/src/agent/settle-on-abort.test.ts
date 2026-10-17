import { describe, expect, it, vi } from 'vitest';

import { settleOnAbort } from './settle-on-abort';

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (cause: unknown) => void = () => undefined;
  const promise = new Promise<T>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
}

describe('settleOnAbort', () => {
  it('refuses pre-aborted work without invoking it', async () => {
    const controller = new AbortController();
    controller.abort();
    const work = vi.fn(() => Promise.resolve('unused'));

    await expect(settleOnAbort(controller.signal, work)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(work).not.toHaveBeenCalled();
  });

  it.each([new Error('Stopped by the caller'), 'caller reason', null])(
    'preserves an explicit pre-abort reason: %s',
    async (reason) => {
      const controller = new AbortController();
      controller.abort(reason);
      await expect(settleOnAbort(controller.signal, () => Promise.resolve('unused'))).rejects.toBe(
        reason,
      );
    },
  );

  it('passes the same cancellation signal and releases its listener on fulfillment', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const work = vi.fn((signal: AbortSignal) => {
      expect(signal).toBe(controller.signal);
      return Promise.resolve('ready');
    });

    await expect(settleOnAbort(controller.signal, work)).resolves.toBe('ready');
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    controller.abort();
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('preserves provider rejection and releases its listener', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const cause = new Error('Provider failed');

    await expect(settleOnAbort(controller.signal, () => Promise.reject(cause))).rejects.toBe(cause);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('preserves a synchronous failure and releases its listener', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const cause = new Error('Provider could not start');

    await expect(
      settleOnAbort(controller.signal, () => {
        throw cause;
      }),
    ).rejects.toBe(cause);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('settles a provider that never answers when cancellation fires', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const pending = settleOnAbort(controller.signal, () => new Promise<string>(() => undefined));
    const reason = new Error('Deadline exceeded');
    reason.name = 'AbortError';

    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('consumes late fulfillment without changing its aborted result', async () => {
    const controller = new AbortController();
    const late = deferred<string>();
    const pending = settleOnAbort(controller.signal, () => late.promise);
    controller.abort();
    await expect(pending).rejects.toBe(controller.signal.reason);

    late.resolve('late answer');
    await Promise.resolve();

    await expect(pending).rejects.toBe(controller.signal.reason);
  });

  it('consumes a late rejection without an unhandled provider error', async () => {
    const controller = new AbortController();
    const late = deferred<string>();
    const pending = settleOnAbort(controller.signal, () => late.promise);
    controller.abort();
    await expect(pending).rejects.toBe(controller.signal.reason);

    late.reject(new Error('Provider failed after cancellation'));
    await Promise.resolve();
    await Promise.resolve();

    await expect(pending).rejects.toBe(controller.signal.reason);
  });

  it.each(['resolve', 'reject'] as const)(
    'gives cancellation precedence over an already queued provider %s',
    async (outcome) => {
      const controller = new AbortController();
      const late = deferred<string>();
      const pending = settleOnAbort(controller.signal, () => late.promise);
      if (outcome === 'resolve') late.resolve('queued answer');
      else late.reject(new Error('Queued provider failure'));
      controller.abort();

      await expect(pending).rejects.toBe(controller.signal.reason);
    },
  );

  it('keeps cancellation when the provider aborts and then throws synchronously', async () => {
    const controller = new AbortController();
    const pending = settleOnAbort(controller.signal, () => {
      controller.abort();
      throw new Error('Provider failed after stopping');
    });

    await expect(pending).rejects.toBe(controller.signal.reason);
  });
});
