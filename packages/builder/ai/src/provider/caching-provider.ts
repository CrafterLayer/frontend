import type {
  AiPlan,
  AiPlanProvider,
  AiPlanValidationIssue,
  AiProposeOptions,
  AssembledAiContext,
} from '../types';
import { canonicalJsonStringify } from '../internal/canonical-json';

export interface CachingAiPlanProviderOptions {
  /** Entries kept before the oldest is evicted. */
  capacity?: number;
}

const DEFAULT_CAPACITY = 32;

/** Every prompt-visible context byte participates in cache identity. */
function cacheKey(
  request: string,
  context: AssembledAiContext,
  live: AiProposeOptions | undefined,
): string {
  return canonicalJsonStringify({ context, history: live?.history ?? [], request });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) signal.throwIfAborted();
}

/**
 * Plan caching as a decorator (the test-time memory pattern: a repeated ask on
 * an unchanged document is answered instantly and for free). Wraps ANY
 * `AiPlanProvider` — local, remote, scripted — so hosts opt in with one line.
 * A rejected proposal is dropped through `forget`; `repair` always reaches the model,
 * because a repair exists precisely because the cached shape of an answer was
 * wrong.
 */
export function createCachingAiPlanProvider(
  inner: AiPlanProvider,
  options: CachingAiPlanProviderOptions = {},
): AiPlanProvider {
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new RangeError('AI plan cache capacity must be a positive safe integer.');
  }
  const cache = new Map<string, AiPlan>();
  const innerRepair = inner.repair?.bind(inner);

  const provider: AiPlanProvider = {
    async propose(
      request: string,
      context: AssembledAiContext,
      live?: AiProposeOptions,
    ): Promise<AiPlan> {
      throwIfAborted(live?.signal);
      const key = cacheKey(request, context, live);
      throwIfAborted(live?.signal);
      const hit = cache.get(key);
      if (hit !== undefined) {
        throwIfAborted(live?.signal);
        // Refresh recency so a hot ask survives longer than a stale one.
        cache.delete(key);
        cache.set(key, hit);
        return hit;
      }
      const plan = await inner.propose(request, context, live);
      // An inner provider may ignore cancellation; never cache or return its
      // stale answer after the caller has ended the run.
      throwIfAborted(live?.signal);
      cache.set(key, plan);
      if (cache.size > capacity) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
          cache.delete(oldest);
        }
      }
      return plan;
    },
    /*
      The door rejected that answer, so it must not be served again. Without
      this the cache turns one bad proposal into a permanent one: the person
      retries, the same rejected plan comes back in milliseconds, and the model
      is never asked a second time.
    */
    forget(request: string, context: AssembledAiContext, live?: AiProposeOptions): void {
      cache.delete(cacheKey(request, context, live));
    },
  };
  // Mirror the inner surface exactly: a repair-less provider must stay
  // repair-less, or generateAiPlan would walk a repair path that cannot exist.
  if (innerRepair !== undefined) {
    provider.repair = async (
      request: string,
      context: AssembledAiContext,
      plan: AiPlan,
      issues: readonly AiPlanValidationIssue[],
      live?: AiProposeOptions,
    ): Promise<AiPlan> => {
      throwIfAborted(live?.signal);
      const repaired = await innerRepair(request, context, plan, issues, live);
      throwIfAborted(live?.signal);
      return repaired;
    };
  }
  return provider;
}
