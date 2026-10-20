import { describe, expect, it } from 'vitest';

import type { AiPlan, AiPlanValidationIssue, AssembledAiContext } from '../types';
import { createRemoteAiPlanProvider } from './remote-provider';
import { AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH, type AiPlanWireRequest } from './wire';

const ENDPOINT = 'https://assistant.example.test/plan';

function context(): AssembledAiContext {
  return {
    fragments: [
      {
        source: 'test:remote-provider',
        kind: 'data',
        trust: 'builtin',
        title: 'Blocks',
        body: 'hero — A hero.',
        tokens: 4,
      },
    ],
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
    selection: { ids: [] },
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
  it('observes validated actual usage once before a refused streamed result', async () => {
    const received: unknown[] = [];
    const usage = { inputTokens: 42, outputTokens: 9, cacheReadTokens: null, cacheWriteTokens: 0 };
    const { fetchImpl } = fakeFetch(
      () =>
        new Response(
          `event: usage\ndata: ${JSON.stringify(usage)}\n\nevent: usage\ndata: ${JSON.stringify(usage)}\n\nevent: result\ndata: {"refusal":"No."}\n\n`,
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    await expect(
      provider.propose('request', context(), { onUsage: (value) => received.push(value) }),
    ).rejects.toThrow('No.');
    expect(received).toEqual([{ ...usage, costUsd: null }]);
  });
  it('observes JSON usage metadata without changing the returned plan', async () => {
    const received: unknown[] = [];
    const { fetchImpl } = fakeFetch(
      () =>
        new Response(JSON.stringify(plan), {
          headers: {
            'content-type': 'application/json',
            'x-craftkit-ai-usage': JSON.stringify({ inputTokens: 17, outputTokens: 4 }),
          },
        }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    expect(
      await provider.propose('request', context(), { onUsage: (value) => received.push(value) }),
    ).toEqual(plan);
    expect(received).toEqual([
      {
        inputTokens: 17,
        outputTokens: 4,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        costUsd: null,
      },
    ]);
  });
  it('POSTs the request and assembled context, then returns the proposed plan', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(plan));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    const proposed = await provider.propose('add a hero', context());

    expect(proposed).toEqual(plan);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.input).toBe(ENDPOINT);
    expect(call?.init.method).toBe('POST');
    expect(call?.init.redirect).toBe('error');
    expect(call?.init.credentials).toBe('omit');
    expect(call?.init.referrerPolicy).toBe('no-referrer');
    expect(new Headers(call?.init.headers).get('content-type')).toBe('application/json');
    expect(call?.body).toMatchObject({
      version: 1,
      request: 'add a hero',
      context: { totalTokens: 4 },
    });
    expect(call?.body.attempt).toBeUndefined();
  });

  it('carries the run model choice (withModel) into the propose and repair bodies', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(plan));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const live = { model: 'haiku-edit', effort: 'low' } as Parameters<typeof provider.propose>[2];

    await provider.propose('add a hero', context(), live);
    await provider.repair('add a hero', context(), plan, [], live);
    await provider.propose('add a hero', context());

    expect(calls[0]?.body).toMatchObject({ model: 'haiku-edit', effort: 'low' });
    expect(calls[1]?.body).toMatchObject({ model: 'haiku-edit', effort: 'low' });
    expect(calls[2]?.body.model).toBeUndefined();
    expect(calls[2]?.body.effort).toBeUndefined();
  });

  it.each([
    'relative/plan',
    'http://assistant.example.test/plan',
    'ftp://assistant.example.test/plan',
  ])('rejects an endpoint outside the default HTTPS policy: %s', (endpoint) => {
    expect(() => createRemoteAiPlanProvider({ endpoint })).toThrow(/https/i);
  });

  it('allows an insecure HTTP endpoint only through the explicit development option', async () => {
    const endpoint = 'http://127.0.0.1:8787/plan';
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(plan));
    const provider = createRemoteAiPlanProvider({
      endpoint,
      allowInsecureHttp: true,
      fetch: fetchImpl,
    });

    await expect(provider.propose('add a hero', context())).resolves.toEqual(plan);
    expect(calls[0]?.input).toBe(endpoint);
  });

  it('refuses a redirected response even when an injected fetch ignores redirect:error', async () => {
    const redirected = jsonResponse(plan);
    Object.defineProperty(redirected, 'redirected', { value: true });
    const { fetchImpl } = fakeFetch(() => redirected);
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toMatchObject({
      code: 'endpoint-policy',
      retryable: false,
    });
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

    await expect(provider.propose('do the impossible', context())).rejects.toMatchObject({
      name: 'RemoteAiProviderError',
      message: 'I cannot plan that.',
      code: 'refusal',
      retryable: false,
    });
  });

  it('preserves a non-2xx explanation and status without inventing a plan', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse({ error: 'boom' }, 503));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toMatchObject({
      message: 'boom',
      code: 'http-status',
      retryable: true,
      status: 503,
    });
  });

  it('rejects a malformed response body instead of passing it downstream', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse({ rationale: 42 }));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(
      /not a plan or a refusal/,
    );
  });

  it('rejects an explicitly versioned response from a different wire version', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse({ ...plan, version: 2 }));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toMatchObject({
      code: 'invalid-output',
      retryable: true,
    });
  });

  it('classifies a versioned invalid-output response with its bounded server message', async () => {
    const message = 'The model returned prose instead of the plan object.';
    const { fetchImpl } = fakeFetch(() => jsonResponse({ version: 1, invalidOutput: { message } }));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toMatchObject({
      name: 'RemoteAiProviderError',
      message,
      code: 'invalid-output',
      retryable: true,
    });
  });

  it('limits an invalid-output message before exposing it to the host', async () => {
    const oversized = 'x'.repeat(AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH * 4);
    const { fetchImpl } = fakeFetch(() =>
      jsonResponse({ version: 1, invalidOutput: { message: oversized } }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toMatchObject({
      message: 'x'.repeat(AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH),
      code: 'invalid-output',
      retryable: true,
    });
  });

  it('cleans up the reader before surfacing a versioned invalid-output response', async () => {
    const encoded = new TextEncoder().encode(
      JSON.stringify({ version: 1, invalidOutput: { message: 'Invalid generated JSON.' } }),
    );
    let reads = 0;
    let cancelCalls = 0;
    let releaseCalls = 0;
    const reader = {
      read() {
        reads += 1;
        return Promise.resolve(
          reads === 1
            ? { done: false as const, value: encoded }
            : { done: true as const, value: undefined },
        );
      },
      cancel() {
        cancelCalls += 1;
        return Promise.resolve();
      },
      releaseLock() {
        releaseCalls += 1;
      },
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;
    const response = {
      ok: true,
      redirected: false,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: { getReader: () => reader },
    } as unknown as Response;
    const { fetchImpl } = fakeFetch(() => response);
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toMatchObject({
      message: 'Invalid generated JSON.',
      code: 'invalid-output',
    });
    expect(cancelCalls).toBe(1);
    expect(releaseCalls).toBe(1);
  });

  it('keeps versioned and unversioned plan/refusal responses compatible', async () => {
    const planResponses = [plan, { ...plan, version: 1 }];
    for (const response of planResponses) {
      const { fetchImpl } = fakeFetch(() => jsonResponse(response));
      const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
      await expect(provider.propose('add a hero', context())).resolves.toEqual(plan);
    }

    const refusalResponses = [
      { refusal: 'Not an edit request.' },
      { version: 1, refusal: 'Not an edit request.' },
    ];
    for (const response of refusalResponses) {
      const { fetchImpl } = fakeFetch(() => jsonResponse(response));
      const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
      await expect(provider.propose('hello', context())).rejects.toMatchObject({
        message: 'Not an edit request.',
        code: 'refusal',
      });
    }
  });

  it('rejects a non-JSON response body with a provider error', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('<html>gateway</html>', { status: 200 }));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(/not valid JSON/);
  });

  it('rejects an oversized Content-Length before reading and cancels its body', async () => {
    let cancelCalls = 0;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelCalls += 1;
      },
    });
    const oversized = new Response(body, {
      headers: {
        'content-length': '65',
        'content-type': 'application/json',
      },
    });
    const { fetchImpl } = fakeFetch(() => oversized);
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fetchImpl,
      maxResponseBytes: 64,
    });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(
      /maximum response size of 64 bytes/,
    );
    expect(cancelCalls).toBe(1);
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

  it('cancels the JSON reader when bounded decoding fails', async () => {
    let cancelCalls = 0;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(65));
      },
      cancel() {
        cancelCalls += 1;
      },
    });
    const { fetchImpl } = fakeFetch(
      () => new Response(stream, { headers: { 'content-type': 'application/json' } }),
    );
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fetchImpl,
      maxResponseBytes: 64,
    });

    await expect(provider.propose('add a hero', context())).rejects.toMatchObject({
      code: 'response-limit',
      retryable: false,
    });
    expect(cancelCalls).toBe(1);
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

    const pending = provider.propose('add a hero', context());
    await expect(pending).rejects.toThrow(/could not be reached: socket hangup/);
    await expect(pending).rejects.toMatchObject({
      code: 'network',
      retryable: true,
    });
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

    const pending = provider.propose('add a hero', context());
    await expect(pending).rejects.toThrow(/timed out after 5ms/);
    await expect(pending).rejects.toMatchObject({
      code: 'timeout',
      retryable: true,
    });
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

  it('isolates a throwing progress observer from the transport result', async () => {
    const stream = [
      'event: status\ndata: {"text":"Working"}\n\n',
      `event: result\ndata: ${JSON.stringify(plan)}\n\n`,
    ].join('');
    const { fetchImpl } = fakeFetch(
      () => new Response(stream, { headers: { 'content-type': 'text/event-stream' } }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(
      provider.propose('add a hero', context(), {
        onProgress: () => {
          throw new Error('host observer failed');
        },
      }),
    ).resolves.toEqual(plan);
  });

  it('cancels the SSE reader when frame handling fails', async () => {
    let cancelCalls = 0;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            [
              `event: result\ndata: ${JSON.stringify(plan)}\n\n`,
              `event: result\ndata: ${JSON.stringify(plan)}\n\n`,
            ].join(''),
          ),
        );
      },
      cancel() {
        cancelCalls += 1;
      },
    });
    const { fetchImpl } = fakeFetch(
      () => new Response(stream, { headers: { 'content-type': 'text/event-stream' } }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.propose('add a hero', context())).rejects.toThrow(
      /more than one result/i,
    );
    expect(cancelCalls).toBe(1);
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

    await expect(provider.propose('hello', context())).rejects.toMatchObject({
      name: 'RemoteAiProviderError',
      message: 'Not an edit request.',
      code: 'refusal',
      retryable: false,
    });
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
    let cancelCalls = 0;
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
    release?.(
      new Response(
        new ReadableStream<Uint8Array>({
          start(streamController) {
            streamController.enqueue(new TextEncoder().encode(JSON.stringify(plan)));
          },
          cancel() {
            cancelCalls += 1;
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelCalls).toBe(1);
  });

  it('cancels a late response when fetch ignores the provider deadline', async () => {
    let release: ((response: Response) => void) | undefined;
    let cancelCalls = 0;
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      timeoutMs: 1,
      fetch: () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    const pending = provider.propose('add a hero', context());
    await new Promise((resolve) => setTimeout(resolve, 5));
    release?.(
      new Response(
        new ReadableStream<Uint8Array>({
          cancel() {
            cancelCalls += 1;
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(pending).rejects.toMatchObject({ code: 'timeout', retryable: true });
    expect(cancelCalls).toBe(1);
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
