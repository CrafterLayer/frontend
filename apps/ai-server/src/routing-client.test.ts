import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { CLI_MODEL_PREFIX, createRoutingClient, isCliModel } from './routing-client';

/**
 * The hybrid: one picker, two backends. A `cli:` slug is the person's own
 * Claude subscription through the local CLI; anything else is OpenRouter.
 * When a free OpenRouter model is overloaded the router may hand the same
 * request to the CLI, and it has to say so — silently switching who answered
 * would make the model picker a lie.
 */

interface FakeStream {
  readonly on: (event: string, listener: (delta: string) => void) => void;
  readonly finalMessage: () => Promise<unknown>;
}

function answer(text: string) {
  return {
    stop_reason: 'end_turn',
    stop_details: null,
    content: [{ type: 'text', text }],
    usage: {},
  };
}

/** A backend that records what it was asked and answers (or fails) as told. */
function backend(outcome: {
  readonly text?: string;
  readonly error?: Error;
  readonly narrate?: readonly string[];
}) {
  const calls: { params: Record<string, unknown>; options: unknown }[] = [];
  const client = {
    messages: {
      stream: vi.fn((params: Record<string, unknown>, options: unknown): FakeStream => {
        calls.push({ params, options });
        return {
          on: (event, listener) => {
            if (event === 'thinking') for (const line of outcome.narrate ?? []) listener(line);
          },
          finalMessage: () =>
            outcome.error === undefined
              ? Promise.resolve(answer(outcome.text ?? '{}'))
              : Promise.reject(outcome.error),
        };
      }),
    },
  } as unknown as Anthropic;
  return { client, calls };
}

function openRouterFailure(
  httpStatus: number,
  message = 'OpenRouter is rate limiting this key right now.',
): Error {
  const error = new Error(message) as Error & { httpStatus: number };
  error.name = 'OpenRouterBackendError';
  error.httpStatus = httpStatus;
  return error;
}

const PARAMS = { model: 'nvidia/nemotron-3-super-120b-a12b:free', max_tokens: 1000, messages: [] };

describe('cli slugs', () => {
  it('recognises the prefix and nothing else', () => {
    expect(CLI_MODEL_PREFIX).toBe('cli:');
    expect(isCliModel('cli:haiku')).toBe(true);
    expect(isCliModel('cli:')).toBe(true);
    expect(isCliModel('anthropic/claude-haiku-4.5')).toBe(false);
  });
});

describe('routing', () => {
  it('sends a cli: model to the CLI with the prefix stripped, and nothing to OpenRouter', async () => {
    const openrouter = backend({ text: '{"from":"openrouter"}' });
    const cliFactory = vi.fn(
      (_model: string | undefined) => backend({ text: '{"from":"cli"}' }).client,
    );
    const client = createRoutingClient({ openrouter: openrouter.client, cli: cliFactory });

    const message = (await client.messages
      .stream({ ...PARAMS, model: 'cli:haiku' } as never)
      .finalMessage()) as { content: { text: string }[] };

    expect(cliFactory).toHaveBeenCalledWith('haiku');
    expect(message.content[0]?.text).toBe('{"from":"cli"}');
    expect(openrouter.calls).toHaveLength(0);
  });

  it('leaves the CLI on its own default model for a bare cli: slug', async () => {
    const cliFactory = vi.fn((_model: string | undefined) => backend({ text: '{}' }).client);
    const client = createRoutingClient({ openrouter: backend({}).client, cli: cliFactory });

    await client.messages.stream({ ...PARAMS, model: 'cli:' } as never).finalMessage();

    expect(cliFactory).toHaveBeenCalledWith(undefined);
  });

  it('sends every other model to OpenRouter untouched, with the request options', async () => {
    const openrouter = backend({ text: '{"from":"openrouter"}' });
    const cliFactory = vi.fn((_model: string | undefined) => backend({}).client);
    const client = createRoutingClient({ openrouter: openrouter.client, cli: cliFactory });
    const signal = new AbortController().signal;

    await client.messages.stream(PARAMS as never, { signal }).finalMessage();

    expect(openrouter.calls[0]?.params).toEqual(PARAMS);
    expect((openrouter.calls[0]?.options as { signal: AbortSignal }).signal).toBe(signal);
    expect(cliFactory).not.toHaveBeenCalled();
  });

  it("forwards the answering backend's narration to the caller", async () => {
    const openrouter = backend({ text: '{}', narrate: ['Placing a hero first.\n'] });
    const client = createRoutingClient({
      openrouter: openrouter.client,
      cli: () => backend({}).client,
    });
    const seen: string[] = [];

    const stream = client.messages.stream(PARAMS as never);
    stream.on('thinking', (delta: string) => {
      seen.push(delta);
    });
    await stream.finalMessage();

    expect(seen).toEqual(['Placing a hero first.\n']);
  });
});

