import { describe, expect, it } from 'vitest';

import { createCachingAiPlanProvider } from './caching-provider';
import { AiTaskUnsupportedError, createRemoteAiPlanProvider } from './remote-provider';
import type { AiPlanWireRequest } from './wire';

/*
  The site plan over the remote wire (T230, 2026-10-12): `task: 'site-plan'` on the plan
  endpoint, with the empty context a site plan needs, read into untrusted pages.
*/

const ENDPOINT = 'https://assistant.example.test/plan';

interface RecordedCall {
  readonly input: string;
  readonly init: RequestInit;
  readonly body: AiPlanWireRequest;
}

function fakeFetch(respond: () => Response) {
  const calls: RecordedCall[] = [];
  const fetchImpl = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (typeof input !== 'string' || typeof init?.body !== 'string') {
      throw new Error('The provider must POST a JSON string to a string endpoint.');
    }
    calls.push({ input, init, body: JSON.parse(init.body) as AiPlanWireRequest });
    return Promise.resolve(respond());
  };
  return { calls, fetchImpl };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const PAGES = [
  { title: 'Home', request: 'The home page of the Crumbs bakery site.' },
  { title: 'About', request: 'The about page of the Crumbs bakery site.' },
];

describe('createRemoteAiPlanProvider — proposeSitePlan (task: site-plan)', () => {
  it('POSTs the site-plan task to the plan endpoint and returns its pages', async () => {
    const { calls, fetchImpl } = fakeFetch(() =>
      jsonResponse({ version: 1, rationale: ' A warm bakery. ', pages: [...PAGES, { title: 3 }] }),
    );
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fetchImpl,
      headers: { authorization: 'Bearer secret' },
    });

    const answer = await provider.proposeSitePlan('Build a 2-page bakery site', {
      history: [{ role: 'user', text: 'hello' }],
    });

    expect(answer).toEqual({ pages: PAGES, rationale: 'A warm bakery.' });
    const [call] = calls;
    expect(call?.input).toBe(ENDPOINT);
    expect(new Headers(call?.init.headers).get('authorization')).toBe('Bearer secret');
    expect(call?.body).toMatchObject({
      version: 1,
      request: 'Build a 2-page bakery site',
      task: 'site-plan',
      history: [{ role: 'user', text: 'hello' }],
      context: { blocks: [], fragments: [], selection: { ids: [] } },
    });
  });

  it('reads a refusal and invalid output as typed failures', async () => {
    const refusing = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fakeFetch(() => jsonResponse({ version: 1, refusal: 'Not a website.' })).fetchImpl,
    });
    await expect(refusing.proposeSitePlan('x')).rejects.toMatchObject({
      code: 'refusal',
      message: 'Not a website.',
    });
    const broken = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fakeFetch(() => jsonResponse({ version: 1, pages: 'Home' })).fetchImpl,
    });
    await expect(broken.proposeSitePlan('x')).rejects.toMatchObject({ code: 'invalid-output' });
  });

  it('remembers a server that predates the task, and never POSTs it again', async () => {
    const { calls, fetchImpl } = fakeFetch(() =>
      jsonResponse({ rationale: 'A hero.', commands: [] }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const first = await provider.proposeSitePlan('Build a site').catch((error: unknown) => error);
    expect(first).toBeInstanceOf(AiTaskUnsupportedError);
    expect(first).toMatchObject({ task: 'site-plan', retryable: false });
    await expect(provider.proposeSitePlan('Build a site')).rejects.toBeInstanceOf(
      AiTaskUnsupportedError,
    );
    expect(calls).toHaveLength(1);
  });

  it('rejects with the platform AbortError before posting when already stopped', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse({ version: 1, pages: PAGES }));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    await expect(
      provider.proposeSitePlan('Build a site', { signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(0);
  });

  it('survives the caching decorator, which answers a repeated ask from memory', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse({ version: 1, pages: PAGES }));
    const cached = createCachingAiPlanProvider(
      createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl }),
    );
    expect(Object.hasOwn(cached, 'proposeSitePlan')).toBe(true);
    await cached.proposeSitePlan?.('Build a site');
    await cached.proposeSitePlan?.('Build a site');
    expect(calls).toHaveLength(1);
  });
});
