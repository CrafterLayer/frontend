import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createBuilder,
  enhanceRequest,
  planAiPage,
  type AiPlanWireRequest,
  type AssembledAiContext,
} from '@craftkit/builder';
import { fixedClock, fixtureBlocks, seededIds } from '@craftkit/builder/testing';

import { planModelsFromEnv, planProviderFromEnv } from './planProviderFromEnv';

describe('planModelsFromEnv', () => {
  it('reads a comma-separated list, trimmed and without repeats or blanks', () => {
    expect(planModelsFromEnv({})).toEqual([]);
    expect(
      planModelsFromEnv({
        VITE_AI_PLAN_MODELS: ' minimax/minimax-m3:free, nvidia/x:free,,minimax/minimax-m3:free ',
      }),
    ).toEqual(['minimax/minimax-m3:free', 'nvidia/x:free']);
  });
});

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

  /* The person picks a model in the panel; the server decides whether it is allowed. */
  it('names the chosen model in a header, and sends no header when none is chosen', async () => {
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
    const context: AssembledAiContext = {
      fragments: [],
      totalTokens: 0,
      blocks: [],
      document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
      selection: { ids: [] },
    };
    const env = { VITE_AI_PLAN_ENDPOINT: 'https://assistant.example.test/plan' };

    await planProviderFromEnv(env, 'minimax/minimax-m3:free')?.propose(
      'Change direction.',
      context,
    );
    await planProviderFromEnv(env)?.propose('Change direction again.', context);

    const [chosen, unchosen] = fetch.mock.calls;
    expect(new Headers(chosen?.[1]?.headers).get('x-craftkit-ai-model')).toBe(
      'minimax/minimax-m3:free',
    );
    expect(new Headers(unchosen?.[1]?.headers).get('x-craftkit-ai-model')).toBeNull();
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

/*
  The chain the panel really uses — cache(retry(remote)) — must carry the
  optional capabilities through both decorators. Before 2026-09-28 it carried
  neither: the remote provider had no `proposePagePlan` and both decorators
  forwarded only propose and repair, so the PagePlan build was unreachable
  from the product (engine wave-2 verifier).
*/
describe('planProviderFromEnv — the page plan and the enhancer through the whole chain', () => {
  const ENDPOINT = 'https://assistant.example.test/plan';
  const context: AssembledAiContext = {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
  };
  /** The wire's documented page plan (builder-ai provider/wire.ts), which its validator accepts. */
  const PAGE_PLAN = {
    intent: 'new-page',
    locale: { lang: 'en', dir: 'ltr' },
    title: 'Cardamom Roasters — specialty coffee in Amman',
    description: 'Small-batch coffee roasted every morning in Amman, delivered fresh.',
    tokens: {
      bg: '#f7fee7',
      surface: '#ffffff',
      ink: '#022c22',
      muted: '#065f46',
      accent: '#c2410c',
      onAccent: '#ffffff',
      accentInk: '#c2410c',
      border: '#d9f99d',
      fontDisplay: { family: 'Fraunces', weights: [600, 700] },
      fontBody: { family: 'Instrument Sans', weights: [400, 500] },
      radius: 'xl',
      signature: 'The brand name at text-8xl, faint behind the menu.',
      deckRowId: 'cafe',
    },
    primaryCta: { label: 'Order beans', href: '#order' },
    nav: [
      { label: 'Menu', anchorId: 'menu' },
      { label: 'Order', anchorId: 'order' },
    ],
    sections: [
      { key: 'header', role: 'header', title: 'Header', anchorId: 'top', purpose: 'Brand and navigation.' },
      {
        key: 'hero',
        role: 'hero',
        title: 'Roasted this morning',
        anchorId: 'hero',
        purpose: 'Say what the roastery is and invite the first order.',
        mustSay: ['Roasted daily in Amman'],
        variant: 'split',
      },
      { key: 'menu', role: 'band', title: 'Menu', anchorId: 'menu', purpose: 'The drinks and beans, with prices.', variant: 'menu' },
      { key: 'order', role: 'cta', title: 'Order', anchorId: 'order', purpose: 'One clear way to order.', variant: 'cta-split' },
      { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'Address, hours and contact.', variant: 'footer' },
    ],
    facts: [{ key: 'phone', sample: '+962 7 9000 0000', section: 'order' }],
  };

  function json(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  afterEach(() => vi.unstubAllGlobals());

  it('exposes proposePagePlan and enhancePrompt, because the remote provider under it has them', () => {
    const provider = planProviderFromEnv({ VITE_AI_PLAN_ENDPOINT: ENDPOINT });
    expect(typeof provider?.proposePagePlan).toBe('function');
    expect(typeof provider?.enhancePrompt).toBe('function');
  });

  it('posts the page-plan task with the bearer, and answers the repeat from the cache', async () => {
    const fetch = vi.fn((_input: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(json({ version: 1, pagePlan: PAGE_PLAN })),
    );
    vi.stubGlobal('fetch', fetch);
    const provider = planProviderFromEnv({
      VITE_AI_PLAN_ENDPOINT: ENDPOINT,
      VITE_AI_PLAN_TOKEN: 'development-secret',
    });

    await provider?.proposePagePlan?.('Build my roastery page', context);
    await provider?.proposePagePlan?.('Build my roastery page', context);

    expect(fetch).toHaveBeenCalledTimes(1);
    const init = fetch.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer development-secret');
    expect((JSON.parse(String(init?.body)) as AiPlanWireRequest).task).toBe('page-plan');
  });

  it('plans a page in Plan mode through the chain — the T1 path is reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json({ version: 1, rationale: 'Warm.', pagePlan: PAGE_PLAN }))),
    );
    const provider = planProviderFromEnv({ VITE_AI_PLAN_ENDPOINT: ENDPOINT });
    if (provider === undefined) throw new Error('planProviderFromEnv returned no provider.');

    const result = await planAiPage('Build a landing page for my roastery in Amman', {
      runId: 'env-plan-mode',
      clock: fixedClock(1),
      kernel: createBuilder({
        extensions: [fixtureBlocks],
        ports: { clock: fixedClock(1), ids: seededIds('env-plan-mode') },
      }),
      provider,
    });

    if (!('plan' in result)) throw new Error(result.error.message);
    expect(result.plan.sections.map(({ key }) => key)).toEqual([
      'header',
      'hero',
      'menu',
      'order',
      'footer',
    ]);
  });

  it('posts a draft to the enhance route with the bearer; a server without it leaves the tidy', async () => {
    const fetch = vi.fn((_input: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(json({ error: 'Endpoint not found.' }, 404)),
    );
    vi.stubGlobal('fetch', fetch);
    const provider = planProviderFromEnv({
      VITE_AI_PLAN_ENDPOINT: ENDPOINT,
      VITE_AI_PLAN_TOKEN: 'development-secret',
    });

    const result = await enhanceRequest(
      {
        text: 'هل يمكنك تربط ال صفحه هاي داخل عليها',
        locale: 'ar',
        intent: null,
        page: { empty: false, sections: ['Hero'] },
        selection: null,
        answers: [],
      },
      { provider },
    );

    expect(result).toMatchObject({
      enhanced: 'هل يمكنك تربط الصفحة هاي داخل عليها',
      source: 'tidy',
    });
    // A 404 is terminal: one POST, no retries.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe('https://assistant.example.test/v1/prompt/enhance');
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('authorization')).toBe(
      'Bearer development-secret',
    );
  });
});
