import type {
  AiChatTurn,
  AiEnhancePromptOptions,
  AiPagePlanAttempt,
  AiPagePlanProposal,
  AiPlan,
  AiPlanProvider,
  AiPlanValidationIssue,
  AiPromptEnhanceInput,
  AiPromptEnhancement,
  AiProposeOptions,
  AiProposePagePlanOptions,
  AiProposeSitePlanOptions,
  AiSitePlanProposal,
  AssembledAiContext,
} from '../types';
import { canonicalJsonStringify } from '../internal/canonical-json';
import type { AiSceneReview } from './scene-review-wire';
import { CACHED_PROVIDER_USAGE, notifyProviderUsage } from './usage';

export interface CachingAiPlanProviderOptions {
  /** Entries kept before the oldest is evicted — per kind of answer (plan, page plan, rewrite, verdict). */
  capacity?: number;
}

const DEFAULT_CAPACITY = 32;

/**
 * Free code mode changes the question (the server adds its code card), so an
 * answer written with it off — a closed motion scene, "turn the switch on" —
 * is never served to a run with it on. Only when true: a run without the mode
 * keeps the key it always had.
 */
function freeCodeIdentity(freeCode: boolean | undefined): { freeCode?: true } {
  return freeCode === true ? { freeCode: true } : {};
}

/** Every prompt-visible context byte participates in cache identity. */
function cacheKey(
  request: string,
  context: AssembledAiContext,
  live: AiProposeOptions | undefined,
): string {
  return canonicalJsonStringify({
    context,
    history: live?.history ?? [],
    request,
    ...freeCodeIdentity(live?.freeCode),
  });
}

/**
 * A page plan's identity: everything a plan key holds, plus the task and the
 * repair attempt — a repair of a refused candidate is a different question
 * from the first ask, and must never be answered with the first answer.
 */
