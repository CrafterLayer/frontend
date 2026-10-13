import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CALL_TIMEOUT_MS,
  PlanCallTimeoutError,
  callTimeoutMs,
  configuredCallTimeoutMs,
  withCallLifetime,
} from './call-lifetime';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('complete generation-call lifetime', () => {
  it('uses the four-minute default and accepts explicit longer creative budgets', () => {
    expect(DEFAULT_CALL_TIMEOUT_MS).toBe(240_000);
    expect(callTimeoutMs(undefined)).toBe(240_000);
    expect(configuredCallTimeoutMs(undefined)).toBe(240_000);
    expect(configuredCallTimeoutMs('')).toBe(240_000);
    expect(configuredCallTimeoutMs('600000')).toBe(600_000);
  });

  it.each([0, -1, 1.5, NaN, Infinity, 2_147_483_648])('refuses an invalid timeout: %s', (value) => {
    expect(() => callTimeoutMs(value)).toThrow(RangeError);
  });

  it('refuses a malformed environment override', () => {
    expect(() => configuredCallTimeoutMs('not-a-duration')).toThrow(RangeError);
  });

  it('does not invoke work after a caller cancellation, even with a non-Error reason', async () => {
    const caller = new AbortController();
    caller.abort('user stop');
    const work = vi.fn(() => Promise.resolve('unused'));
    await expect(withCallLifetime(caller.signal, 100, work)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(work).not.toHaveBeenCalled();
  });

  it('bounds non-cooperative work and aborts it at exactly the configured deadline', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    let signal: AbortSignal | undefined;
    const pending = withCallLifetime(caller.signal, 100, (live) => {
      signal = live;
      return new Promise<string>(() => undefined);
    });
    const failure = expect(pending).rejects.toBeInstanceOf(PlanCallTimeoutError);
    await vi.advanceTimersByTimeAsync(99);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await failure;
    expect(signal?.aborted).toBe(true);
    expect(caller.signal.aborted).toBe(false);
    await expect(pending).rejects.toMatchObject({ httpStatus: 504 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps user Stop separate from timeout and releases its timer/listener', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const remove = vi.spyOn(caller.signal, 'removeEventListener');
    const pending = withCallLifetime(
      caller.signal,
      100,
      () => new Promise<string>(() => undefined),
    );
    caller.abort(new Error('user stop'));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['resolve', 'reject'] as const)(
    'consumes a late provider %s after expiration',
    async (outcome) => {
      vi.useFakeTimers();
      let resolve: (value: string) => void = () => undefined;
      let reject: (cause: Error) => void = () => undefined;
      const work = new Promise<string>((accept, refuse) => {
        resolve = accept;
        reject = refuse;
      });
      const pending = withCallLifetime(new AbortController().signal, 10, () => work);
      const failure = expect(pending).rejects.toBeInstanceOf(PlanCallTimeoutError);
      await vi.advanceTimersByTimeAsync(10);
      await failure;
      if (outcome === 'resolve') resolve('late output');
      else reject(new Error('late failure'));
      await vi.advanceTimersByTimeAsync(0);
      await expect(pending).rejects.toBeInstanceOf(PlanCallTimeoutError);
    },
  );

  it('keeps cancellation ahead of a queued provider answer', async () => {
    const caller = new AbortController();
    const pending = withCallLifetime(caller.signal, 100, () => Promise.resolve('queued'));
    caller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('preserves a synchronous provider failure and releases its timer', async () => {
    vi.useFakeTimers();
    const cause = new Error('cannot start');
    const pending = withCallLifetime(new AbortController().signal, 100, () => {
      throw cause;
    });
    await expect(pending).rejects.toBe(cause);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up a successful call without aborting the caller', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    await expect(
      withCallLifetime(caller.signal, 100, () => Promise.resolve('ready')),
    ).resolves.toBe('ready');
    expect(vi.getTimerCount()).toBe(0);
    expect(caller.signal.aborted).toBe(false);
  });
});
