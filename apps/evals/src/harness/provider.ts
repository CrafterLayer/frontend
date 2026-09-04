import {
  createLocalAiPlanProvider,
  createRemoteAiPlanProvider,
  type AiPlanProvider,
} from './builder';

export type EvalMode = 'offline' | 'live';

/** Where the live mode POSTs its plan requests when nothing else is configured. */
export const DEFAULT_LIVE_ENDPOINT = 'http://127.0.0.1:8787/ai/plan';

export interface EvalProviderOptions {
  mode?: EvalMode;
  endpoint?: string;
  timeoutMs?: number;
}

/**
 * Read the mode from the environment.
 *
 * Offline is the default on purpose. An eval harness whose default reaches the
 * network is one that fails in CI, gets marked flaky, and is then ignored —
 * which is exactly the fate this package exists to avoid. Turning it live is a
 * deliberate act: `CRAFTKIT_EVAL_MODE=live`.
 */
export function resolveEvalMode(env: Record<string, string | undefined> = process.env): EvalMode {
  return env['CRAFTKIT_EVAL_MODE'] === 'live' ? 'live' : 'offline';
}

export function resolveLiveEndpoint(env: Record<string, string | undefined> = process.env): string {
  return env['VITE_AI_PLAN_ENDPOINT'] ?? env['CRAFTKIT_AI_PLAN_ENDPOINT'] ?? DEFAULT_LIVE_ENDPOINT;
}

/**
 * The provider a run is given.
 *
 * Offline is `createLocalAiPlanProvider()` — deterministic, no key, no socket.
 * Live is the ordinary remote provider pointed at `apps/ai-server`, reached
 * over the same wire contract the playground uses, so a live eval measures the
 * real thing and not a parallel client written for tests.
 *
 * `allowInsecureHttp` is set for the live path because the endpoint is a
 * developer's own machine on port 8787. The provider refuses plain HTTP by
 * default, which is right for a browser and wrong for a loopback eval.
 */
export function createEvalProvider(options: EvalProviderOptions = {}): AiPlanProvider {
  const mode = options.mode ?? resolveEvalMode();
  if (mode === 'offline') return createLocalAiPlanProvider();
  const endpoint = options.endpoint ?? resolveLiveEndpoint();
  return createRemoteAiPlanProvider({
    endpoint,
    allowInsecureHttp: endpoint.startsWith('http://'),
    timeoutMs: options.timeoutMs ?? 300_000,
  });
}
