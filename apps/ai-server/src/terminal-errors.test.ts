import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { createRemoteAiPlanProvider, type AssembledAiContext } from '@craftkit/builder/headless';

import { createHandler } from './handler';
import { createOpenRouterClient } from './openrouter-client';
import { readPagePlanMessage, readPlanMessage } from './plan-answer';

const ENDPOINT = 'https://assistant.example.test/plan';
const CONTEXT = {
  fragments: [],
  totalTokens: 0,
  blocks: [],
  document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
  selection: { ids: [] },
  outputContract: { version: 1, schema: { type: 'object' } },
} as unknown as AssembledAiContext;

function failingClient(cause: Error): Anthropic {
  return {
    messages: {
      stream: () => ({ on: () => undefined, finalMessage: () => Promise.reject(cause) }),
    },
  } as unknown as Anthropic;
}

function sdkFailure(kind: 'auth' | 'permission' | 'missing'): Anthropic {
  return failingClient(
    kind === 'auth'
      ? (Object.create(Anthropic.AuthenticationError.prototype) as Error)
      : kind === 'permission'
        ? (Object.create(Anthropic.PermissionDeniedError.prototype) as Error)
        : new Error('Could not resolve authentication method.'),
  );
}

function requestWithAccept(init: RequestInit | undefined, accept: string): Request {
  const headers = new Headers(init?.headers);
  headers.set('accept', accept);
  return new Request(ENDPOINT, { ...init, headers });
}

describe.each(['application/json', 'text/event-stream'])('terminal failures over %s', (accept) => {
  it.each(['auth', 'permission', 'missing', 401, 402] as const)(
    'keeps a terminal %s failure at its existing HTTP status with no retry',
    async (kind) => {
      const fetchMock = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { message: 'Provider configuration problem.' } }), {
            status: typeof kind === 'number' ? kind : 500,
          }),
        ),
      );
      const client =
        typeof kind === 'number'
          ? createOpenRouterClient({
              apiKey: 'test-only',
              model: 'example/model',
              fetch: fetchMock,
            })
          : sdkFailure(kind);
      const handle = createHandler({ client });
      const remote = createRemoteAiPlanProvider({
        endpoint: ENDPOINT,
        fetch: (_input, init) => handle(requestWithAccept(init, accept)),
      });

      await expect(remote.propose('Make a game', CONTEXT)).rejects.toMatchObject({
        status: kind === 'permission' ? 502 : 500,
        code: 'http-status',
        retryable: false,
      });
      if (typeof kind === 'number') expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it.each([429, 503])('keeps transient upstream %i failures retryable', async (status) => {
    const client = createOpenRouterClient({
      apiKey: 'test-only',
      model: 'example/model',
      fetch: () => Promise.resolve(new Response('{}', { status })),
    });
    const handle = createHandler({ client });
    const remote = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: (_input, init) => handle(requestWithAccept(init, accept)),
    });
    await expect(remote.propose('Make a game', CONTEXT)).rejects.toMatchObject({
      status: status === 429 ? 429 : 502,
      retryable: true,
    });
  });
});

it('preserves a pre-stream disallowed-model reason without contacting the provider', async () => {
  const stream = vi.fn();
  const handle = createHandler({
    client: { messages: { stream } } as unknown as Anthropic,
    model: 'allowed',
  });
  const remote = createRemoteAiPlanProvider({
    endpoint: ENDPOINT,
    headers: { 'x-craftkit-ai-model': 'unavailable' },
    fetch: (_input, init) => handle(new Request(ENDPOINT, init)),
  });
  await expect(remote.propose('Make a game', CONTEXT)).rejects.toMatchObject({
    message: 'Model "unavailable" is not one this server allows.',
    status: 400,
    retryable: false,
  });
  expect(stream).not.toHaveBeenCalled();
});

it.each(['plan', 'page-plan'])('records truncated %s output while refusing to apply it', (task) => {
  const onAnswer = vi.fn();
  const message = {
    stop_reason: 'max_tokens',
    content: [{ type: 'text', text: '{"partial":' }],
  } as Anthropic.Message;
  const outcome =
    task === 'plan'
      ? readPlanMessage(message, () => true, { onAnswer })
      : readPagePlanMessage(message, { onAnswer });
  expect(outcome.kind).toBe('invalid-output');
  expect(onAnswer).toHaveBeenCalledExactlyOnceWith('{"partial":');
});
