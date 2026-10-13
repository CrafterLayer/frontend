/**
 * The writers of a build (smarter live workers, 2026-10-12): every page build runs its
 * section writers through a pool of the person's worker count, and its provider tells
 * that pool how the calls went. A rate limit or an overload halves the writers at once;
 * answers that come back grow them again, never past the person's number. A site's
 * pages share the site's one pool; a page built alone gets its own.
 */
import {
  type AiPlanProvider,
  type AiWriterPool,
  congestionAwareProvider,
  createAiWriterPool,
  type RunAiBuildOptions,
} from '@craftkit/builder';

export function writerOptions(
  provider: AiPlanProvider,
  workers: number,
  shared?: AiWriterPool,
): Pick<RunAiBuildOptions, 'provider' | 'writerPool'> {
  const pool = shared ?? createAiWriterPool(Math.max(1, workers));
  return { writerPool: pool, provider: congestionAwareProvider(provider, pool) };
}
