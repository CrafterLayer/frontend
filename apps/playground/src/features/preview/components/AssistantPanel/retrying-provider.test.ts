import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AiProviderError,
  type AiPlan,
  type AiPlanProvider,
  type AiPlanValidationIssue,
  type AiProposeOptions,
  type AssembledAiContext,
} from '@craftkit/builder';

import { createRetryingAiPlanProvider, type AiPlanRetryAttempt } from './retrying-provider';

const context: AssembledAiContext = {
  fragments: [],
  totalTokens: 0,
  blocks: [],
  document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
  selection: { ids: [] },
};

const plan: AiPlan = {
  rationale: 'Use the registered command.',
  commands: [{ command: 'setDocMeta', args: { dir: 'rtl' } }],
};

function networkError(): AiProviderError {
  return new AiProviderError('The assistant server could not be reached: fetch failed', {
    code: 'network',
    retryable: true,
  });
}

function timeoutError(): AiProviderError {
  return new AiProviderError('The assistant server timed out after 660000ms.', {
    code: 'timeout',
    retryable: true,
  });
}

function httpError(status: number): AiProviderError {
  return new AiProviderError(`The assistant server answered with status ${String(status)}.`, {
    code: 'http-status',
    retryable: status >= 500,
    status,
  });
}

/** Fails with each error in turn, then answers with the plan for every later call. */
function providerFailing(errors: readonly Error[]) {
  let calls = 0;
  const propose = vi.fn((): Promise<AiPlan> => {
    const error = errors[calls];
    calls += 1;
    return error === undefined ? Promise.resolve(plan) : Promise.reject(error);
  });
  return { propose };
}

/**
 * The retry loop is timer-driven, so a test has to know the backoff sleep is
 * actually pending before it aborts or advances. Draining microtasks until a
 * timer exists is deterministic; a fixed number of `await`s would encode
 * p-retry's internal await count and rot the moment it changes.
 */
async function waitForPendingBackoff(): Promise<void> {
  for (let tick = 0; tick < 50 && vi.getTimerCount() === 0; tick += 1) {
    await Promise.resolve();
  }
}

