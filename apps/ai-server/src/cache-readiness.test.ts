import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { createCacheDoctor } from './cache-doctor';
import { createCacheGate } from './cache-gate';
import { createCliClient, type CliChildProcess } from './cli-client';
import { proposePlan } from './claude';
import { createOpenRouterClient } from './openrouter-client';

const PLAN = { rationale: 'Placed the mural.', commands: [] };
const MESSAGE = {
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(PLAN) }],
  usage: { input_tokens: 1, output_tokens: 1 },
} as unknown as Anthropic.Message;
const WIRE = {
  version: 1,
  request: 'Create a mural',
  context: {
    fragments: [],
    blocks: [],
    totalTokens: 0,
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
    outputContract: { version: 1, schema: { type: 'object' } },
  },
} as unknown as AiPlanWireRequest;

function pendingBackend(maxWaitMs = 15_000) {
  const calls: {
    emit: (event: string) => void;
    resolve: () => void;
    reject: () => void;
  }[] = [];
  const client = {
    messages: {
      stream: () => {
        const listeners = new Map<string, () => void>();
        const done = new Promise<Anthropic.Message>((resolve, reject) => {
          calls.push({
            emit: (event) => listeners.get(event)?.(),
            resolve: () => {
              resolve(MESSAGE);
            },
            reject: () => {
              reject(new Error('Provider unavailable.'));
            },
          });
        });
        return {
          on: (event: string, listener: () => void) => listeners.set(event, listener),
          finalMessage: () => done,
        };
      },
    },
  } as unknown as Anthropic;
  const cacheGate = createCacheGate({ maxWaitMs });
  const cacheDoctor = createCacheDoctor({ apiDiagnosis: false });
  return { calls, run: () => proposePlan(WIRE, { client, cacheGate, cacheDoctor }) };
}

afterEach(() => vi.useRealTimers());

describe('cache staggering follows actual backend activity', () => {
  it.each(['streamEvent', 'text'])(
    'releases on %s even without progress/draft observers',
    async (event) => {
      vi.useFakeTimers();
      const backend = pendingBackend();
      const first = backend.run();
      const second = backend.run();
      await vi.advanceTimersByTimeAsync(0);
      expect(backend.calls).toHaveLength(1);
      backend.calls[0]?.emit('thinking');
      await vi.advanceTimersByTimeAsync(3_000);
      expect(backend.calls).toHaveLength(1);
      backend.calls[0]?.emit(event);
      await vi.advanceTimersByTimeAsync(0);
      expect(backend.calls).toHaveLength(2);
      const third = backend.run();
      await vi.advanceTimersByTimeAsync(0);
      expect(backend.calls).toHaveLength(3);
      backend.calls.forEach((call) => {
        call.resolve();
      });
      await Promise.all([first, second, third]);
    },
  );

  it('bounds waits when a backend has no observable stream activity', async () => {
    vi.useFakeTimers();
    const backend = pendingBackend(100);
    const first = backend.run();
    const second = backend.run();
    await vi.advanceTimersByTimeAsync(99);
    expect(backend.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(backend.calls).toHaveLength(2);
    backend.calls.forEach((call) => {
      call.resolve();
    });
    await Promise.all([first, second]);
  });

  it('releases a failed writer without claiming its prefix became warm', async () => {
    vi.useFakeTimers();
    const backend = pendingBackend();
    const first = backend.run();
    const failed = expect(first).rejects.toThrow('Provider unavailable.');
    const second = backend.run();
    await vi.advanceTimersByTimeAsync(0);
    backend.calls[0]?.emit('thinking');
    backend.calls[0]?.reject();
    await vi.advanceTimersByTimeAsync(0);
    await failed;
    expect(backend.calls).toHaveLength(2);
    backend.calls[1]?.resolve();
    await second;
    const next = backend.run();
    const sibling = backend.run();
    await vi.advanceTimersByTimeAsync(0);
    expect(backend.calls).toHaveLength(3);
    backend.calls[2]?.emit('text');
    await vi.advanceTimersByTimeAsync(0);
    expect(backend.calls).toHaveLength(4);
    backend.calls.slice(2).forEach((call) => {
      call.resolve();
    });
    await Promise.all([next, sibling]);
  });
});

class FakeChild extends EventEmitter {
  readonly pid = undefined;
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdin = new PassThrough();
  readonly kill = vi.fn();
}

describe('shim stream readiness', () => {
  it('CLI waiting and local init events never masquerade as model streaming', async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    const stream = createCliClient({
      spawnCli: () => child as unknown as CliChildProcess,
    }).messages.stream({ messages: [{ role: 'user', content: 'mural' }] } as never);
    const ready = vi.fn();
    const thinking = vi.fn();
    (stream as unknown as { on: (event: string, listener: () => void) => void }).on(
      'streamEvent',
      ready,
    );
    stream.on('thinking', thinking);
    child.stdout.write(JSON.stringify({ type: 'system', subtype: 'init' }) + '\n');
    await vi.advanceTimersByTimeAsync(3_000);
    expect(thinking).toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
    child.stdout.write(
      JSON.stringify({ type: 'stream_event', event: { type: 'message_start' } }) + '\n',
    );
    expect(ready).toHaveBeenCalledTimes(1);
    child.stdout.write(JSON.stringify({ type: 'result', is_error: false, result: '{}' }) + '\n');
    child.emit('close', 0, null);
    await stream.finalMessage();
  });

  it('OpenRouter waiting/heartbeats stay cold until model reasoning arrives', async () => {
    vi.useFakeTimers();
    let writer: ReadableStreamDefaultController<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        writer = controller;
      },
    });
    const stream = createOpenRouterClient({
      apiKey: 'test',
      model: 'test/model',
      fetch: () => Promise.resolve(new Response(body)),
    }).messages.stream({ messages: [{ role: 'user', content: 'mural' }] } as never);
    const ready = vi.fn();
    const thinking = vi.fn();
    (stream as unknown as { on: (event: string, listener: () => void) => void }).on(
      'streamEvent',
      ready,
    );
    stream.on('thinking', thinking);
    const write = (text: string) => writer?.enqueue(new TextEncoder().encode(text));
    write(': provider waiting\n\ndata: broken JSON\n\n');
    await vi.advanceTimersByTimeAsync(3_000);
    expect(thinking).toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
    write(
      'data: ' +
        JSON.stringify({ choices: [{ delta: { reasoning: 'Choosing a mural.' } }] }) +
        '\n\n',
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(ready).toHaveBeenCalledTimes(1);
    write(
      'data: ' +
        JSON.stringify({ choices: [{ delta: { content: '{}' }, finish_reason: 'stop' }] }) +
        '\n\ndata: [DONE]\n\n',
    );
    writer?.close();
    await stream.finalMessage();
  });
});
