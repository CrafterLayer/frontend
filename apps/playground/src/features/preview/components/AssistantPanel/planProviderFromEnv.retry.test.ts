import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiPlanProvider, AssembledAiContext } from '@craftkit/builder';

import { planProviderFromEnv } from './planProviderFromEnv';

const ENDPOINT = 'https://assistant.example.test/plan';

const context: AssembledAiContext = {
  fragments: [],
  totalTokens: 0,
  blocks: [],
  document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
  selection: { ids: [] },
};

function planResponse(): Response {
  return new Response(
    JSON.stringify({
      version: 1,
      rationale: 'Use the registered command.',
      commands: [{ command: 'setDocMeta', args: { dir: 'rtl' } }],
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

/** The wiring must produce a provider here; every case below configures one. */
function wiredProvider(): AiPlanProvider {
  const provider = planProviderFromEnv({ VITE_AI_PLAN_ENDPOINT: ENDPOINT });
  if (provider === undefined) throw new Error('planProviderFromEnv returned no provider.');
  return provider;
}

describe('planProviderFromEnv retry wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /*
    The real failure this prevents: a ten-section build is eleven POSTs, and
    one 529 or one dropped connection anywhere in that sequence used to lose
    the section outright.
  */
  it('rides out a transient 503 instead of losing the request', async () => {
    let calls = 0;
    const fetch = vi.fn((_input: string | URL | Request, _init?: RequestInit) => {
      calls += 1;
      return Promise.resolve(calls === 1 ? new Response('busy', { status: 503 }) : planResponse());
    });
    vi.stubGlobal('fetch', fetch);

    const proposal = wiredProvider().propose('Add a hero.', context);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(proposal).resolves.toMatchObject({ rationale: 'Use the registered command.' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not spend a second call on a refusal, which would fail identically', async () => {
    const fetch = vi.fn((_input: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ version: 1, refusal: 'I cannot do that.' }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);

    const refused = expect(wiredProvider().propose('Add a hero.', context)).rejects.toThrow(
      'I cannot do that.',
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await refused;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  /*
    Cache outside retry: the repeated ask is answered from the memory and never
    reaches the network, so the retry loop only ever runs where the flakiness
    is — on the far side of the cache.
  */
  it('still answers a repeated identical ask from the cache, without a second POST', async () => {
    const fetch = vi.fn((_input: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(planResponse()),
    );
    vi.stubGlobal('fetch', fetch);
    const provider = wiredProvider();

    const first = provider.propose('Add a hero.', context);
    await vi.advanceTimersByTimeAsync(10_000);
    await first;
    const second = provider.propose('Add a hero.', context);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(second).resolves.toMatchObject({ rationale: 'Use the registered command.' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
