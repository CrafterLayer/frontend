import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { CODEX_DEFAULT_MODEL, CodexBackendError } from './codex-config';
import { enhancerModelFor, routeOf } from './enhance-route';
import { CRAFTKIT_REASONING_EFFORT_HEADER } from './openrouter-client';
import { createRoutingClient, isCodexModel, isLocalModel } from './routing-client';

const ANSWER = {
  content: [{ type: 'text', text: '{"from":"codex"}' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 5 },
};
const PARAMS = {
  model: 'codex:gpt-fixture',
  max_tokens: 1_000,
  messages: [{ role: 'user', content: 'Generate a hero' }],
  output_config: { format: { schema: { type: 'object' } } },
};

function backend(outcome: { error?: Error; throwOnStart?: boolean; earlyStatus?: string } = {}) {
  const listeners = new Map<string, (delta: string) => void>();
  const stream = vi.fn((_params: Record<string, unknown>, _options?: unknown) => {
    if (outcome.throwOnStart === true) throw outcome.error ?? new Error('Failed to start');
    return {
      on: (event: string, listener: (delta: string) => void) => {
        listeners.set(event, listener);
        if (event === 'thinking' && outcome.earlyStatus !== undefined) {
          listener(outcome.earlyStatus);
        }
      },
      finalMessage: () =>
        outcome.error === undefined ? Promise.resolve(ANSWER) : Promise.reject(outcome.error),
    };
  });
  return {
    client: { messages: { stream } } as unknown as Anthropic,
    stream,
    emit: (event: string, text: string) => {
      listeners.get(event)?.(text);
    },
  };
}

function fixture(codex = backend(), configured = true) {
  const openrouter = backend();
  const api = backend();
  const claude = backend();
  const cli = vi.fn((_model: string | undefined) => claude.client);
  const onLog = vi.fn();
  const client = createRoutingClient({
    openrouter: openrouter.client,
    api: api.client,
    cli,
    ...(configured ? { codex: codex.client } : {}),
    fallback: 'cli:haiku',
    onLog,
  });
  const expectOnlyCodex = (): void => {
    expect(openrouter.stream).not.toHaveBeenCalled();
    expect(api.stream).not.toHaveBeenCalled();
    expect(cli).not.toHaveBeenCalled();
    expect(claude.stream).not.toHaveBeenCalled();
    expect(onLog).not.toHaveBeenCalled();
  };
  return { client, codex, expectOnlyCodex };
}

describe('Codex in the existing model picker', () => {
  it.each([
    { picked: 'codex:gpt-fixture', expected: 'gpt-fixture' },
    { picked: 'codex:', expected: CODEX_DEFAULT_MODEL },
  ])(
    'routes $picked to the shared Codex client with options intact',
    async ({ picked, expected }) => {
      const f = fixture();
      const params = { ...PARAMS, model: picked };
      const signal = new AbortController().signal;
      const headers = { [CRAFTKIT_REASONING_EFFORT_HEADER]: 'high' };
      const request = { signal, headers };
      const message = await f.client.messages.stream(params as never, request).finalMessage();

      expect(message).toBe(ANSWER);
      expect(f.codex.stream).toHaveBeenCalledExactlyOnceWith(
        { ...params, model: expected },
        request,
      );
      expect(f.codex.stream.mock.calls[0]?.[1]).toBe(request);
      expect(params.model).toBe(picked);
      f.expectOnlyCodex();
    },
  );

  it('uses the same Codex client across different selected models', async () => {
    const f = fixture();
    for (const model of ['codex:gpt-one', 'codex:gpt-two']) {
      await f.client.messages.stream({ ...PARAMS, model } as never).finalMessage();
    }
    expect(f.codex.stream.mock.calls.map(([params]) => params['model'])).toEqual([
      'gpt-one',
      'gpt-two',
    ]);
    f.expectOnlyCodex();
  });

  it('forwards buffered status, draft text and progress without a provider restart', async () => {
    const f = fixture(backend({ earlyStatus: 'Request accepted\n' }));
    const stream = f.client.messages.stream(PARAMS as never);
    const status = vi.fn();
    const text = vi.fn();
    const progress = vi.fn();
    const restart = vi.fn();
    stream.on('thinking', status);
    stream.on('text', text);
    stream.on('streamEvent', progress);
    (stream as unknown as { on: (event: string, listener: () => void) => void }).on(
      'restart',
      restart,
    );
    f.codex.emit('streamEvent', '');
    f.codex.emit('text', '{"from":"codex"}');
    await stream.finalMessage();

    expect(status).toHaveBeenCalledExactlyOnceWith('Request accepted\n');
    expect(text).toHaveBeenCalledExactlyOnceWith('{"from":"codex"}');
    expect(progress).toHaveBeenCalledExactlyOnceWith('');
    expect(restart).not.toHaveBeenCalled();
    f.expectOnlyCodex();
  });

  it.each([429, 502, 503])(
    'preserves Codex failures (%s) without falling back to Claude',
    async (status) => {
      const error = new CodexBackendError('Codex unavailable', status);
      const f = fixture(backend({ error }));
      await expect(f.client.messages.stream(PARAMS as never).finalMessage()).rejects.toBe(error);
      f.expectOnlyCodex();
    },
  );

  it('preserves cancellation and synchronous startup failure without fallback', async () => {
    const cancelled = new DOMException('Cancelled', 'AbortError');
    for (const throwOnStart of [false, true]) {
      const f = fixture(backend({ error: cancelled, throwOnStart }));
      const signal = AbortSignal.abort();
      await expect(
        f.client.messages.stream(PARAMS as never, { signal }).finalMessage(),
      ).rejects.toBe(cancelled);
      f.expectOnlyCodex();
    }
  });

  it('reports an unconfigured Codex route explicitly instead of sending it to another backend', async () => {
    const f = fixture(backend(), false);
    await expect(f.client.messages.stream(PARAMS as never).finalMessage()).rejects.toMatchObject({
      name: 'CodexBackendError',
      httpStatus: 503,
      retryable: false,
      message: 'The Codex route is not configured.',
    });
    expect(f.codex.stream).not.toHaveBeenCalled();
    f.expectOnlyCodex();
  });

  it('recognizes only the Codex prefix and includes it among local routes', () => {
    for (const model of ['codex:', 'codex:gpt-fixture']) {
      expect(isCodexModel(model)).toBe(true);
      expect(isLocalModel(model)).toBe(true);
      expect(routeOf(model)).toBe('codex');
    }
    for (const model of ['codex', 'provider/codex', 'prefix-codex:gpt-fixture']) {
      expect(isCodexModel(model)).toBe(false);
      expect(isLocalModel(model)).toBe(false);
    }
    expect(isLocalModel('cli:haiku')).toBe(true);
    expect(isLocalModel('api:claude-haiku-5-5')).toBe(true);
  });

  it('enhances a Codex selection on an allowed Codex model even when Claude is the cheaper default', () => {
    const options = {
      model: 'cli:haiku',
      enhanceModel: 'cli:haiku',
      models: ['codex:gpt-fixture-sol', 'codex:gpt-fixture-luna', 'api:claude-haiku-5-5'],
    };
    expect(enhancerModelFor(options, 'codex:gpt-fixture-sol')).toBe('codex:gpt-fixture-luna');
    expect(
      enhancerModelFor({ ...options, models: ['codex:gpt-fixture-sol'] }, 'codex:gpt-fixture-sol'),
    ).toBe('codex:gpt-fixture-sol');
    expect(enhancerModelFor(options, 'cli:haiku')).toBe('cli:haiku');
  });

  it('keeps a configured Codex enhancer when the selected model uses the same route', () => {
    const options = {
      model: 'cli:haiku',
      enhanceModel: 'codex:gpt-fixture-sol',
      models: ['codex:gpt-fixture-sol', 'codex:gpt-fixture-luna'],
    };
    expect(enhancerModelFor(options, 'codex:gpt-fixture-luna')).toBe('codex:gpt-fixture-sol');
  });
});
