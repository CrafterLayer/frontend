import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiPlan, AiProposeOptions } from '../types';
import { runAiAgent } from './run-agent';
import {
  incidentOptions,
  INVALID,
  METADATA,
  MURAL_REQUEST,
  SCENE,
} from './run-agent.incident-fixtures';
import type { AiAgentEvent } from './types';
import { withInheritedRunDeadline } from './run-deadline';

function deferred() {
  let resolve!: (plan: AiPlan) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<AiPlan>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runAiAgent cumulative lifetime', () => {
  it.each(['proposal', 'repair'] as const)(
    'settles Stop during a hanging %s and ignores late results',
    async (phase) => {
      const pending = deferred();
      const controller = new AbortController();
      const events: AiAgentEvent[] = [];
      let live: AiProposeOptions | undefined;
      let proposals = 0;
      let repairs = 0;
      const options = incidentOptions({
        signal: controller.signal,
        timeoutMs: 1_000,
        onEvent: (event) => events.push(event),
        provider: {
          propose: (_request, _context, input) => {
            proposals += 1;
            live = input;
            return phase === 'proposal' ? pending.promise : Promise.resolve(INVALID);
          },
          repair: (_request, _context, _plan, _issues, input) => {
            repairs += 1;
            live = input;
            return pending.promise;
          },
        },
      });
      const result = runAiAgent(options).catch((cause: unknown) => cause);
      await vi.advanceTimersByTimeAsync(0);
      controller.abort(new DOMException('Stopped', 'AbortError'));
      await vi.advanceTimersByTimeAsync(0);
      expect(await result).toMatchObject({ name: 'AbortError' });
      expect(live?.signal?.aborted).toBe(true);
      expect([proposals, repairs]).toEqual(phase === 'proposal' ? [1, 0] : [1, 1]);
      expect(events.at(-1)?.type).toBe('run.cancelled');
      expect(vi.getTimerCount()).toBe(0);
      const count = events.length;
      live?.onProgress?.('Late story');
      live?.onUsage?.({
        inputTokens: 4,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      pending.resolve(METADATA);
      await vi.advanceTimersByTimeAsync(0);
      expect(events).toHaveLength(count);
      expect(options.kernel.transactions()).toHaveLength(0);
    },
  );

  it('expires a hanging proposal with a timeout failure and consumes its late rejection', async () => {
    const pending = deferred();
    const events: AiAgentEvent[] = [];
    const options = incidentOptions({
      timeoutMs: 60,
      provider: { propose: () => pending.promise },
      onEvent: (event) => events.push(event),
    });
    const result = runAiAgent(options).catch((cause: unknown) => cause);
    await vi.advanceTimersByTimeAsync(60);
    expect(await result).toMatchObject({ name: 'AiRunTimeoutError' });
    expect(events.at(-1)).toMatchObject({
      type: 'run.failed',
      error: { source: 'run', code: 'timeout', retryable: false },
    });
    pending.reject(new Error('Late transport error'));
    await vi.advanceTimersByTimeAsync(0);
    expect(options.kernel.transactions()).toHaveLength(0);
    expect(events.filter(({ type }) => type === 'run.failed')).toHaveLength(1);
  });

  it('gives repair only the time remaining after the proposal', async () => {
    const pending = deferred();
    let repairs = 0;
    let signal: AbortSignal | undefined;
    const options = incidentOptions({
      timeoutMs: 60,
      provider: {
        propose: () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(INVALID);
            }, 40);
          }),
        repair: (_request, _context, _plan, _issues, live) => {
          repairs += 1;
          signal = live?.signal;
          return pending.promise;
        },
      },
    });
    const result = runAiAgent(options).catch((cause: unknown) => cause);
    await vi.advanceTimersByTimeAsync(59);
    expect(repairs).toBe(1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ name: 'AiRunTimeoutError' });
    expect(signal?.aborted).toBe(true);
    pending.resolve(METADATA);
    await vi.advanceTimersByTimeAsync(0);
    expect(options.kernel.transactions()).toHaveLength(0);
  });

  it.each([
    [undefined, 120_000],
    [MURAL_REQUEST, 180_000],
  ] as const)('uses the default total budget for %s', async (request, budget) => {
    const pending = deferred();
    let signal: AbortSignal | undefined;
    const options = incidentOptions({
      ...(request === undefined ? {} : { request }),
      provider: {
        propose: (_request, _context, live) => {
          signal = live?.signal;
          return pending.promise;
        },
      },
    });
    const result = runAiAgent(options).catch((cause: unknown) => cause);
    await vi.advanceTimersByTimeAsync(budget - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ name: 'AiRunTimeoutError' });
    pending.resolve(METADATA);
    await vi.advanceTimersByTimeAsync(0);
  });

  it('gives caller Stop precedence when deadline and Stop arrive before settlement', async () => {
    const pending = deferred();
    const controller = new AbortController();
    const events: AiAgentEvent[] = [];
    const options = incidentOptions({
      signal: controller.signal,
      timeoutMs: 60,
      provider: { propose: () => pending.promise },
      onEvent: (event) => events.push(event),
    });
    const result = runAiAgent(options).catch((cause: unknown) => cause);
    vi.advanceTimersByTime(60);
    controller.abort(new Error('The user stopped this edit'));
    expect(await result).toMatchObject({
      name: 'AbortError',
      message: 'The user stopped this edit',
    });
    expect(events.at(-1)?.type).toBe('run.cancelled');
    pending.resolve(METADATA);
    await vi.advanceTimersByTimeAsync(0);
    expect(options.kernel.transactions()).toHaveLength(0);
  });

  it('preserves an explicit larger creative budget', async () => {
    const pending = deferred();
    const options = incidentOptions({
      request: MURAL_REQUEST,
      timeoutMs: 240_000,
      provider: { propose: () => pending.promise },
    });
    const result = runAiAgent(options);
    await vi.advanceTimersByTimeAsync(180_001);
    pending.resolve(SCENE);
    expect((await result).status).toBe('applied');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves a build child to its outer budget when no override is given', async () => {
    const pending = deferred();
    const options = withInheritedRunDeadline({
      ...incidentOptions({
        runId: 'build/fill',
        request: MURAL_REQUEST,
        provider: { propose: () => pending.promise },
      }),
      signal: new AbortController().signal,
    });
    const result = runAiAgent(options);
    await vi.advanceTimersByTimeAsync(180_001);
    pending.resolve(SCENE);
    expect((await result).status).toBe('applied');
  });

  it('bounds a standalone edit even when its public run id contains slashes', async () => {
    const pending = deferred();
    const options = incidentOptions({
      runId: 'user/session/edit',
      provider: { propose: () => pending.promise },
    });
    const result = runAiAgent(options).catch((cause: unknown) => cause);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await result).toMatchObject({ name: 'AiRunTimeoutError' });
    pending.resolve(METADATA);
    await vi.advanceTimersByTimeAsync(0);
    expect(options.kernel.transactions()).toHaveLength(0);
  });

  it('skips the provider for a pre-aborted run', async () => {
    const controller = new AbortController();
    controller.abort();
    const propose = vi.fn(() => Promise.resolve(METADATA));
    await expect(
      runAiAgent(incidentOptions({ signal: controller.signal, provider: { propose } })),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(propose).not.toHaveBeenCalled();
  });

  it.each([0, -1, NaN, Infinity, 1.5])(
    'refuses an invalid total budget %s before generation',
    async (timeoutMs) => {
      const propose = vi.fn(() => Promise.resolve(METADATA));
      await expect(
        runAiAgent(incidentOptions({ timeoutMs, provider: { propose } })),
      ).rejects.toBeInstanceOf(RangeError);
      expect(propose).not.toHaveBeenCalled();
    },
  );
});
