import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AssembledAiContext } from '@craftkit/builder';

import { planProviderFromEnv } from './planProviderFromEnv';

describe('planProviderFromEnv', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('returns no provider when the endpoint is unset, so the local provider stays in charge', () => {
    expect(planProviderFromEnv({})).toBeUndefined();
    expect(planProviderFromEnv({ VITE_AI_PLAN_ENDPOINT: '' })).toBeUndefined();
    expect(planProviderFromEnv({ VITE_AI_PLAN_ENDPOINT: '   ' })).toBeUndefined();
  });

  it('builds a remote provider aimed at the configured endpoint', () => {
    const provider = planProviderFromEnv({
      VITE_AI_PLAN_ENDPOINT: 'https://assistant.example.test/plan',
    });

    expect(provider).toBeDefined();
    expect(typeof provider?.propose).toBe('function');
    expect(typeof provider?.repair).toBe('function');
  });

  it('sends an optional bridge bearer token', async () => {
    const fetch = vi.fn((_input: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            version: 1,
            rationale: 'Use the registered command.',
            commands: [{ command: 'setDocMeta', args: { dir: 'rtl' } }],
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const provider = planProviderFromEnv({
      VITE_AI_PLAN_ENDPOINT: 'https://assistant.example.test/plan',
      VITE_AI_PLAN_TOKEN: 'development-secret',
    });
    const context: AssembledAiContext = {
      fragments: [],
      totalTokens: 0,
      blocks: [],
      document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
      selection: { ids: [] },
    };

    await provider?.propose('Change direction.', context);

    const init = fetch.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer development-secret');
  });

  /*
    A plan is 15-25k output tokens; through the dev CLI backend that is three
    to five minutes, and through the API it is minutes too. A two-minute panel
    deadline aborted every real run in flight and reported it as a provider
    failure — the request has to outlive the server's own cap so the server's
    specific message is the one the user reads.
  */
  it('waits longer than a plan takes instead of aborting a live run', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: string | URL | Request, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      }),
    );
    const provider = planProviderFromEnv({
      VITE_AI_PLAN_ENDPOINT: 'https://assistant.example.test/plan',
    });
    const context: AssembledAiContext = {
      fragments: [],
      totalTokens: 0,
      blocks: [],
      document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
      selection: { ids: [] },
    };

    void provider?.propose('Add a hero.', context).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(300_000);

    expect(signal?.aborted).toBe(false);
    vi.useRealTimers();
  });

  it('allows explicit development HTTP only for a loopback bridge', () => {
    expect(
      planProviderFromEnv({
        DEV: true,
        VITE_AI_PLAN_ENDPOINT: 'http://localhost:8787/plan',
      }),
    ).toBeDefined();
    expect(() =>
      planProviderFromEnv({
        DEV: false,
        VITE_AI_PLAN_ENDPOINT: 'http://localhost:8787/plan',
      }),
    ).toThrow(/HTTPS/i);
    expect(() =>
      planProviderFromEnv({
        DEV: true,
        VITE_AI_PLAN_ENDPOINT: 'http://assistant.example.test/plan',
      }),
    ).toThrow(/HTTPS/i);
  });
});
