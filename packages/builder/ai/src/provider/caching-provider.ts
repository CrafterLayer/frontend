import type {
  AiPlan,
  AiPlanProvider,
  AiPlanValidationIssue,
  AiProposeOptions,
  AssembledAiContext,
} from '../types';

export interface CachingAiPlanProviderOptions {
  /** Entries kept before the oldest is evicted. */
  capacity?: number;
}

const DEFAULT_CAPACITY = 32;

/**
 * The cache key covers everything that changes what a correct answer IS: the
 * request's words, the document the plan will land on, the current selection,
 * and the conversation so far. Fragments and token counts are derived from the
 * same state, so they add bytes without adding discrimination.
 */
function cacheKey(
  request: string,
  context: AssembledAiContext,
  live: AiProposeOptions | undefined,
): string {
  return JSON.stringify([
    request,
    context.document,
    context.selection.ids,
    live?.history ?? [],
  ]);
}

/**
 * Plan caching as a decorator (the test-time memory pattern: a repeated ask on
 * an unchanged document is answered instantly and for free). Wraps ANY
 * `AiPlanProvider` — local, remote, scripted — so hosts opt in with one line.
 * Only successful proposals are stored; `repair` always reaches the model,
 * because a repair exists precisely because the cached shape of an answer was
 * wrong.
 */
export function createCachingAiPlanProvider(
  inner: AiPlanProvider,
  options: CachingAiPlanProviderOptions = {},
): AiPlanProvider {
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  const cache = new Map<string, AiPlan>();
  const innerRepair = inner.repair?.bind(inner);

  const provider: AiPlanProvider = {
    async propose(
      request: string,
      context: AssembledAiContext,
      live?: AiProposeOptions,
    ): Promise<AiPlan> {
      const key = cacheKey(request, context, live);
      const hit = cache.get(key);
      if (hit !== undefined) {
        // Refresh recency so a hot ask survives longer than a stale one.
        cache.delete(key);
        cache.set(key, hit);
        return hit;
      }
      const plan = await inner.propose(request, context, live);
      cache.set(key, plan);
      if (cache.size > capacity) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
          cache.delete(oldest);
        }
      }
      return plan;
    },
  };
  // Mirror the inner surface exactly: a repair-less provider must stay
  // repair-less, or generateAiPlan would walk a repair path that cannot exist.
  if (innerRepair !== undefined) {
    provider.repair = (
      request: string,
      context: AssembledAiContext,
      plan: AiPlan,
      issues: readonly AiPlanValidationIssue[],
      live?: AiProposeOptions,
    ): Promise<AiPlan> => innerRepair(request, context, plan, issues, live);
  }
  return provider;
}
