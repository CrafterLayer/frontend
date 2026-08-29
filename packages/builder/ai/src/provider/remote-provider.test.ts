import { describe, expect, it } from 'vitest';

import type { AiPlan, AiPlanValidationIssue, AssembledAiContext } from '../types';
import { RemoteAiProviderError, createRemoteAiPlanProvider } from './remote-provider';
import type { AiPlanWireRequest } from './wire';

const ENDPOINT = 'https://assistant.example.test/plan';

function context(): AssembledAiContext {
  return {
    fragments: [{ title: 'Blocks', body: 'hero — A hero.', tokens: 4 }],
    totalTokens: 4,
    blocks: [
      { type: 'hero', description: 'A hero.', propsSchema: { type: 'object' }, examples: [], slots: [] },
    ],
    document: { schemaVersion: 1, surface: 'landing', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [], nodes: [] },
  };
}

const plan: AiPlan = {
  rationale: 'Insert a hero.',
  commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
};

interface RecordedCall {
  input: string;
  init: RequestInit;
  body: AiPlanWireRequest;
}

/** A fetch double that records the wire request and answers from a script. */
function fakeFetch(respond: (call: RecordedCall) => Response | Promise<Response>) {
  const calls: RecordedCall[] = [];
  const fetchImpl = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (typeof input !== 'string' || typeof init?.body !== 'string') {
      throw new Error('The provider must POST a JSON string to a string endpoint.');
    }
    const call: RecordedCall = {
      input,
      init,
      body: JSON.parse(init.body) as AiPlanWireRequest,
    };
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

describe('createRemoteAiPlanProvider', () => {
  it('POSTs the request and assembled context, then returns the proposed plan', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(plan));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    const proposed = await provider.propose('add a hero', context());

    expect(proposed).toEqual(plan);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.input).toBe(ENDPOINT);
    expect(call?.init.method).toBe('POST');
    expect(new Headers(call?.init.headers).get('content-type')).toBe('application/json');
    expect(call?.body).toMatchObject({
      version: 1,
      request: 'add a hero',
      context: { totalTokens: 4 },
    });
    expect(call?.body.attempt).toBeUndefined();
  });

  it('sends configured headers with every request', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(plan));
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      headers: { authorization: 'Bearer sesame' },
      fetch: fetchImpl,
    });

    await provider.propose('add a hero', context());

    expect(new Headers(calls[0]?.init.headers).get('authorization')).toBe('Bearer sesame');
  });

  it('surfaces an explicit server refusal as a provider error with the server message', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse({ refusal: 'I cannot plan that.' }));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('do the impossible', context())).rejects.toThrow(
      new RemoteAiProviderError('I cannot plan that.'),
    );
  });

  it('reports a non-2xx response by status without inventing a plan', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse({ error: 'boom' }, 503));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(
      /The assistant server answered with status 503\./,
    );
  });

  it('rejects a malformed response body instead of passing it downstream', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse({ rationale: 42 }));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(
      /not a plan or a refusal/,
    );
  });

  it('rejects a non-JSON response body with a provider error', async () => {
    const { fetchImpl } = fakeFetch(
      () => new Response('<html>gateway</html>', { status: 200 }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(/not valid JSON/);
  });

  it('wraps a network failure in a provider error', async () => {
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: () => Promise.reject(new TypeError('socket hangup')),
    });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(
      /could not be reached: socket hangup/,
    );
  });

  it('aborts a request that outlives timeoutMs', async () => {
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      timeoutMs: 5,
      fetch: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(/timed out after 5ms/);
  });

  it('repairs by resending the failed plan and its issues under attempt', async () => {
    const repaired: AiPlan = {
      rationale: 'Insert a hero at the root.',
      commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
    };
    const { calls, fetchImpl } = fakeFetch((call) =>
      jsonResponse(call.body.attempt === undefined ? plan : repaired),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const issues: readonly AiPlanValidationIssue[] = [
      { code: 'door-rejected', message: 'Step 0 was rejected by the kernel door.', step: 0 },
    ];

    const secondTry = await provider.repair('add a hero', context(), plan, issues);

    expect(secondTry).toEqual(repaired);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body.attempt).toEqual({ plan, issues });
  });
});
