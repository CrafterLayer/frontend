/**
 * The batch routes of the assistant server the playground already talks to (2026-10-12):
 * the same `VITE_AI_PLAN_ENDPOINT` and `VITE_AI_PLAN_TOKEN` the live plan provider reads
 * (`planProviderFromEnv`), so a host never configures background jobs twice. The routes sit
 * on the plan endpoint's origin; the token is sent as the same bearer and never stored.
 */
import { createRemoteBatchClient, type AiBatchClient } from '@craftkit/builder';

/** One call about a batch takes seconds; a minute is the client's own deadline. */
const CALL_TIMEOUT_MS = 60_000;

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
 * The batch client, or none when no assistant server is configured (the offline provider
 * answers instead, and it cannot batch) or its endpoint is one the client refuses.
 */
export function batchClientFromEnv(
  env: Readonly<Record<string, unknown>>,
  fetchImpl?: typeof fetch,
): AiBatchClient | undefined {
  const raw = env['VITE_AI_PLAN_ENDPOINT'];
  const endpoint = typeof raw === 'string' ? raw.trim() : '';
  if (endpoint === '') return undefined;
  const rawToken = env['VITE_AI_PLAN_TOKEN'];
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  try {
    return createRemoteBatchClient({
      endpoint,
      timeoutMs: CALL_TIMEOUT_MS,
      ...(token === '' ? {} : { headers: { authorization: `Bearer ${token}` } }),
      ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
      allowInsecureHttp: isLoopbackDevelopmentEndpoint(endpoint, env),
    });
  } catch {
    return undefined;
  }
}