describe('fallback', () => {
  it('hands an overloaded free model’s request to the CLI, and says so in the narration and the log', async () => {
    const openrouter = backend({ error: openRouterFailure(429) });
    const cli = backend({ text: '{"from":"cli"}', narrate: ['Thinking (00:03)\n'] });
    const cliFactory = vi.fn((_model: string | undefined) => cli.client);
    const lines: string[] = [];
    const client = createRoutingClient({
      openrouter: openrouter.client,
      cli: cliFactory,
      fallback: 'cli:haiku',
      onLog: (line) => {
        lines.push(line);
      },
    });
    const seen: string[] = [];

    const stream = client.messages.stream(PARAMS as never);
    stream.on('thinking', (delta: string) => {
      seen.push(delta);
    });
    const message = (await stream.finalMessage()) as { content: { text: string }[] };

    expect(cliFactory).toHaveBeenCalledWith('haiku');
    expect(message.content[0]?.text).toBe('{"from":"cli"}');
    expect(seen.join('')).toMatch(/cli:haiku/u);
    expect(seen.join('')).toMatch(/Thinking \(00:03\)/u);
    expect(lines.join('\n')).toMatch(/falling back to cli:haiku/u);
    expect(lines.join('\n')).toMatch(/rate limiting/u);
  });

  it('also falls back when OpenRouter could not be reached or the stream broke (502)', async () => {
    const cliFactory = vi.fn((_model: string | undefined) => backend({ text: '{}' }).client);
    const client = createRoutingClient({
      openrouter: backend({ error: openRouterFailure(502, 'OpenRouter could not be reached.') })
        .client,
      cli: cliFactory,
      fallback: 'cli:',
    });

    await client.messages.stream(PARAMS as never).finalMessage();

    expect(cliFactory).toHaveBeenCalledWith(undefined);
  });

  it('does not fall back on a terminal failure: a bad slug or a bad key is for the owner to fix', async () => {
    const cliFactory = vi.fn((_model: string | undefined) => backend({ text: '{}' }).client);
    const client = createRoutingClient({
      openrouter: backend({
        error: openRouterFailure(400, 'OpenRouter rejected the request for model x.'),
      }).client,
      cli: cliFactory,
      fallback: 'cli:haiku',
    });

    await expect(client.messages.stream(PARAMS as never).finalMessage()).rejects.toThrow(
      /rejected the request/u,
    );
    expect(cliFactory).not.toHaveBeenCalled();
  });

  it('does not fall back without a fallback configured', async () => {
    const cliFactory = vi.fn((_model: string | undefined) => backend({ text: '{}' }).client);
    const client = createRoutingClient({
      openrouter: backend({ error: openRouterFailure(429) }).client,
      cli: cliFactory,
    });

    await expect(client.messages.stream(PARAMS as never).finalMessage()).rejects.toThrow(
      /rate limiting/u,
    );
    expect(cliFactory).not.toHaveBeenCalled();
  });

  it('does not fall back after the caller hung up', async () => {
    const controller = new AbortController();
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    const cliFactory = vi.fn((_model: string | undefined) => backend({ text: '{}' }).client);
    const client = createRoutingClient({
      openrouter: backend({ error: abort }).client,
      cli: cliFactory,
      fallback: 'cli:haiku',
    });
    controller.abort();

    await expect(
      client.messages.stream(PARAMS as never, { signal: controller.signal }).finalMessage(),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(cliFactory).not.toHaveBeenCalled();
  });
});

/*
  The answer's text as it is written (DESIGN §5.1, 2026-10-05). The router
  forwards `text` from whichever backend is answering; when it hands a call
  from OpenRouter to the CLI mid-stream, the text already written belongs to
  an abandoned answer, so it says `restart` before the fallback's first word.
*/
describe('text and restart', () => {
  /** `restart` is the router's own event, not one the SDK's types name. */
  function onRestart(stream: unknown, listener: () => void): void {
    (stream as { on: (event: 'restart', listener: () => void) => unknown }).on('restart', listener);
  }

  /** A backend that writes its text a tick after `on('text')`, as a real stream does. */
  function writing(outcome: { readonly text: readonly string[]; readonly error?: Error }) {
    return {
      messages: {
        stream: () => {
          let written: Promise<void> = Promise.resolve();
          return {
            on: (event: string, listener: (delta: string) => void) => {
              if (event !== 'text') return;
              written = (async () => {
                for (const delta of outcome.text) {
                  await Promise.resolve();
                  listener(delta);
                }
              })();
            },
            finalMessage: async () => {
              await written;
              if (outcome.error !== undefined) throw outcome.error;
              return answer(outcome.text.join(''));
            },
          };
        },
      },
    } as unknown as Anthropic;
  }

  it("forwards the answering backend's text", async () => {
    const client = createRoutingClient({
      openrouter: writing({ text: ['{"a"', ':1}'] }),
      cli: () => backend({}).client,
    });
    const seen: string[] = [];

    const stream = client.messages.stream(PARAMS as never);
    stream.on('text', (delta: string) => {
      seen.push(delta);
    });
    await stream.finalMessage();

    expect(seen).toEqual(['{"a"', ':1}']);
  });

  it('says restart before the fallback writes, after the failed model’s text', async () => {
    const client = createRoutingClient({
      openrouter: writing({ text: ['{"from":"open'], error: openRouterFailure(429) }),
      cli: () => writing({ text: ['{"from":', '"cli"}'] }),
      fallback: 'cli:haiku',
    });
    const seen: string[] = [];

    const stream = client.messages.stream(PARAMS as never);
    stream.on('text', (delta: string) => {
      seen.push(`text:${delta}`);
    });
    onRestart(stream, () => {
      seen.push('restart');
    });
    await stream.finalMessage();

    expect(seen).toEqual(['text:{"from":"open', 'restart', 'text:{"from":', 'text:"cli"}']);
  });

  it('never says restart when nothing fell back', async () => {
    const client = createRoutingClient({
      openrouter: writing({ text: ['{}'] }),
      cli: () => backend({}).client,
      fallback: 'cli:haiku',
    });
    const restart = vi.fn();

    const stream = client.messages.stream(PARAMS as never);
    onRestart(stream, restart);
    await stream.finalMessage();

    expect(restart).not.toHaveBeenCalled();
  });
});
