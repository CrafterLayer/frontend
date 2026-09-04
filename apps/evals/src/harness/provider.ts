import {
  createLocalAiPlanProvider,
  createRemoteAiPlanProvider,
  type AiPlanProvider,
} from './builder';

export type EvalMode = 'offline' | 'live';

/** Where the live mode POSTs its plan requests when nothing else is configured. */
export const DEFAULT_LIVE_ENDPOINT = 'http://127.0.0.1:8787/ai/plan';

/** See the reasoning at the call site; exported so a test can pin it. */
export const LIVE_TIMEOUT_MS = 660_000;

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
    /*
      Eleven minutes, matching the playground's own deadline and for the same
      measured reason: a plan is 15-25k output tokens, which is minutes through
      the API and three to five through the dev CLI backend. At the five minutes
      this used to allow, a live eval aborted healthy runs and recorded them as
      provider failures — the harness would have reported the assistant failing
      at exactly the cases that take longest, which is the opposite of what it
      is for. It sits just above the server's own ten-minute cap so a real
      timeout is reported by the side that knows why.
    */
    timeoutMs: options.timeoutMs ?? LIVE_TIMEOUT_MS,
  });
}
