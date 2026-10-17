import { describe, expect, it } from 'vitest';

import type { AssembledAiContext, PagePlanCandidate } from '../types';
import { AiTaskUnsupportedError, createRemoteAiPlanProvider } from './remote-provider';
import type { AiPlanWireRequest } from './wire';

/*
  Step T1 over the remote wire (2026-09-28). The playground's provider is this
  one, decorated; before this it had no `proposePagePlan`, so the PagePlan
  build was unreachable from the product and every build paid for the
  model-written scaffold instead (engine wave-2 verifier).
*/

const ENDPOINT = 'https://assistant.example.test/plan';

function context(): AssembledAiContext {
  return {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
  };
}

const CANDIDATE: PagePlanCandidate = { title: 'Cardamom Roasters', sections: [] };

interface RecordedCall {
  readonly input: string;
  readonly init: RequestInit;
  readonly body: AiPlanWireRequest;
}

function fakeFetch(respond: (call: RecordedCall) => Response | Promise<Response>) {
  const calls: RecordedCall[] = [];
  const fetchImpl = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (typeof input !== 'string' || typeof init?.body !== 'string') {
      throw new Error('The provider must POST a JSON string to a string endpoint.');
    }
    const call: RecordedCall = { input, init, body: JSON.parse(init.body) as AiPlanWireRequest };
    calls.push(call);
    return Promise.resolve(respond(call));
  };
  return { calls, fetchImpl };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function sseResponse(frames: string): Response {
  return new Response(frames, { headers: { 'content-type': 'text/event-stream' } });
}

describe('createRemoteAiPlanProvider — proposePagePlan (task: page-plan)', () => {
  it('POSTs the page-plan task to the plan endpoint with the same auth, and returns the plan', async () => {
    const { calls, fetchImpl } = fakeFetch(() =>
      jsonResponse({ version: 1, rationale: '  Warm and type-led.  ', pagePlan: CANDIDATE }),
    );
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fetchImpl,
      headers: { authorization: 'Bearer secret' },
    });

    const answer = await provider.proposePagePlan('Build my roastery page', context(), {
      history: [{ role: 'user', text: 'hello' }],
    });

    expect(answer).toEqual({ pagePlan: CANDIDATE, rationale: 'Warm and type-led.' });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.input).toBe(ENDPOINT);
    expect(new Headers(call?.init.headers).get('authorization')).toBe('Bearer secret');
    expect(new Headers(call?.init.headers).get('accept')).toContain('text/event-stream');
    expect(call?.body).toMatchObject({
      version: 1,
      request: 'Build my roastery page',
      task: 'page-plan',
      history: [{ role: 'user', text: 'hello' }],
    });
    // A first ask carries no repair of either kind.
    expect(call?.body.pagePlanAttempt).toBeUndefined();
    expect(call?.body.attempt).toBeUndefined();
  });

  it('sends the refused candidate and its issues as pagePlanAttempt on the one repair', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse({ version: 1, pagePlan: CANDIDATE }));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const issues = [{ path: 'tokens.muted', message: 'pick a darker muted' }];

    await provider.proposePagePlan('Build my page', context(), {
      attempt: { pagePlan: { title: 'first' }, issues },
    });

    expect(calls[0]?.body.pagePlanAttempt).toEqual({ pagePlan: { title: 'first' }, issues });
    // `attempt` is the COMMANDS plan's repair field; a page plan never rides in it.
    expect(calls[0]?.body.attempt).toBeUndefined();
  });

  it('narrates the SSE status frames and reads the result frame, as a plan does', async () => {
    const { fetchImpl } = fakeFetch(() =>
      sseResponse(
        [
          'event: status\ndata: {"text":"Choosing the palette"}\n\n',
          `event: result\ndata: ${JSON.stringify({ version: 1, pagePlan: CANDIDATE })}\n\n`,
        ].join(''),
      ),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const progress: string[] = [];

    const answer = await provider.proposePagePlan('Build my page', context(), {
      onProgress: (text) => progress.push(text),
    });

    expect(answer.pagePlan).toEqual(CANDIDATE);
    expect(answer.rationale).toBeUndefined();
    expect(progress).toEqual(['Choosing the palette']);
  });

  it('turns a refusal and an invalid-output report into the same errors a plan gets', async () => {
    const refused = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fakeFetch(() => jsonResponse({ version: 1, refusal: 'Not a page request.' }))
        .fetchImpl,
    });
    await expect(refused.proposePagePlan('x', context())).rejects.toMatchObject({
      code: 'refusal',
      retryable: false,
      message: 'Not a page request.',
    });

    const broken = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fakeFetch(() => jsonResponse({ version: 1, invalidOutput: { message: 'cut off' } }))
        .fetchImpl,
    });
    await expect(broken.proposePagePlan('x', context())).rejects.toMatchObject({
      code: 'invalid-output',
      retryable: true,
      message: 'cut off',
    });
  });

  it('reads an ordinary plan as a server that predates page plans — once, then never POSTs the task again', async () => {
    const { calls, fetchImpl } = fakeFetch(() =>
      jsonResponse({ rationale: 'Added a hero.', commands: [] }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    const first = await provider.proposePagePlan('Build my page', context()).catch(
      (error: unknown) => error,
    );
    expect(first).toBeInstanceOf(AiTaskUnsupportedError);
    expect(first).toMatchObject({ task: 'page-plan', code: 'invalid-output', retryable: false });
    expect((first as Error).message).toMatch(/does not support page plans/u);

    /*
      Such a server ignored `task` and ran a whole plan generation to answer:
      asking again would pay for that on every build. The second ask is
      refused without a POST; an ordinary proposal still goes out.
    */
    await expect(provider.proposePagePlan('Build my page', context())).rejects.toBeInstanceOf(
      AiTaskUnsupportedError,
    );
    expect(calls).toHaveLength(1);
    await provider.propose('Add a hero', context());
    expect(calls).toHaveLength(2);
    expect(calls[1]?.body.task).toBeUndefined();
  });

  it('rejects with the platform AbortError before posting when the caller already stopped', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse({ version: 1, pagePlan: CANDIDATE }));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(
      provider.proposePagePlan('Build my page', context(), { signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(0);
  });

  it('times out on the plan deadline, as a proposal does', async () => {
    const fetchImpl = (_input: string | URL | Request, init?: RequestInit): Promise<Response> =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fetchImpl,
      timeoutMs: 20,
    });

    await expect(provider.proposePagePlan('Build my page', context())).rejects.toMatchObject({
      code: 'timeout',
      retryable: true,
    });
  });
});
