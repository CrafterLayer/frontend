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
