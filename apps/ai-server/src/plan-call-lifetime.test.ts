import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiBackend } from './api-models';
import { createHandler, type HandlerOptions } from './handler';
import { createRoutingClient } from './routing-client';

const PLAN = { rationale: 'Offline answer', commands: [] };
const MESSAGE = {
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(PLAN) }],
  usage: { input_tokens: 1, output_tokens: 1 },
} as unknown as Anthropic.Message;
let shape = 0;

function wire(extra: Record<string, unknown> = {}) {
  return {
    version: 1,
    request: 'Edit the custom mural',
    effort: 'medium',
    freeCode: true,
    context: {
      fragments: [],
      totalTokens: 0,
      blocks: [],
      document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
      selection: { ids: [] },
      commands: [],
      outputContract: { version: 1, schema: { type: 'object' } },
    },
    ...extra,
  };
}

function post(body: unknown, signal?: AbortSignal, streamed = false) {
  return new Request('http://localhost/plan', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(streamed ? { accept: 'text/event-stream' } : {}),
    },
    body: JSON.stringify(body),
    ...(signal === undefined ? {} : { signal }),
  });
}

function heldClient() {
  let resolve: (message: Anthropic.Message) => void = () => undefined;
  let reject: (cause: Error) => void = () => undefined;
  const pending = new Promise<Anthropic.Message>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  const listeners = new Map<string, (delta: string) => unknown>();
  const stream = vi.fn(
    (_params: Record<string, unknown>, _live: { signal: AbortSignal; maxRetries: number }) => ({
      on(event: string, listener: (delta: string) => unknown) {
        listeners.set(event, listener);
      },
      finalMessage: () => pending,
    }),
  );
  return {
    client: { messages: { stream } } as unknown as Anthropic,
    stream,
    resolve,
    reject,
    write: (text: string) => {
      listeners.get('text')?.(text);
    },
  };
}

