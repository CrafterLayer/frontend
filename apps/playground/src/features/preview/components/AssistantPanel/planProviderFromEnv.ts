import {
  createCachingAiPlanProvider,
  createRemoteAiPlanProvider,
  type AiPlanProvider,
} from '@craftkit/builder';

function isLoopbackDevelopmentEndpoint(
  endpoint: string,
  env: Readonly<Record<string, unknown>>,
): boolean {
  if (env['DEV'] !== true) return false;
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
    );
  } catch {
    return false;
  }
}

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
  const rawToken = env['VITE_AI_PLAN_TOKEN'];
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  /*
    Eleven minutes, and it has to be this long. A plan is 15-25k output tokens
    — three to five minutes through the dev CLI backend and minutes through the
    API — so the previous two-minute deadline aborted every real run in flight
    and reported the server's healthy work as a provider failure. It sits just
    above the server's own ten-minute cap so a real timeout is reported by the
    side that knows why. The cache makes a repeated ask on an unchanged page
    instant and free.
  */
  return createCachingAiPlanProvider(
    createRemoteAiPlanProvider({
      endpoint,
      timeoutMs: 660_000,
      ...(token === '' ? {} : { headers: { authorization: `Bearer ${token}` } }),
      allowInsecureHttp: isLoopbackDevelopmentEndpoint(endpoint, env),
    }),
  );
}
