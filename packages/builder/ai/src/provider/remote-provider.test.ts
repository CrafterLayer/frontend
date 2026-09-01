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
      {
        type: 'hero',
        description: 'A hero.',
        propsSchema: { type: 'object' },
        examples: [],
        slots: [],
      },
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
    const { fetchImpl } = fakeFetch(() => new Response('<html>gateway</html>', { status: 200 }));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(/not valid JSON/);
  });

  it('rejects an oversized response from Content-Length before touching its body', async () => {
    let bodyAccesses = 0;
    const oversized = {
      ok: true,
      status: 200,
      headers: new Headers({
        'content-length': '65',
        'content-type': 'application/json',
      }),
      get body() {
        bodyAccesses += 1;
        throw new Error('The response body must not be touched.');
      },
    } as unknown as Response;
    const { fetchImpl } = fakeFetch(() => oversized);
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fetchImpl,
      maxResponseBytes: 64,
    });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(
      /maximum response size of 64 bytes/,
    );
    expect(bodyAccesses).toBe(0);
  });

  it('counts streamed JSON bytes and rejects a body that exceeds the configured maximum', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse(plan));
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fetchImpl,
      maxResponseBytes: 64,
    });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(
      /maximum response size of 64 bytes/,
    );
  });

  it('bounds SSE frames and total streamed bytes by the configured response maximum', async () => {
    const stream = `event: result\ndata: ${JSON.stringify({ ...plan, rationale: 'x'.repeat(128) })}\n\n`;
    const { fetchImpl } = fakeFetch(
      () => new Response(stream, { headers: { 'content-type': 'text/event-stream' } }),
    );
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fetchImpl,
      maxResponseBytes: 64,
    });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(
      /maximum response size of 64 bytes/,
    );
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

  it('advertises SSE alongside JSON so a streaming server can pick it', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(plan));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await provider.propose('add a hero', context());

    expect(new Headers(calls[0]?.init.headers).get('accept')).toBe(
      'text/event-stream, application/json',
    );
  });

  it('reads a streaming answer: status events reach onProgress, result becomes the plan', async () => {
    const stream = [
      'event: status\ndata: {"text":"Reading the catalog…"}\n\n',
      'event: status\ndata: {"text":"Drafted 2 commands…"}\n\n',
      `event: result\ndata: ${JSON.stringify(plan)}\n\n`,
    ].join('');
    const { fetchImpl } = fakeFetch(
      () => new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const progress: string[] = [];

    const proposed = await provider.propose('add a hero', context(), {
      onProgress: (text) => progress.push(text),
    });

    expect(proposed).toEqual(plan);
    expect(progress).toEqual(['Reading the catalog…', 'Drafted 2 commands…']);
  });

  it('accepts standard CRLF-delimited SSE frames', async () => {
    const stream = [
      'event: status\r\ndata: {"text":"Working"}\r\n\r\n',
      `event: result\r\ndata: ${JSON.stringify(plan)}\r\n\r\n`,
    ].join('');
    const { fetchImpl } = fakeFetch(
      () => new Response(stream, { headers: { 'content-type': 'text/event-stream' } }),
    );
    const progress: string[] = [];
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(
      provider.propose('add a hero', context(), {
        onProgress: (text) => progress.push(text),
      }),
    ).resolves.toEqual(plan);
    expect(progress).toEqual(['Working']);
  });

  it('fails closed when an SSE stream contains more than one result', async () => {
    const stream = [
      `event: result\ndata: ${JSON.stringify(plan)}\n\n`,
      `event: result\ndata: ${JSON.stringify({ ...plan, rationale: 'Override' })}\n\n`,
    ].join('');
    const { fetchImpl } = fakeFetch(
      () => new Response(stream, { headers: { 'content-type': 'text/event-stream' } }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(
      /more than one result/i,
    );
  });

  it('treats a streamed refusal result exactly like a JSON refusal', async () => {
    const stream = 'event: result\ndata: {"refusal":"Not an edit request."}\n\n';
    const { fetchImpl } = fakeFetch(
      () => new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('hello', context())).rejects.toThrow(
      new RemoteAiProviderError('Not an edit request.'),
    );
  });

  it('rejects a stream that ends without a result event', async () => {
    const stream = 'event: status\ndata: {"text":"thinking…"}\n\n';
    const { fetchImpl } = fakeFetch(
      () => new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(
      /ended without a result/,
    );
  });

  it('cancels through the caller signal and rethrows the abort, not a timeout error', async () => {
    const controller = new AbortController();
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    });

    const pending = provider.propose('add a hero', context(), { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not call fetch when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(plan));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(
      provider.propose('add a hero', context(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(0);
  });

  it('does not return a response when fetch ignores a mid-flight caller abort', async () => {
    let release: ((response: Response) => void) | undefined;
    let fetchCalls = 0;
    const controller = new AbortController();
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: () => {
        fetchCalls += 1;
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      },
    });

    const pending = provider.propose('add a hero', context(), { signal: controller.signal });
    expect(fetchCalls).toBe(1);
    controller.abort();
    release?.(jsonResponse(plan));

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
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

  it('sends the conversation history on the wire when the caller provides it', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(plan));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const history = [
      { role: 'user' as const, text: 'add a hero' },
      { role: 'assistant' as const, text: 'Added a hero titled Welcome.' },
    ];

    await provider.propose('make it blue', context(), { history });

    expect(calls[0]?.body.history).toEqual(history);
  });

  it('carries the plan followUp suggestion through the wire', async () => {
    const staged = { ...plan, followUp: 'كمل التنسيق والألوان' };
    const { fetchImpl } = fakeFetch(() => jsonResponse(staged));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    const proposed = await provider.propose('build a whole page', context());

    expect(proposed.followUp).toBe('كمل التنسيق والألوان');
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid maxResponseBytes %s', (maxResponseBytes) => {
    expect(() => createRemoteAiPlanProvider({ endpoint: ENDPOINT, maxResponseBytes })).toThrow(
      /maxResponseBytes/i,
    );
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid timeoutMs %s',
    (timeoutMs) => {
      expect(() => createRemoteAiPlanProvider({ endpoint: ENDPOINT, timeoutMs })).toThrow(
        /timeoutMs/i,
      );
    },
  );
});