function handleOn(client: Anthropic, options: Partial<HandlerOptions> = {}) {
  return createHandler({
    client,
    model: `offline-${String(++shape)}`,
    callTimeoutMs: 100,
    ...options,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('/plan complete call lifetime', () => {
  it.each([false, true])(
    'settles a non-cooperative provider (SSE=%s) and refuses late callbacks',
    async (streamed) => {
      vi.useFakeTimers();
      const live = heldClient();
      const onAnswer = vi.fn();
      const onLog = vi.fn();
      const onUsage = vi.fn();
      const pending = handleOn(live.client, { onAnswer, onLog, onUsage })(
        post(wire(), undefined, streamed),
      );
      await vi.advanceTimersByTimeAsync(0);
      const response = streamed ? await pending : undefined;
      const reading = response?.text();
      await vi.advanceTimersByTimeAsync(100);
      expect(live.stream.mock.calls[0]?.[1].signal.aborted).toBe(true);
      if (streamed) {
        const text = await reading;
        expect(text).toContain('event: error');
        expect(text).toContain('"status":504');
        expect(text?.match(/event: result/gu)).toHaveLength(1);
      } else {
        const result = await pending;
        expect(result.status).toBe(504);
        expect(await result.text()).toContain('server budget');
      }
      live.write('Late answer text');
      live.resolve(MESSAGE);
      await vi.advanceTimersByTimeAsync(0);
      expect(onAnswer).not.toHaveBeenCalled();
      expect(onLog).not.toHaveBeenCalled();
      expect(onUsage).not.toHaveBeenCalled();
    },
  );

  it('reports caller Stop as499 and settles a late rejection', async () => {
    vi.useFakeTimers();
    const live = heldClient();
    const caller = new AbortController();
    const pending = handleOn(live.client)(post(wire(), caller.signal));
    await vi.advanceTimersByTimeAsync(0);
    caller.abort();
    expect((await pending).status).toBe(499);
    live.reject(new Error('late provider rejection'));
    await vi.advanceTimersByTimeAsync(0);
    expect(live.stream.mock.calls[0]?.[1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the provider when a direct SSE reader abandons the response', async () => {
    vi.useFakeTimers();
    const live = heldClient();
    const response = await handleOn(live.client)(post(wire(), undefined, true));
    await vi.advanceTimersByTimeAsync(0);
    await response.body?.cancel();
    await vi.advanceTimersByTimeAsync(0);
    expect(live.stream.mock.calls[0]?.[1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    live.resolve(MESSAGE);
    await vi.advanceTimersByTimeAsync(0);
  });

  it('releases a cancelled cache pioneer so the next same-prefix call starts immediately', async () => {
    vi.useFakeTimers();
    const live = heldClient();
    const handle = handleOn(live.client);
    const first = handle(post(wire()));
    await vi.advanceTimersByTimeAsync(100);
    expect((await first).status).toBe(504);
    const next = handle(post(wire()));
    await vi.advanceTimersByTimeAsync(0);
    expect(live.stream).toHaveBeenCalledTimes(2);
    live.resolve(MESSAGE);
    await vi.advanceTimersByTimeAsync(0);
    expect((await next).status).toBe(200);
  });

  it('spends cache waiting inside the same call deadline without starting an expired request', async () => {
    vi.useFakeTimers();
    const live = heldClient();
    const handle = handleOn(live.client, { callTimeoutMs: 1_000 });
    const caller = new AbortController();
    const pioneer = handle(post(wire(), caller.signal));
    await vi.advanceTimersByTimeAsync(0);
    const follower = createHandler({
      client: live.client,
      model: `offline-${String(shape)}`,
      callTimeoutMs: 50,
    })(post(wire()));
    await vi.advanceTimersByTimeAsync(50);
    expect((await follower).status).toBe(504);
    expect(live.stream).toHaveBeenCalledTimes(1);
    caller.abort();
    expect((await pioneer).status).toBe(499);
    live.resolve(MESSAGE);
    await vi.advanceTimersByTimeAsync(0);
  });

  it('gives routing fallback only the remaining lifetime, with no budget reset', async () => {
    vi.useFakeTimers();
    const live = heldClient();
    const fallback = vi.fn(() => live.client);
    const primary = {
      messages: {
        stream: () => ({
          on: () => undefined,
          finalMessage: () =>
            new Promise((_resolve, reject) => {
              setTimeout(() => {
                const failure = Object.assign(new Error('Offline502'), {
                  name: 'OpenRouterBackendError',
                  httpStatus: 502,
                });
                reject(failure);
              }, 70);
            }),
        }),
      },
    } as unknown as Anthropic;
    const routed = createRoutingClient({
      openrouter: primary,
      cli: fallback,
      fallback: 'cli:haiku',
    });
    const pending = handleOn(routed)(post(wire()));
    await vi.advanceTimersByTimeAsync(70);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(live.stream.mock.calls[0]?.[1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(30);
    expect((await pending).status).toBe(504);
    expect(live.stream.mock.calls[0]?.[1].signal.aborted).toBe(true);
    live.resolve(MESSAGE);
    await vi.advanceTimersByTimeAsync(0);
  });

  it('keeps an explicit longer deadline and full deep/custom output settings', async () => {
    vi.useFakeTimers();
    const live = heldClient();
    const pending = handleOn(live.client, { callTimeoutMs: 500, maxTokens: 64_000 })(
      post(wire({ effort: 'max' })),
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(live.stream.mock.calls[0]?.[0]).toMatchObject({
      max_tokens: 64_000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'max' },
    });
    expect(live.stream.mock.calls[0]?.[1].signal.aborted).toBe(false);
    live.resolve(MESSAGE);
    await vi.advanceTimersByTimeAsync(0);
    expect((await pending).status).toBe(200);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never starts fallback when a non-cooperative primary fails after the call expired', async () => {
    vi.useFakeTimers();
    const live = heldClient();
    const fallback = vi.fn(() => live.client);
    const routed = createRoutingClient({
      openrouter: live.client,
      cli: fallback,
      fallback: 'cli:haiku',
    });
    const pending = handleOn(routed)(post(wire()));
    await vi.advanceTimersByTimeAsync(100);
    expect((await pending).status).toBe(504);
    live.reject(
      Object.assign(new Error('late offline502'), {
        name: 'OpenRouterBackendError',
        httpStatus: 502,
      }),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('bounds a real SDK SSE body that stalls after headers and message_start', async () => {
    vi.useFakeTimers();
    const api = createApiBackend(['api:claude-sonnet-4-5'], 'offline-test-key');
    if (api === undefined) throw new Error('Missing offline API client.');
    let sdkSignal: AbortSignal | null | undefined;
    const fetchMock = vi.fn((_url: unknown, init?: RequestInit) => {
      sdkSignal = init?.signal;
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'event: message_start\ndata: ' +
                    JSON.stringify({
                      type: 'message_start',
                      message: {
                        id: 'offline',
                        type: 'message',
                        role: 'assistant',
                        model: 'offline',
                        content: [],
                        stop_reason: null,
                        stop_sequence: null,
                        usage: { input_tokens: 1, output_tokens: 0 },
                      },
                    }) +
                    '\n\n',
                ),
              );
              sdkSignal?.addEventListener(
                'abort',
                () => {
                  controller.error(new DOMException('Stopped', 'AbortError'));
                },
                { once: true },
              );
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      );
    });
    const client = api.withOptions({ authToken: null, timeout: 5, fetch: fetchMock });
    const pending = createHandler({ client, model: 'claude-sonnet-4-5', callTimeoutMs: 40 })(
      post(wire(), undefined, true),
    );
    const response = await pending;
    const reading = response.text();
    await vi.advanceTimersByTimeAsync(39);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sdkSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await reading).toContain('"status":504');
    expect(sdkSignal?.aborted).toBe(true);
  });

  it('requests one SDK attempt on a generation failure while leaving batch-client defaults intact', async () => {
    vi.useFakeTimers();
    const api = createApiBackend(['api:claude-sonnet-4-5'], 'offline-test-key');
    if (api === undefined) throw new Error('Missing offline API client.');
    expect(api.maxRetries).toBe(2);
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            type: 'error',
            error: { type: 'overloaded_error', message: 'Offline failure' },
          }),
          { status: 503, headers: { 'content-type': 'application/json', 'retry-after': '0.001' } },
        ),
      ),
    );
    const client = api.withOptions({ authToken: null, fetch: fetchMock });
    const pending = createHandler({ client, model: 'claude-sonnet-4-5', callTimeoutMs: 1_000 })(
      post(wire()),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect((await pending).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(api.maxRetries).toBe(2);
  });
});
