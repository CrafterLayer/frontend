import {
  createCachingAiPlanProvider,
  createRemoteAiPlanProvider,
  type AiPlanProvider,
} from '@craftkit/builder';

/**
 * The one wiring point between the playground and a real assistant server.
 *
 * Set `VITE_AI_PLAN_ENDPOINT` and every assistant request POSTs the wire
 * contract (`AiPlanWireRequest` from `@craftkit/builder`) to that URL. Leave it
 * unset and the deterministic local provider keeps answering, exactly as
 * before. Either way the response walks the same registry + scratch-kernel
 * validation; the server proposes, it never writes.
 */
export function planProviderFromEnv(
  env: Readonly<Record<string, unknown>>,
): AiPlanProvider | undefined {
  const raw = env['VITE_AI_PLAN_ENDPOINT'];
  const endpoint = typeof raw === 'string' ? raw.trim() : '';
  if (endpoint === '') {
    return undefined;
  }
  // Generous deadline: a dev bridge fronting a CLI-spawned model can take a
  // minute; a production server should answer far inside this. The cache makes
  // a repeated ask on an unchanged page instant and free.
  return createCachingAiPlanProvider(createRemoteAiPlanProvider({ endpoint, timeoutMs: 120_000 }));
}
