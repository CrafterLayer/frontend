import pRetry from 'p-retry';

import {
  isAiProviderError,
  type AiEnhancePromptOptions,
  type AiPagePlanProposal,
  type AiPlan,
  type AiPlanProvider,
  type AiPlanValidationIssue,
  type AiPromptEnhanceInput,
  type AiPromptEnhancement,
  type AiProposeOptions,
  type AiProposePagePlanOptions,
  type AssembledAiContext,
} from '@craftkit/builder';

/**
 * What the decorator tells the host each time it is about to wait and try
 * again. `attempt` is the attempt that just FAILED (1 for the first), so a
 * panel renders the one it is about to start as `attempt + 1` of
 * `maxAttempts` — "retrying (2/3)". `delayMs` is the jittered wait that has
 * not happened yet, so a countdown can be shown while it elapses.
 */
export interface AiPlanRetryAttempt {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly error: Error;
}

export interface RetryingAiPlanProviderOptions {
  /** Total attempts including the first. Defaults to 3, i.e. two retries. */
  maxAttempts?: number;
  /** Ceiling of the first backoff window in milliseconds. Defaults to 1000. */
  baseDelayMs?: number;
  /** Ceiling every later backoff window is clamped to. Defaults to 8000. */
  maxDelayMs?: number;
  /** Called just before each wait, so a panel can say "retrying (2/3)". */
  onRetry?: (attempt: AiPlanRetryAttempt) => void;
  /**
   * The jitter source, in `[0, 1)`. It exists so a test can pin the schedule
   * and prove the windows actually grow; production leaves it as Math.random,
   * which is the whole point of full jitter.
   */
  random?: () => number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 8_000;

/*
  The only statuses where trying the identical request again can plausibly
  succeed: the server told us it ran out of time (408), that we asked too often
  (429), or that its own side broke or is momentarily unavailable (500, 502,
  503, 504). 529 is not an IANA status — it is the "overloaded" code the model
  vendors return under capacity pressure, and it is the single most common
  transient failure a long generation meets, so it is listed explicitly rather
  than swept up by a `>= 500` rule that would also retry a permanent 501.
*/
const RETRYABLE_HTTP_STATUSES: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504, 529]);

/**
 * Retryability is decided from the provider's error TAXONOMY, never from the
 * message prose, which is human-facing and free to change.
 *
 * We deliberately do NOT trust `error.retryable`. The remote provider marks
 * `invalid-output` and `stream-protocol` retryable because from its own
 * position they are non-deterministic, but from here they are not worth a
 * second identical POST: a server that answered with something that is not a
 * plan will answer with something that is not a plan again, and the cure for
 * that is the agent's plan-repair round trip, not a retry. A `refusal` is a
 * decision, an `endpoint-policy` failure is a misconfiguration, a
 * `response-limit` failure is a size, and a 4xx outside the list below means
 * the request itself is wrong — every one of those would burn minutes of the
 * user's time to fail in exactly the same way.
 *
 * Retry-After: the provider does not surface it. `AiProviderErrorDetails`
 * carries `code`, `retryable` and `status` only — the Response, and therefore
 * its headers, is consumed and dropped inside the provider — so there is no
 * server-supplied delay to honour here. Honouring one would mean widening the
 * provider's error contract; we do not invent a field that nothing populates.
 *
 * `retryTimeouts: false` is the enhancer's budget (see `enhanceBudget`): a
 * timeout there is the server being slow, and slow again is the likely next
 * answer.
 */
function isWorthRetrying(error: unknown, retryTimeouts = true): boolean {
  if (!isAiProviderError(error)) return false;
  if (error.code === 'timeout') return retryTimeouts;
  if (error.code === 'network') return true;
  if (error.code === 'http-status') {
    return error.status !== undefined && RETRYABLE_HTTP_STATUSES.has(error.status);
  }
  return false;
}

/**
 * The caller's own cancellation must reach them as the platform AbortError,
 * exactly as the remote provider promises — a run the person stopped is not a
 * provider failure and must never be rendered as one.
 */
function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  if (reason instanceof Error && reason.name === 'AbortError') return reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}

/**
 * A backoff sleep that ends the moment the run is cancelled.
 *
 * This is the detail that decides whether "stop" feels instant: a plain
 * `setTimeout` sleep would hold the cancelled run hostage for the rest of the
 * current window before anyone noticed, so the abort listener rejects the wait
 * itself rather than being checked after it.
 */
async function sleepUnlessAborted(delayMs: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal === undefined) {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    return;
  }
  if (signal.aborted) throw abortError(signal);
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** How hard one kind of call is retried: its attempt budget, and whether a timeout earns another. */
interface RetryBudget {
  readonly attempts: number;
  readonly retryTimeouts: boolean;
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`Retrying AI plan provider ${name} must be a positive safe integer.`);
  }
}

/**
 * `AiPlanProvider` decorator that survives a flaky network.
 *
 * A ten-section build is eleven round trips; before this, one dropped
 * connection or one 529 anywhere in that sequence killed the section outright.
 * The agent library's plan-REPAIR round trip does not cover this — repair
 * fixes a plan the validator rejected, it cannot help a request that never
 * arrived.
 *
 * The schedule is exponential backoff with FULL JITTER: each wait is drawn
 * uniformly from `[0, min(maxDelay, base * 2^n))` rather than from a fixed
 * curve, so several browsers that were knocked back by the same overloaded
 * server do not all return in the same instant and knock it back down.
 *
 * The numbers are small ON PURPOSE. One legitimate call to this endpoint runs
 * for minutes — the panel's deadline is 660s — so the backoff is not a
 * throughput control, it is only a pause long enough for a blip or a rate
 * limit window to pass. Three attempts means two waits, drawn from at most 1s
 * and 2s: under three seconds added to a request that may already have cost
 * five minutes. The 8s cap only bites if a host raises `maxAttempts`, and it
 * is there so a longer schedule still cannot grow a wait that dwarfs the blip
 * it is waiting out. A schedule tuned to the request's own scale (a minute
 * between tries, say) would instead leave the person staring at a frozen panel
 * for longer than the work itself. Attempts stay few for the same reason: three
 * timeouts in a row is already 33 minutes of deadline, and the person's own
 * cancel is the escape hatch that ends it at once.
 */