describe('createRetryingAiPlanProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers with the plan after transient failures instead of losing the section', async () => {
    const inner = providerFailing([networkError(), httpError(529)]);
    const provider = createRetryingAiPlanProvider(inner, { random: () => 1 });

    const proposal = provider.propose('Add a hero.', context);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(proposal).resolves.toEqual(plan);
    expect(inner.propose).toHaveBeenCalledTimes(3);
  });

  it('gives up once the attempt budget is spent, with the last failure', async () => {
    const inner = providerFailing([timeoutError(), timeoutError(), timeoutError()]);
    const provider = createRetryingAiPlanProvider(inner, { random: () => 1 });

    /*
      The rejection assertion is attached BEFORE the clock moves. The run fails
      while the timers advance, and a rejection nobody is listening to yet is
      an unhandled rejection — noise that would eventually be mistaken for a
      real defect.
    */
    const failure = expect(provider.propose('Add a hero.', context)).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(10_000);

    await failure;
    expect(inner.propose).toHaveBeenCalledTimes(3);
  });

  /*
    Every one of these fails identically on a second identical POST, so a retry
    only spends the person's time and the account's money. `invalid-output` is
    the pointed case: the remote provider marks it retryable, and we still do
    not retry it — a plan-shaped answer is the plan-repair round trip's job.
  */
  it.each([
    ['a refusal', new AiProviderError('I cannot do that.', { code: 'refusal', retryable: false })],
    [
      'invalid output the provider itself calls retryable',
      new AiProviderError('Not a plan.', { code: 'invalid-output', retryable: true }),
    ],
    [
      'an endpoint policy failure',
      new AiProviderError('HTTPS required.', { code: 'endpoint-policy', retryable: false }),
    ],
    ['a 400 that means the request is wrong', httpError(400)],
    ['a 404', httpError(404)],
  ])('does not retry %s', async (_label, error) => {
    const inner = providerFailing([error, error, error]);
    const provider = createRetryingAiPlanProvider(inner, { random: () => 1 });

    const failure = expect(provider.propose('Add a hero.', context)).rejects.toThrow(error.message);
    await vi.advanceTimersByTimeAsync(10_000);

    await failure;
    expect(inner.propose).toHaveBeenCalledTimes(1);
  });

  it('stops the instant the run is cancelled instead of sleeping out the backoff', async () => {
    const controller = new AbortController();
    const inner = providerFailing([networkError(), networkError()]);
    const provider = createRetryingAiPlanProvider(inner, {
      random: () => 1,
      baseDelayMs: 60_000,
      maxDelayMs: 60_000,
    });

    const proposal = provider.propose('Add a hero.', context, { signal: controller.signal });
    await waitForPendingBackoff();
    expect(inner.propose).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    controller.abort();

    // No clock is advanced between the abort and the rejection: the wait ends
    // because it was cancelled, not because its sixty seconds elapsed.
    await expect(proposal).rejects.toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
    expect(inner.propose).toHaveBeenCalledTimes(1);
  });

  it('refuses to start at all once the caller has already cancelled', async () => {
    const inner = providerFailing([]);
    const provider = createRetryingAiPlanProvider(inner, { random: () => 1 });

    await expect(
      provider.propose('Add a hero.', context, { signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(inner.propose).not.toHaveBeenCalled();
  });

  it('does not hand back an answer an inner provider produced after cancellation', async () => {
    const controller = new AbortController();
    const inner = {
      propose: vi.fn((): Promise<AiPlan> => {
        controller.abort();
        return Promise.resolve(plan);
      }),
    };
    const provider = createRetryingAiPlanProvider(inner, { random: () => 1 });

    await expect(
      provider.propose('Add a hero.', context, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('grows each backoff window and clamps it at the cap', async () => {
    const attempts: AiPlanRetryAttempt[] = [];
    const inner = providerFailing([
      networkError(),
      networkError(),
      networkError(),
      networkError(),
    ]);
    const provider = createRetryingAiPlanProvider(inner, {
      // A jitter source pinned to its ceiling makes the schedule the widest
      // window the policy allows, which is the thing worth asserting.
      random: () => 1,
      maxAttempts: 4,
      baseDelayMs: 1_000,
      maxDelayMs: 2_500,
      onRetry: (attempt) => attempts.push(attempt),
    });

    const failure = expect(provider.propose('Add a hero.', context)).rejects.toThrow(
      /could not be reached/,
    );
    await vi.advanceTimersByTimeAsync(60_000);
    await failure;

    expect(attempts.map((attempt) => attempt.delayMs)).toEqual([1_000, 2_000, 2_500]);
  });

  /*
    Full jitter draws from the WHOLE window, `[0, ceiling]`. p-retry's own
    `randomize` cannot do this — it multiplies by 1-2x, so its shortest wait is
    still the full base delay — which is why the wait is taken here instead.
  */
  it('draws the whole window, so a floor of zero is reachable', async () => {
    const delays: number[] = [];
    const inner = providerFailing([networkError(), networkError()]);
    const provider = createRetryingAiPlanProvider(inner, {
      random: () => 0,
      onRetry: (attempt) => delays.push(attempt.delayMs),
    });

    const proposal = provider.propose('Add a hero.', context);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(proposal).resolves.toEqual(plan);
    expect(delays).toEqual([0, 0]);
  });

  it('reports each retry so a panel can say "retrying (2/3)"', async () => {
    const attempts: AiPlanRetryAttempt[] = [];
    const failure = httpError(503);
    const inner = providerFailing([failure]);
    const provider = createRetryingAiPlanProvider(inner, {
      random: () => 1,
      onRetry: (attempt) => attempts.push(attempt),
    });

    const proposal = provider.propose('Add a hero.', context);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(proposal).resolves.toEqual(plan);

    expect(attempts).toEqual([
      { attempt: 1, maxAttempts: 3, delayMs: 1_000, error: failure },
    ]);
  });

  it('retries a repair over the same flaky wire, and mirrors an absent repair', async () => {
    const issues: readonly AiPlanValidationIssue[] = [
      { code: 'unknown-command', message: 'No such command.' },
    ];
    let calls = 0;
    const inner: AiPlanProvider = {
      propose: () => Promise.resolve(plan),
      repair: (
        _request: string,
        _context: AssembledAiContext,
        _plan: AiPlan,
        _issues: readonly AiPlanValidationIssue[],
        _live?: AiProposeOptions,
      ): Promise<AiPlan> => {
        calls += 1;
        return calls === 1 ? Promise.reject(httpError(502)) : Promise.resolve(plan);
      },
    };
    const provider = createRetryingAiPlanProvider(inner, { random: () => 1 });

    const repaired = provider.repair?.('Add a hero.', context, plan, issues);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(repaired).resolves.toEqual(plan);
    expect(calls).toBe(2);
    // A repair-less inner provider must stay repair-less, or generateAiPlan
    // walks a repair path that cannot exist.
    const withoutRepair = createRetryingAiPlanProvider({ propose: () => Promise.resolve(plan) });
    expect(Object.hasOwn(withoutRepair, 'repair')).toBe(false);
  });

  it('passes a rejected plan through to an inner memory so it is not served again', () => {
    const forget = vi.fn();
    const provider = createRetryingAiPlanProvider({
      propose: () => Promise.resolve(plan),
      forget,
    });

    provider.forget?.('Add a hero.', context);

    expect(forget).toHaveBeenCalledWith('Add a hero.', context, undefined);
  });
});
