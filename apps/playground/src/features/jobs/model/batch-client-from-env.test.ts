/**
 * The batch client from the playground's environment (2026-10-12): the same endpoint and
 * token as the live plan provider, the batch routes on the endpoint's origin, the token as
 * the bearer; none without an endpoint, or for one the client refuses.
 */
import { describe, expect, it } from 'vitest';

import { batchClientFromEnv } from './batch-client-from-env';

function recordingFetch() {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return Promise.resolve(
      new Response(
        JSON.stringify({
          version: 1,
          id: 'msgbatch_1',
          status: 'in_progress',
          counts: { processing: 1, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
          createdAt: '2026-10-12T14:00:00Z',
          endedAt: null,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
  };
  return { calls, fetchImpl };
}

describe('batchClientFromEnv', () => {
  it('is absent without an endpoint', () => {
    expect(batchClientFromEnv({})).toBeUndefined();
    expect(batchClientFromEnv({ VITE_AI_PLAN_ENDPOINT: '   ' })).toBeUndefined();
  });

  it("asks the batch routes on the plan endpoint's origin, with the token as the bearer", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const client = batchClientFromEnv(
      {
        VITE_AI_PLAN_ENDPOINT: ' https://assistant.example.test/plan ',
        VITE_AI_PLAN_TOKEN: ' secret ',
      },
      fetchImpl,
    );
    const state = await client?.status('msgbatch_1');
    expect(state?.status).toBe('in_progress');
    expect(calls[0]?.url).toBe('https://assistant.example.test/batch/msgbatch_1');
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('Bearer secret');
  });

  it('refuses plain HTTP, except a loopback server in development', () => {
    expect(
      batchClientFromEnv({ VITE_AI_PLAN_ENDPOINT: 'http://assistant.example.test/plan' }),
    ).toBe(undefined);
    expect(
      batchClientFromEnv({ VITE_AI_PLAN_ENDPOINT: 'http://localhost:8787/plan', DEV: true }),
    ).toBeDefined();
  });
});
