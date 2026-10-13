import { isAiProviderError } from '../provider/errors';
import type { AiPlanProvider } from '../types';
import type { AiWriterPool } from './writer-pool';

/*
  The provider side of smarter live workers (2026-10-12): every section writer's call goes
  through this wrapper, which tells the build's writers' pool how the provider answered — a
  call that came back (`succeeded`), or "too many at once" (`congested`: a rate limit, an
  overload, a busy server). The pool halves its writers on congestion and grows them back one at
  a time (writer-pool.ts). Only the calls section writers make are watched (propose, repair);
  everything else passes through untouched.
*/

/** Statuses that mean "fewer at once": rate limited, unavailable, overloaded. */
const CONGESTION_STATUSES = new Set([429, 503, 529]);

/** Whether an error says the provider is taking too many calls at once. */
export function isCongestion(error: unknown): boolean {
  if (isAiProviderError(error)) {
    return error.status !== undefined && CONGESTION_STATUSES.has(error.status);
  }
  // An SDK error that is not ours still carries its HTTP status.
  const status =
    typeof error === 'object' && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  return typeof status === 'number' && CONGESTION_STATUSES.has(status);
}

function reported<T>(pool: AiWriterPool, call: () => Promise<T>): Promise<T> {
  return call().then(
    (value) => {
      pool.succeeded();
      return value;
    },
    (error: unknown) => {
      if (isCongestion(error)) pool.congested();
      throw error;
    },
  );
}

/**
 * `provider` with its section-writing calls reported to `pool`. Every other member is the
 * provider's own (read through the prototype, so a class-based provider keeps its methods).
 */
export function congestionAwareProvider(
  provider: AiPlanProvider,
  pool: AiWriterPool,
): AiPlanProvider {
  const repair = provider.repair?.bind(provider);
  const watched: Partial<AiPlanProvider> = {
    propose: (request, context, options) =>
      reported(pool, () => provider.propose(request, context, options)),
    ...(repair === undefined
      ? {}
      : {
          repair: (request, context, plan, issues, options) =>
            reported(pool, () => repair(request, context, plan, issues, options)),
        }),
  };
  return Object.assign(Object.create(provider) as AiPlanProvider, watched);
}