function pagePlanKey(
  request: string,
  context: AssembledAiContext,
  history: readonly AiChatTurn[] | undefined,
  attempt: AiPagePlanAttempt | undefined,
  freeCode?: boolean,
): string {
  return canonicalJsonStringify({
    attempt: attempt ?? null,
    context,
    history: history ?? [],
    request,
    task: 'page-plan',
    ...freeCodeIdentity(freeCode),
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) signal.throwIfAborted();
}

interface LruMemory<T> {
  readonly get: (key: string) => T | undefined;
  readonly set: (key: string, value: T) => void;
  readonly delete: (key: string) => void;
}

/** A bounded LRU: a hit refreshes recency, an insert past capacity drops the oldest. */
function lruMemory<T>(capacity: number): LruMemory<T> {
  const entries = new Map<string, T>();
  return {
    get(key) {
      const hit = entries.get(key);
      if (hit !== undefined) {
        // Refresh recency so a hot ask survives longer than a stale one.
        entries.delete(key);
        entries.set(key, hit);
      }
      return hit;
    },
    set(key, value) {
      entries.set(key, value);
      if (entries.size > capacity) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
    },
    delete(key) {
      entries.delete(key);
    },
  };
}

/**
 * Remember an answer by `key`; ask `inner` only on a miss. Cancellation is
 * checked before a hit is served and after the inner call resolves — an inner
 * provider may ignore cancellation, and its stale answer must neither be
 * cached nor returned after the caller has ended the run.
 */
async function remembered<T>(
  memory: LruMemory<T>,
  key: string,
  signal: AbortSignal | undefined,
  ask: () => Promise<T>,
  onHit?: () => void,
): Promise<T> {
  throwIfAborted(signal);
  const hit = memory.get(key);
  if (hit !== undefined) {
    throwIfAborted(signal);
    onHit?.();
    return hit;
  }
  const answer = await ask();
  throwIfAborted(signal);
  memory.set(key, answer);
  return answer;
}

/**
 * Plan caching as a decorator (the test-time memory pattern: a repeated ask on
 * an unchanged document is answered instantly and for free). Wraps ANY
 * `AiPlanProvider` — local, remote, scripted — so hosts opt in with one line.
 * A rejected proposal is dropped through `forget`; `repair` always reaches the model,
 * because a repair exists precisely because the cached shape of an answer was
 * wrong.
 *
 * The optional capabilities are mirrored exactly: `proposePagePlan`, `proposeSitePlan`,
 * `reviewScene` and `enhancePrompt` exist on the decorator only when the
 * inner provider has them, because their ABSENCE is a signal — the build falls back to its
 * scaffold without `proposePagePlan`, and the panel hides Improve without
 * `enhancePrompt`. A decorator that dropped them made the page-plan path
 * unreachable from the playground (engine wave-2 verifier, 2026-09-28); one
 * that stubbed them would break both fallbacks.
 */
export function createCachingAiPlanProvider(
  inner: AiPlanProvider,
  options: CachingAiPlanProviderOptions = {},
): AiPlanProvider {
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new RangeError('AI plan cache capacity must be a positive safe integer.');
  }
  const plans = lruMemory<AiPlan>(capacity);
  const innerRepair = inner.repair?.bind(inner);
  const innerProposePagePlan = inner.proposePagePlan?.bind(inner);
  const innerEnhancePrompt = inner.enhancePrompt?.bind(inner);
  const innerProposeSitePlan = inner.proposeSitePlan?.bind(inner);
  const innerReviewScene = inner.reviewScene?.bind(inner);

  const provider: AiPlanProvider = {
    // async, so a key that cannot be computed rejects like every other failure.
    async propose(
      request: string,
      context: AssembledAiContext,
      live?: AiProposeOptions,
    ): Promise<AiPlan> {
      return remembered(
        plans,
        cacheKey(request, context, live),
        live?.signal,
        () => inner.propose(request, context, live),
        () => {
          notifyProviderUsage(live?.onUsage, CACHED_PROVIDER_USAGE);
        },
      );
    },
    /*
      The door rejected that answer, so it must not be served again. Without
      this the cache turns one bad proposal into a permanent one: the person
      retries, the same rejected plan comes back in milliseconds, and the model
      is never asked a second time.
    */
    forget(request: string, context: AssembledAiContext, live?: AiProposeOptions): void {
      plans.delete(cacheKey(request, context, live));
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
  if (innerProposePagePlan !== undefined) {
    const pagePlans = lruMemory<AiPagePlanProposal>(capacity);
    /*
      A page plan is a whole page's design — ~60-85 s of a live model call
      (cli:haiku, 2026-09-28) — so Plan mode followed by Build, or a retried
      build on an unchanged page, is exactly the repeat worth remembering.

      Drafts (2026-10-05, DESIGN §5.2): `live` — `onDraft` included — reaches
      the inner provider unchanged on a miss, so a streaming inner provider
      feeds the caller's observer as the answer is written. `onDraft` never
      enters the cache key (pagePlanKey reads only request, context, history
      and attempt): an observer is not part of the question. A HIT emits no
      drafts at all — the caller gets the remembered proposal at once and
      takes its non-streamed path, which is the fast one anyway.
    */
    provider.proposePagePlan = async (
      request: string,
      context: AssembledAiContext,
      live?: AiProposePagePlanOptions,
    ): Promise<AiPagePlanProposal> => {
      if (live?.attempt !== undefined) {
        /*
          A repair call PROVES the first answer to this ask was refused by
          validatePagePlan — the page-plan twin of `forget`, which the engine
          does not call for page plans. Kept, it would come back on the next
          identical ask, be refused again, and cost a paid repair round every
          time instead of one fresh first answer.
        */
        pagePlans.delete(pagePlanKey(request, context, live.history, undefined, live.freeCode));
      }
      return remembered(
        pagePlans,
        pagePlanKey(request, context, live?.history, live?.attempt, live?.freeCode),
        live?.signal,
        () => innerProposePagePlan(request, context, live),
        () => {
          notifyProviderUsage(live?.onUsage, CACHED_PROVIDER_USAGE);
        },
      );
    };
  }
  if (innerProposeSitePlan !== undefined) {
    const sitePlans = lruMemory<AiSitePlanProposal>(capacity);
    // A site plan (T230) reads only the words and the conversation: they are its key.
    provider.proposeSitePlan = async (
      request: string,
      live?: AiProposeSitePlanOptions,
    ): Promise<AiSitePlanProposal> =>
      remembered(
        sitePlans,
        canonicalJsonStringify({ history: live?.history ?? [], request, task: 'site-plan' }),
        live?.signal,
        () => innerProposeSitePlan(request, live),
        () => {
          notifyProviderUsage(live?.onUsage, CACHED_PROVIDER_USAGE);
        },
      );
  }
  if (innerReviewScene !== undefined) {
    const verdicts = lruMemory<AiSceneReview>(capacity);
    /*
      A scene review (2026-10-13) is remembered by what its pictures were drawn from, never by
      the pictures: a running scene is never drawn the same twice, and a key of 200 KB of base64
      would buy nothing. A build names the source (`sourceKey`, agent/scene-review-economy.ts),
      so the same section looked at again — a regenerate, a rebuild after an undo, an identical
      re-run — reuses the verdict at no cost; a review without one passes through. Only a verdict
      is kept: a refusal or a failure throws before it gets here. Its absence stays a signal —
      a build reviews nothing without it.
    */
    provider.reviewScene = async (request, live) => {
      const ask = () => innerReviewScene(request, live);
      if (request.sourceKey !== undefined) {
        return remembered(verdicts, request.sourceKey, live?.signal, ask, () => {
          notifyProviderUsage(live?.onUsage, CACHED_PROVIDER_USAGE);
        });
      }
      throwIfAborted(live?.signal);
      const review = await ask();
      throwIfAborted(live?.signal);
      return review;
    };
  }
  if (innerEnhancePrompt !== undefined) {
    const rewrites = lruMemory<AiPromptEnhancement>(capacity);
    // The exact input is the key: the same draft on the same page with the same answers.
    provider.enhancePrompt = async (
      input: AiPromptEnhanceInput,
      live?: AiEnhancePromptOptions,
    ): Promise<AiPromptEnhancement> =>
      remembered(rewrites, canonicalJsonStringify(input), live?.signal, () =>
        innerEnhancePrompt(input, live),
      );
  }
  return provider;
}
