import {
  createCachingAiPlanProvider,
  createRemoteAiPlanProvider,
  type AiPlanProvider,
} from '@craftkit/builder';

import { createRetryingAiPlanProvider } from './retrying-provider';

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
  /** A model the person picked; named to the server, which decides whether it is allowed. */
  model?: string,
  /** The reasoning budget the person picked (`low` … `max`); the server holds it to its five. */
  effort?: string,
): AiPlanProvider | undefined {
  const raw = env['VITE_AI_PLAN_ENDPOINT'];
  const endpoint = typeof raw === 'string' ? raw.trim() : '';
  if (endpoint === '') {
    return undefined;
  }
  const rawToken = env['VITE_AI_PLAN_TOKEN'];
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  const chosen = model?.trim() ?? '';
  const budget = effort?.trim() ?? '';
  const rawTimeout = env['VITE_AI_PLAN_TIMEOUT_MS'];
  const requestedTimeout =
    typeof rawTimeout === 'string' || typeof rawTimeout === 'number'
      ? Number(rawTimeout)
      : Number.NaN;
  const timeoutMs =
    Number.isSafeInteger(requestedTimeout) &&
    requestedTimeout > 0 &&
    requestedTimeout <= 2_147_483_647
      ? requestedTimeout
      : 240_000;
  const headers = {
    ...(token === '' ? {} : { authorization: `Bearer ${token}` }),
    ...(chosen === '' ? {} : { 'x-craftkit-ai-model': chosen }),
    ...(budget === '' ? {} : { 'x-craftkit-ai-effort': budget }),
  };
  /*
    One transport attempt has a four-minute default. The engine's cumulative edit/creative
    signal ends all proposals, corrections and transport retries at the earlier run budget.
    Explicit VITE_AI_PLAN_TIMEOUT_MS retains capacity for a deliberately deep/custom host;
    changing the transport cap never gives a repair a fresh cumulative run budget.
  */
  /*
    The order is cache OUTSIDE retry, and it is the only correct one. Inverted,
    the retry loop would wrap the cache: a repeated ask that hits would be
    "retried" even though nothing failed, and — worse — every attempt of a
    failing call would re-enter the cache, whose job is to remember answers, not
    attempts. This way a hit never reaches the network at all, the retries all
    happen on the far side of the memory where the flakiness lives, and only the
    one answer that finally arrived is remembered. Nothing caches a failure
    either way, because a failure never gets that far.

    A ten-section build is eleven round trips; without the retry a single
    dropped connection or one 529 killed a section outright.
  */
  return createCachingAiPlanProvider(
    createRetryingAiPlanProvider(
      createRemoteAiPlanProvider({
        endpoint,
        timeoutMs,
        ...(Object.keys(headers).length === 0 ? {} : { headers }),
        allowInsecureHttp: isLoopbackDevelopmentEndpoint(endpoint, env),
      }),
    ),
  );
}

/**
 * The models the panel may OFFER, from `VITE_AI_PLAN_MODELS` (comma-separated
 * OpenRouter slugs). Offering is not allowing: the server keeps its own list
 * in `CRAFTKIT_AI_MODELS` and refuses anything outside it.
 */
export function planModelsFromEnv(env: Readonly<Record<string, unknown>>): readonly string[] {
  const raw = env['VITE_AI_PLAN_MODELS'];
  if (typeof raw !== 'string') return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== ''),
    ),
  ];
}
