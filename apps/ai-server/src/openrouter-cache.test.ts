/**
 * The prompt cache through OpenRouter (2026-10-13). Ours to prove: on `anthropic/` slugs each
 * breakpoint keeps the request's own lifetime and the conversation breakpoint survives the
 * chat form; other vendors get no breakpoints (they cache by themselves); a refused extended
 * form is sent once more in the old one and given up only when the old one is accepted.
 */
import { describe, expect, it, vi } from 'vitest';

import { createOpenRouterClient, type OpenRouterFetch } from './openrouter-client';

const HOUR = { type: 'ephemeral', ttl: '1h' };

/** What `claude.ts` sends after prompt-cache.ts placed its breakpoints. */
const REQUEST = {
  max_tokens: 1_000,
  system: [
    { type: 'text', text: 'rules', cache_control: HOUR },
    { type: 'text', text: '# Block catalog\n[]', cache_control: HOUR },
    { type: 'text', text: '# Active skills\ndesign', cache_control: HOUR },
  ],
  messages: [
    { role: 'user', content: 'make a hero' },
    {
      role: 'assistant',
      content: [{ type: 'text', text: '{"rationale":"done"}', cache_control: HOUR }],
    },
    { role: 'user', content: 'now a footer' },
  ],
};

const ANSWER =
  `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: '{"rationale":"ok"}' }, finish_reason: 'stop' }] })}\n\n` +
  'data: [DONE]\n\n';

function answered(): Response {
  return new Response(ANSWER, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function refusal(message = 'cache_control: invalid'): Response {
  return new Response(JSON.stringify({ error: { code: 400, message } }), {
    status: 400,
  });
}

/** Answers each call in turn from `responses`, recording every body. */
function fetchSequence(...responses: (() => Response)[]) {
  const bodies: Record<string, unknown>[] = [];
  const fetch = vi.fn<OpenRouterFetch>((_url, init) => {
    if (typeof init.body !== 'string') throw new Error('expected a JSON string body');
    bodies.push(JSON.parse(init.body) as Record<string, unknown>);
    const next = responses[Math.min(bodies.length, responses.length) - 1] ?? answered;
    return Promise.resolve(next());
  });
  return { fetch, bodies };
}

type Chat = { role: string; content: unknown }[];

const messagesOf = (body: Record<string, unknown> | undefined) =>
  (body?.['messages'] ?? []) as Chat;

describe('the prompt cache through OpenRouter', () => {
  it('keeps the hour and the conversation breakpoint on Anthropic slugs', async () => {
    const { fetch, bodies } = fetchSequence(answered);
    const client = createOpenRouterClient({ apiKey: 'k', model: 'anthropic/claude-opus-5', fetch });
    await client.messages.stream(REQUEST as never).finalMessage();

    const [system, ...turns] = messagesOf(bodies[0]);
    expect(system?.content).toEqual([
      { type: 'text', text: 'rules', cache_control: HOUR },
      { type: 'text', text: '# Block catalog\n[]', cache_control: HOUR },
      { type: 'text', text: '# Active skills\ndesign', cache_control: HOUR },
    ]);
    expect(turns).toEqual([
      { role: 'user', content: 'make a hero' },
      {
        role: 'assistant',
        content: [{ type: 'text', text: '{"rationale":"done"}', cache_control: HOUR }],
      },
      { role: 'user', content: 'now a footer' },
    ]);
  });

  it('sends other vendors no breakpoints: they cache a stable prefix by themselves', async () => {
    const { fetch, bodies } = fetchSequence(refusal);
    const client = createOpenRouterClient({ apiKey: 'k', model: 'openai/gpt-model', fetch });
    await expect(client.messages.stream(REQUEST as never).finalMessage()).rejects.toThrow();

    expect(fetch).toHaveBeenCalledTimes(1); // nothing extended to fall back from
    expect(JSON.stringify(bodies[0])).not.toContain('cache_control');
    expect(messagesOf(bodies[0])[2]).toEqual({
      role: 'assistant',
      content: '{"rationale":"done"}',
    });
  });

  it('falls back to five-minute breakpoints when OpenRouter refuses the hour, for good', async () => {
    const logs: string[] = [];
    const { fetch, bodies } = fetchSequence(refusal, answered, answered);
    const client = createOpenRouterClient({
      apiKey: 'k',
      model: 'anthropic/claude-opus-5',
      fetch,
      onLog: (line) => logs.push(line),
    });
    await client.messages.stream(REQUEST as never).finalMessage();
    await client.messages.stream(REQUEST as never).finalMessage();

    expect(fetch).toHaveBeenCalledTimes(3);
    for (const body of bodies.slice(1)) {
      const [system, , history] = messagesOf(body);
      expect((system?.content as { cache_control?: unknown }[])[0]?.cache_control).toEqual({
        type: 'ephemeral',
      });
      expect(history).toEqual({ role: 'assistant', content: '{"rationale":"done"}' });
    }
    expect(logs.some((line) => line.includes('refused the hour-long cache form'))).toBe(true);
  });

  it('keeps the hour when the old form is refused too (the request was at fault)', async () => {
    const { fetch, bodies } = fetchSequence(refusal, refusal, answered);
    const client = createOpenRouterClient({ apiKey: 'k', model: 'anthropic/claude-opus-5', fetch });
    await expect(client.messages.stream(REQUEST as never).finalMessage()).rejects.toThrow();
    await client.messages.stream(REQUEST as never).finalMessage();

    expect(fetch).toHaveBeenCalledTimes(3);
    const [system] = messagesOf(bodies[2]);
    expect((system?.content as { cache_control?: unknown }[])[0]?.cache_control).toEqual(HOUR);
  });

  it.each([
    'reasoning.effort is not supported by this model',
    'max_tokens exceeds the model output limit',
    'response_format schema contains an invalid property ttl',
    'response_format schema contains an invalid property cache_control',
    'model not found',
  ])('does not retry an unrelated 400: %s', async (message) => {
    const { fetch, bodies } = fetchSequence(() => refusal(message), answered);
    const client = createOpenRouterClient({ apiKey: 'k', model: 'anthropic/claude-opus-5', fetch });
    await expect(client.messages.stream(REQUEST as never).finalMessage()).rejects.toThrow(message);
    expect(fetch).toHaveBeenCalledTimes(1);

    await client.messages.stream(REQUEST as never).finalMessage();
    const [system] = messagesOf(bodies[1]);
    expect((system?.content as { cache_control?: unknown }[])[0]?.cache_control).toEqual(HOUR);
  });

  it('retries a provider TTL refusal and retains the accepted shorter form', async () => {
    const { fetch, bodies } = fetchSequence(
      () => refusal('TTL 1h is not supported; use 5m'),
      answered,
      answered,
    );
    const client = createOpenRouterClient({ apiKey: 'k', model: 'anthropic/claude-opus-5', fetch });
    await client.messages.stream(REQUEST as never).finalMessage();
    await client.messages.stream(REQUEST as never).finalMessage();
    expect(fetch).toHaveBeenCalledTimes(3);
    const [system] = messagesOf(bodies[2]);
    expect((system?.content as { cache_control?: unknown }[])[0]?.cache_control).toEqual({
      type: 'ephemeral',
    });
  });
});