export function createRetryingAiPlanProvider(
  inner: AiPlanProvider,
  options: RetryingAiPlanProviderOptions = {},
): AiPlanProvider {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const random = options.random ?? Math.random;
  const onRetry = options.onRetry;
  assertPositiveInteger('maxAttempts', maxAttempts);
  assertPositiveInteger('baseDelayMs', baseDelayMs);
  assertPositiveInteger('maxDelayMs', maxDelayMs);

  function fullJitterDelayMs(failedAttempt: number): number {
    const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** (failedAttempt - 1));
    return Math.round(random() * ceiling);
  }

  const planBudget: RetryBudget = { attempts: maxAttempts, retryTimeouts: true };
  /*
    The enhancer is an optional step between the person and their Send
    button, so it gets at most ONE retry and none after a timeout: its
    deadline is 45 s (remote-provider.ts), and a second identical wait after
    a timeout would double the stall for a rewrite the person can skip. A
    dropped connection or a 529 is still worth one quick second try.
  */
  const enhanceBudget: RetryBudget = {
    attempts: Math.min(maxAttempts, 2),
    retryTimeouts: false,
  };

  async function withRetries<T>(
    live: { readonly signal?: AbortSignal | undefined } | undefined,
    call: () => Promise<T>,
    budget: RetryBudget = planBudget,
  ): Promise<T> {
    const signal = live?.signal;
    if (signal?.aborted === true) throw abortError(signal);
    return pRetry(
      async () => {
        const answer = await call();
        // An inner provider may ignore cancellation; a run the person stopped
        // must not come back with an answer, the way the cache decorator also
        // refuses to serve or store one.
        if (signal?.aborted === true) throw abortError(signal);
        return answer;
      },
      {
        retries: budget.attempts - 1,
        /*
          p-retry's own schedule is switched off (`minTimeout: 0`) and the wait
          is taken here instead. Its `randomize` option multiplies the delay by
          1-2x, which is not full jitter, and its own sleep would run after
          this hook anyway. `shouldRetry` is the one place that runs only when
          a retry is genuinely going to happen: p-retry skips it once the
          budget is spent, so a non-retryable failure and the final failure
          both fail immediately instead of paying for a pointless sleep.
        */
        minTimeout: 0,
        shouldRetry: async ({ error, attemptNumber }) => {
          if (!isWorthRetrying(error, budget.retryTimeouts)) return false;
          const delayMs = fullJitterDelayMs(attemptNumber);
          onRetry?.({ attempt: attemptNumber, maxAttempts: budget.attempts, delayMs, error });
          await sleepUnlessAborted(delayMs, signal);
          return true;
        },
      },
    );
  }

  const innerRepair = inner.repair?.bind(inner);
  const innerForget = inner.forget?.bind(inner);
  const innerProposePagePlan = inner.proposePagePlan?.bind(inner);
  const innerEnhancePrompt = inner.enhancePrompt?.bind(inner);

  const provider: AiPlanProvider = {
    propose(
      request: string,
      context: AssembledAiContext,
      live?: AiProposeOptions,
    ): Promise<AiPlan> {
      return withRetries(live, () => inner.propose(request, context, live));
    },
  };
  // Mirror the inner surface exactly, the way the caching decorator does: a
  // provider without a repair must stay without one, or generateAiPlan walks a
  // repair path that cannot exist. A repair travels the same flaky wire as a
  // proposal, so it gets the same treatment.
  if (innerRepair !== undefined) {
    provider.repair = (
      request: string,
      context: AssembledAiContext,
      plan: AiPlan,
      issues: readonly AiPlanValidationIssue[],
      live?: AiProposeOptions,
    ): Promise<AiPlan> =>
      withRetries(live, () => innerRepair(request, context, plan, issues, live));
  }
  if (innerForget !== undefined) {
    provider.forget = (
      request: string,
      context: AssembledAiContext,
      live?: AiProposeOptions,
    ): void => {
      innerForget(request, context, live);
    };
  }
  /*
    The page plan (step T1) travels the same wire as a proposal, so it gets
    the same schedule. Mirrored only when the inner provider has it: before
    2026-09-28 this decorator forwarded propose and repair alone, and the
    playground's env provider lost `proposePagePlan` here even once the
    remote provider had it — every build fell back to the scaffold path
    (engine wave-2 verifier).
  */
  if (innerProposePagePlan !== undefined) {
    provider.proposePagePlan = (
      request: string,
      context: AssembledAiContext,
      live?: AiProposePagePlanOptions,
    ): Promise<AiPagePlanProposal> =>
      withRetries(live, () => innerProposePagePlan(request, context, live));
  }
  if (innerEnhancePrompt !== undefined) {
    provider.enhancePrompt = (
      input: AiPromptEnhanceInput,
      live?: AiEnhancePromptOptions,
    ): Promise<AiPromptEnhancement> =>
      withRetries(live, () => innerEnhancePrompt(input, live), enhanceBudget);
  }
  return provider;
}
