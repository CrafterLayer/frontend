import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createOpenRouterClient,
  probeOpenRouterModels,
  type OpenRouterFetch,
  type OpenRouterModelFacts,
} from './openrouter-client';

/**
 * The OpenRouter backend, tested without a network.
 *
 * Two things are verified. The REQUEST: the exact prompt `claude.ts` builds —
 * system blocks with their cache breakpoints, the turns, the output schema —
 * has to reach OpenRouter in the chat-completions shape, with nothing
 * Anthropic-specific leaking through. And the ANSWER: every way a stream can
 * end has to become the `Anthropic.Message` shape `claude.ts` already knows
 * how to translate, or an error whose message names the cause.
 */

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rationale'],
  properties: { rationale: { type: 'string' } },
};

/** Exactly what `claude.ts` hands to `client.messages.stream`: the model is the one the handler resolved. */
const REQUEST = {
  model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  max_tokens: 32_000,
  thinking: { type: 'adaptive', display: 'summarized' },
  system: [
    { type: 'text', text: 'rules' },
    { type: 'text', text: 'catalog', cache_control: { type: 'ephemeral' } },
  ],
  messages: [
    { role: 'user', content: 'make a hero' },
    { role: 'assistant', content: '{"rationale":"done"}' },
    { role: 'user', content: 'now a footer' },
  ],
  output_config: { format: { type: 'json_schema', schema: SCHEMA } },
};

/** A body that arrives in `pieces` reads, so line buffering is exercised. */
function bodyOf(text: string, pieces: number): ReadableStream<Uint8Array> {
  const size = Math.max(1, Math.ceil(text.length / pieces));
  const encoder = new TextEncoder();
  let at = 0;
  return new ReadableStream({
    pull(controller) {
      if (at >= text.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(text.slice(at, at + size)));
      at += size;
    },
  });
}

function streamResponse(text: string, pieces = 1): Response {
  return new Response(bodyOf(text, pieces), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function chunk(
  delta: Record<string, unknown>,
  extra: Record<string, unknown> = {},
  finish: string | null = null,
): string {
  const frame = {
    id: 'gen-1',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta, finish_reason: finish }],
    ...extra,
  };
  return `data: ${JSON.stringify(frame)}\n\n`;
}

const HEARTBEAT = ': OPENROUTER PROCESSING\n\n';
const DONE = 'data: [DONE]\n\n';

function fetchAnswering(answer: Response | (() => Response | Promise<Response>)) {
  return vi.fn<OpenRouterFetch>(() =>
    Promise.resolve(typeof answer === 'function' ? answer() : answer),
  );
}

function sentBody(fetch: ReturnType<typeof fetchAnswering>): Record<string, unknown> {
  const body = fetch.mock.calls[0]?.[1]?.body;
  if (typeof body !== 'string') throw new Error('expected a JSON string body');
  return JSON.parse(body) as Record<string, unknown>;
}

function planStream(): string {
  return (
    HEARTBEAT +
    chunk({ role: 'assistant', content: '{"ratio' }) +
    chunk({ content: 'nale":"ok"}' }, {}, 'stop') +
    HEARTBEAT +
    chunk(
      { content: '' },
      {
        usage: {
          prompt_tokens: 1_200,
          completion_tokens: 40,
          cost: 0.004,
          prompt_tokens_details: { cached_tokens: 1_000, cache_write_tokens: 100 },
        },
      },
      'stop',
    ) +
    DONE
  );
}

describe('openrouter request', () => {
  it('posts to chat completions with the bearer key, streaming, and usage accounting', async () => {
    const fetch = fetchAnswering(() => streamResponse(planStream()));
    const client = createOpenRouterClient({
      apiKey: 'sk-or-test',
      model: 'anthropic/claude-sonnet-4.5',
      fetch,
    });

    await client.messages.stream(REQUEST as never).finalMessage();

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer sk-or-test');
    const body = sentBody(fetch);
    // The handler resolved this request's model (a per-request choice); it wins over the configured default.
    expect(body['model']).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
    expect(body['stream']).toBe(true);
    expect(body['usage']).toEqual({ include: true });
    expect(body['max_tokens']).toBe(32_000);
    expect(body).not.toHaveProperty('thinking');
    expect(body).not.toHaveProperty('output_config');
  });

  it('logs the model this request actually ran on, not the configured default', async () => {
    const lines: string[] = [];
    const fetch = fetchAnswering(() => streamResponse(planStream()));
    const client = createOpenRouterClient({
      apiKey: 'k',
      model: 'minimax/minimax-m3:free',
      fetch,
      onLog: (line) => {
        lines.push(line);
      },
    });

    await client.messages.stream(REQUEST as never).finalMessage();

    expect(lines[0]).toContain('nvidia/nemotron-3-ultra-550b-a55b:free');
    expect(lines[0]).not.toContain('minimax');
  });

  it('falls back to the configured model when the request names none', async () => {
    const fetch = fetchAnswering(() => streamResponse(planStream()));
    const client = createOpenRouterClient({ apiKey: 'k', model: 'minimax/minimax-m3:free', fetch });
    const withoutModel = Object.fromEntries(
      Object.entries(REQUEST).filter(([key]) => key !== 'model'),
    );

    await client.messages.stream(withoutModel as never).finalMessage();

    expect(sentBody(fetch)['model']).toBe('minimax/minimax-m3:free');
  });

  it('keeps the system blocks, their cache breakpoints, and the turns in chat form', async () => {
    const fetch = fetchAnswering(() => streamResponse(planStream()));
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    await client.messages
      .stream({ ...REQUEST, model: 'anthropic/claude-sonnet-5' } as never)
      .finalMessage();

    const messages = sentBody(fetch)['messages'] as {
      role: string;
      content: string | { type: string; text: string; cache_control?: unknown }[];
    }[];
    expect(messages[0]?.role).toBe('system');
    const system = messages[0]?.content as {
      type: string;
      text: string;
      cache_control?: unknown;
    }[];
    expect(system.slice(0, 2)).toEqual([
      { type: 'text', text: 'rules' },
      { type: 'text', text: 'catalog', cache_control: { type: 'ephemeral' } },
    ]);
    expect(messages.slice(1)).toEqual([
      { role: 'user', content: 'make a hero' },
      { role: 'assistant', content: '{"rationale":"done"}' },
      { role: 'user', content: 'now a footer' },
    ]);
  });

  /*
    The schema ALWAYS travels as text, after the cache breakpoint where it
    cannot invalidate the cached catalog — the prompt never spells the shape
    out. `response_format` is sent only where constrained decoding is proven:
    a provider's guided decoding once turned every name in a plan into a
    single letter (`"command":"w"`, `"rationale":"س"`), the shortest string
    the schema's `minLength: 1` admits.
  */
  it('repeats the schema as text after the cache breakpoint, and sends no response_format for an unproven model', async () => {
    const fetch = fetchAnswering(() => streamResponse(planStream()));
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    await client.messages.stream(REQUEST as never).finalMessage();

    const body = sentBody(fetch);
    expect(body).not.toHaveProperty('response_format');
    const system = (body['messages'] as { content: { text: string }[] }[])[0]?.content ?? [];
    expect(system.at(-1)?.text).toContain(JSON.stringify(SCHEMA));
  });

  it('sends configured or per-role reasoning effort and strict response_format when forced', async () => {
    const plain = fetchAnswering(() => streamResponse(planStream()));
    await createOpenRouterClient({ apiKey: 'k', model: 'm', fetch: plain })
      .messages.stream(REQUEST as never)
      .finalMessage();
    expect(sentBody(plain)).not.toHaveProperty('reasoning');

    const tuned = fetchAnswering(() => streamResponse(planStream()));
    await createOpenRouterClient({
      apiKey: 'k',
      model: 'm',
      fetch: tuned,
      strict: true,
      effort: 'medium',
    })
      .messages.stream(REQUEST as never)
      .finalMessage();
    const body = sentBody(tuned);
    expect(body['reasoning']).toEqual({ effort: 'medium' });
    expect(body['response_format']).toEqual({
      type: 'json_schema',
      json_schema: { name: 'craftkit_plan', strict: true, schema: SCHEMA },
    });

    const routed = fetchAnswering(() => streamResponse(planStream()));
    await createOpenRouterClient({ apiKey: 'k', model: 'm', fetch: routed, effort: 'high' })
      .messages.stream(REQUEST as never, {
        headers: { 'x-craftkit-internal-reasoning-effort': 'low' },
      })
      .finalMessage();
    expect(sentBody(routed)['reasoning']).toEqual({ effort: 'low' });
  });

  /*
    `claude.ts` asks for a section's budget the Messages API way,
    `output_config.effort`. `max` is the top of that scale and has no
    OpenRouter name, so it asks for OpenRouter's top rather than silently
    falling back to the backend default — the opposite of what was asked.
  */
  it('reads the budget claude.ts puts in output_config, and asks for xhigh when it says max', async () => {
    const sectioned = fetchAnswering(() => streamResponse(planStream()));
    await createOpenRouterClient({ apiKey: 'k', model: 'm', fetch: sectioned, effort: 'high' })
      .messages.stream({
        ...REQUEST,
        output_config: { ...REQUEST.output_config, effort: 'low' },
      } as never)
      .finalMessage();
    expect(sentBody(sectioned)['reasoning']).toEqual({ effort: 'low' });

    for (const requestOptions of [
      { headers: { 'x-craftkit-internal-reasoning-effort': 'max' } },
      undefined,
    ]) {
      const highest = fetchAnswering(() => streamResponse(planStream()));
      const params =
        requestOptions === undefined
          ? { ...REQUEST, output_config: { ...REQUEST.output_config, effort: 'max' } }
          : REQUEST;
      await createOpenRouterClient({ apiKey: 'k', model: 'm', fetch: highest, effort: 'low' })
        .messages.stream(params as never, requestOptions)
        .finalMessage();
      expect(sentBody(highest)['reasoning']).toEqual({ effort: 'xhigh' });
    }
  });

  it('keeps GPT prefixes stable without sending an Anthropic-only cache TTL', async () => {
    const fetch = fetchAnswering(() => streamResponse(planStream()));
    await createOpenRouterClient({ apiKey: 'k', model: 'openai/gpt-model', fetch })
      .messages.stream(REQUEST as never)
      .finalMessage();

    const system = (sentBody(fetch)['messages'] as { content: Record<string, unknown>[] }[])[0]
      ?.content;
    expect(system?.some((block) => 'cache_control' in block)).toBe(false);
  });
});

/*
  What OpenRouter lists changes by the day — a free slug was withdrawn the
  evening this shipped — so the server asks at startup what each configured
  model IS: listed at all, able to decode straight into the schema, and how
  much it may write. The answers decide strictness and the token ceiling per
  request, and a slug OpenRouter no longer lists is named before the first
  request fails on it.
*/
describe('openrouter model facts', () => {
  const LISTING = {
    data: [
      {
        id: 'anthropic/claude-sonnet-5',
        supported_parameters: ['response_format', 'structured_outputs', 'reasoning', 'tools'],
        architecture: { input_modalities: ['text', 'image'] },
        top_provider: { max_completion_tokens: 128_000 },
        pricing: { prompt: '0.000002', completion: '0.00001' },
      },
      {
        id: 'some/small-model:free',
        supported_parameters: ['reasoning'],
        top_provider: { max_completion_tokens: 8_192 },
        pricing: { prompt: '0', completion: '0' },
      },
    ],
  };

  it('reports whether each slug is listed, decodes into a schema, and how much it may write', async () => {
    const fetch = vi.fn<OpenRouterFetch>(() =>
      Promise.resolve(new Response(JSON.stringify(LISTING))),
    );

    const facts = await probeOpenRouterModels(
      ['anthropic/claude-sonnet-5', 'some/small-model:free', 'gone/model:free'],
      { fetch },
    );

    expect(String(fetch.mock.calls[0]?.[0])).toBe('https://openrouter.ai/api/v1/models');
    expect(facts.get('anthropic/claude-sonnet-5')).toEqual({
      listed: true,
      structuredOutputs: true,
      supportedParameters: ['response_format', 'structured_outputs', 'reasoning', 'tools'],
      inputModalities: ['text', 'image'],
      maxOutputTokens: 128_000,
      promptPerMillion: 2,
      completionPerMillion: 10,
    });
    expect(facts.get('some/small-model:free')).toMatchObject({
      listed: true,
      structuredOutputs: false,
      supportedParameters: ['reasoning'],
      inputModalities: [],
      maxOutputTokens: 8_192,
    });
    expect(facts.get('gone/model:free')).toMatchObject({ listed: false, structuredOutputs: false });
  });

  it('answers nothing rather than failing startup when the listing cannot be fetched', async () => {
    const fetch = vi.fn<OpenRouterFetch>(() => Promise.reject(new TypeError('fetch failed')));

    const facts = await probeOpenRouterModels(['anthropic/claude-sonnet-5'], { fetch });

    expect(facts.size).toBe(0);
  });

  function factsFor(
    slug: string,
    facts: Partial<OpenRouterModelFacts>,
  ): ReadonlyMap<string, OpenRouterModelFacts> {
    return new Map([
      [
        slug,
        {
          listed: true,
          structuredOutputs: false,
          supportedParameters: [],
          inputModalities: [],
          maxOutputTokens: undefined,
          ...facts,
        },
      ],
    ]);
  }

  it('constrains decoding only for an Anthropic or OpenAI model that supports it, unless told otherwise', async () => {
    const anthropic = 'anthropic/claude-sonnet-5';
    const auto = fetchAnswering(() => streamResponse(planStream()));
    await createOpenRouterClient({
      apiKey: 'k',
      model: 'm',
      fetch: auto,
      models: factsFor(anthropic, { structuredOutputs: true }),
    })
      .messages.stream({ ...REQUEST, model: anthropic } as never)
      .finalMessage();
    expect(
      (sentBody(auto)['response_format'] as { json_schema: { strict: boolean } }).json_schema
        .strict,
    ).toBe(true);

    /* NVIDIA's guided decoding is where the single-letter plans came from, so its flag is not trusted. */
    const nvidia = 'nvidia/nemotron-3-ultra-550b-a55b:free';
    const untrusted = fetchAnswering(() => streamResponse(planStream()));
    await createOpenRouterClient({
      apiKey: 'k',
      model: 'm',
      fetch: untrusted,
      models: factsFor(nvidia, { structuredOutputs: true }),
    })
      .messages.stream({ ...REQUEST, model: nvidia } as never)
      .finalMessage();
    expect(sentBody(untrusted)).not.toHaveProperty('response_format');

    const forcedOff = fetchAnswering(() => streamResponse(planStream()));
    await createOpenRouterClient({
      apiKey: 'k',
      model: 'm',
      fetch: forcedOff,
      strict: false,
      models: factsFor(anthropic, { structuredOutputs: true }),
    })
      .messages.stream({ ...REQUEST, model: anthropic } as never)
      .finalMessage();
    expect(sentBody(forcedOff)).not.toHaveProperty('response_format');
  });

  it('never asks a model for more output than OpenRouter says it can write', async () => {
    const slug = 'nvidia/nemotron-3-ultra-550b-a55b:free';
    const fetch = fetchAnswering(() => streamResponse(planStream()));
    await createOpenRouterClient({
      apiKey: 'k',
      model: 'm',
      fetch,
      models: factsFor(slug, { maxOutputTokens: 8_192 }),
    })
      .messages.stream(REQUEST as never)
      .finalMessage();

    expect(sentBody(fetch)['max_tokens']).toBe(8_192);
  });
});

describe('openrouter answer', () => {
  /* A trailing comma is the commonest way a model breaks otherwise-sound JSON. */
  it('salvages a plan whose only fault is trailing commas', async () => {
    const fetch = fetchAnswering(() =>
      streamResponse(
        chunk(
          { content: '{"rationale":"ok","commands":[{"command":"x","args":{"a":[1,2,],},},],}' },
          {},
          'stop',
        ) + DONE,
      ),
    );
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    const message = await client.messages.stream(REQUEST as never).finalMessage();

    const text = (message.content[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual({
      rationale: 'ok',
      commands: [{ command: 'x', args: { a: [1, 2] } }],
    });
  });

  it('assembles the plan from content deltas split across reads, ignoring heartbeats', async () => {
    const fetch = fetchAnswering(() => streamResponse(planStream(), 17));
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    const message = await client.messages.stream(REQUEST as never).finalMessage();

    expect(message.stop_reason).toBe('end_turn');
    expect(message.content).toEqual([{ type: 'text', text: '{"rationale":"ok"}' }]);
  });

  /*
    OpenRouter's `prompt_tokens` INCLUDES the cached tokens; Anthropic's
    `input_tokens` excludes them. The handler's `cachedShare` — the number that
    reveals a broken cache prefix — is computed the Anthropic way, so the
    translation has to subtract, or every OpenRouter run would under-report.
  */
  it('reports usage the way the SDK does, so the cached share stays comparable', async () => {
    const fetch = fetchAnswering(() => streamResponse(planStream()));
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    const message = await client.messages.stream(REQUEST as never).finalMessage();

    expect(message.usage).toMatchObject({
      input_tokens: 100,
      output_tokens: 40,
      cache_read_input_tokens: 1_000,
      cache_creation_input_tokens: 100,
      cost_usd: 0.004,
    });
  });

  /*
    Models that ignore `response_format` wrap the JSON in a fence or a sentence.
    `claude.ts` parses the text as-is, so the wrapper is undone here — the
    plan's own content still decides whether it is valid.
  */
  it('unwraps a plan the model fenced as ```json', async () => {
    const fetch = fetchAnswering(() =>
      streamResponse(
        chunk({ content: '```json\n{"rationale":' }) +
          chunk({ content: '"ok","commands":[]}\n```' }, {}, 'stop') +
          DONE,
      ),
    );
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    const message = await client.messages.stream(REQUEST as never).finalMessage();

    expect(message.content).toEqual([{ type: 'text', text: '{"rationale":"ok","commands":[]}' }]);
  });

  it('keeps only the JSON object when the model talks around it', async () => {
    const fetch = fetchAnswering(() =>
      streamResponse(
        chunk(
          {
            content:
              'Here is the plan you asked for:\n\n{"rationale":"ok","commands":[{"command":"x","args":{"t":"}"}}]}\n\nLet me know!',
          },
          {},
          'stop',
        ) + DONE,
      ),
    );
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    const message = await client.messages.stream(REQUEST as never).finalMessage();

    expect(message.content).toEqual([
      { type: 'text', text: '{"rationale":"ok","commands":[{"command":"x","args":{"t":"}"}}]}' },
    ]);
  });

  /* Some providers leave a reasoning model's <think> block inside the content itself. */
  it('drops a <think> block a provider left inside the content before finding the plan', async () => {
    const fetch = fetchAnswering(() =>
      streamResponse(
        chunk(
          { content: '<think>\nMaybe {"draft": 1}?\n</think>\n\n{"rationale":"ok","commands":[]}' },
          {},
          'stop',
        ) + DONE,
      ),
    );
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    const message = await client.messages.stream(REQUEST as never).finalMessage();

    expect(message.content).toEqual([{ type: 'text', text: '{"rationale":"ok","commands":[]}' }]);
  });

  /*
    "The assistant answer was not valid JSON" is the panel's whole report; the
    owner's terminal has to say more — what the answer started and ended with,
    and how the stream finished — or a free model's habit stays a mystery.
  */
  it('logs the head and tail of an answer that is not JSON, and how the stream ended', async () => {
    const lines: string[] = [];
    const fetch = fetchAnswering(() =>
      streamResponse(
        chunk(
          {
            content:
              'Sure! Here is the plan: {"rationale":"ok","commands":[{"command":"insertNode"',
          },
          {},
          'stop',
        ) + DONE,
      ),
    );
    const client = createOpenRouterClient({
      apiKey: 'k',
      model: 'm',
      fetch,
      onLog: (line) => {
        lines.push(line);
      },
    });

    await client.messages.stream(REQUEST as never).finalMessage();

    const diagnostic = lines.find((line) => line.includes('not JSON'));
    expect(diagnostic).toBeDefined();
    expect(diagnostic).toContain('finish=stop');
    expect(diagnostic).toContain('Sure! Here is the plan');
    expect(diagnostic).toContain('"insertNode"');
  });

  /*
    A rewrite of the closers made HERE has no shape judge: it returns the first
    candidate that parses, `title` inside `args` included, and `claude.ts`'s
    judged salvage then finds text that already parses and judges nothing. So
    the shim undoes wrappers only, and the model's own closers reach
    `claude.ts` — and its `onAnswer` dump — exactly as written.
  */
  it("hands claude.ts the model's own closers, leaving the repair to the judged salvage there", async () => {
    const lines: string[] = [];
    const written =
      '{"rationale":"ok","commands":[{"command":"setProp","args":{"id":"a","key":"tree",' +
      '"value":{"kind":"root","children":[{"kind":"element","tag":"h2"}]}}},"title":"T"}]}';
    expect(() => JSON.parse(written) as unknown).toThrow();
    const fetch = fetchAnswering(() =>
      streamResponse(chunk({ content: `\`\`\`json\n${written}\n\`\`\`` }, {}, 'stop') + DONE),
    );
    const client = createOpenRouterClient({
      apiKey: 'k',
      model: 'm',
      fetch,
      onLog: (line) => {
        lines.push(line);
      },
    });

    const message = await client.messages.stream(REQUEST as never).finalMessage();

    expect(message.content).toEqual([{ type: 'text', text: written }]);
    expect(lines.find((line) => line.includes('not JSON'))).toContain('```json');
  });

  /* `finish_reason` is the real end; some proxies close the socket without the `[DONE]` cue. */
  it('accepts a stream that finished but never sent [DONE]', async () => {
    const fetch = fetchAnswering(() =>
      streamResponse(chunk({ content: '{"rationale":"ok"}' }, {}, 'stop')),
    );
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    const message = await client.messages.stream(REQUEST as never).finalMessage();

    expect(message.stop_reason).toBe('end_turn');
    expect(message.content).toEqual([{ type: 'text', text: '{"rationale":"ok"}' }]);
  });

  it('reports a plan cut off at the token ceiling as max_tokens', async () => {
    const fetch = fetchAnswering(() =>
      streamResponse(chunk({ content: '{"rationale":"unfinished' }, {}, 'length') + DONE),
    );
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    const message = await client.messages.stream(REQUEST as never).finalMessage();

    expect(message.stop_reason).toBe('max_tokens');
  });

  it("reports a provider's content filter as a refusal, which the wire has a shape for", async () => {
    const fetch = fetchAnswering(() =>
      streamResponse(chunk({ content: '' }, {}, 'content_filter') + DONE),
    );
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    const message = await client.messages.stream(REQUEST as never).finalMessage();

    expect(message.stop_reason).toBe('refusal');
    expect(message.stop_details?.explanation).toMatch(/declined/u);
  });

  it("carries a model's own refusal text as the explanation", async () => {
    const fetch = fetchAnswering(() =>
      streamResponse(
        chunk({ refusal: 'I cannot ' }) + chunk({ refusal: 'help with that.' }, {}, 'stop') + DONE,
      ),
    );
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    const message = await client.messages.stream(REQUEST as never).finalMessage();

    expect(message.stop_reason).toBe('refusal');
    expect(message.stop_details?.explanation).toBe('I cannot help with that.');
  });
});

describe('openrouter reasoning', () => {
  function thinkingOf(text: string): Promise<string[]> {
    const seen: string[] = [];
    const fetch = fetchAnswering(() => streamResponse(text));
    const stream = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch }).messages.stream(
      REQUEST as never,
    );
    stream.on('thinking', (delta: string) => {
      seen.push(delta);
    });
    return stream.finalMessage().then(() => seen);
  }

  it("forwards the model's reasoning deltas as the narration, like the SDK path", async () => {
    const seen = await thinkingOf(
      chunk({ reasoning: 'Choosing a hero layout.\n' }) +
        chunk({ reasoning: 'Two columns.\n' }) +
        chunk({ content: '{"rationale":"ok"}' }, {}, 'stop') +
        DONE,
    );

    expect(seen.join('')).toBe('Choosing a hero layout.\nTwo columns.\n');
  });

  /* Providers that reason but redact it send `reasoning: ""` on every delta; that is not narration. */
  it('ignores empty reasoning deltas rather than forwarding blank lines', async () => {
    const seen = await thinkingOf(
      chunk({ reasoning: '' }) +
        chunk({ reasoning: '' }) +
        chunk({ content: '{"rationale":"ok"}' }, {}, 'stop') +
        DONE,
    );

    expect(seen).toEqual([]);
  });

  it('reads reasoning_details when that is the shape the provider uses', async () => {
    const seen = await thinkingOf(
      chunk({ reasoning_details: [{ type: 'reasoning.text', text: 'Weighing the slots.\n' }] }) +
        chunk({ reasoning_details: [{ type: 'reasoning.summary', summary: 'Slot chosen.\n' }] }) +
        chunk({ content: '{"rationale":"ok"}' }, {}, 'stop') +
        DONE,
    );

    expect(seen.join('')).toBe('Weighing the slots.\nSlot chosen.\n');
  });
});

describe('openrouter failures', () => {
  function errorResponse(status: number, message: string): Response {
    return new Response(JSON.stringify({ error: { code: status, message } }), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  async function failureOf(
    answer: () => Response | Promise<Response>,
  ): Promise<Error & { httpStatus?: number }> {
    const fetch = fetchAnswering(answer);
    const client = createOpenRouterClient({ apiKey: 'k', model: 'minimax/minimax-m3:free', fetch });
    try {
      await client.messages.stream(REQUEST as never).finalMessage();
    } catch (cause) {
      return cause as Error & { httpStatus?: number };
    }
    throw new Error('expected the run to fail');
  }

  it('names a rejected key and where it goes, as a deployment mistake', async () => {
    const error = await failureOf(() => errorResponse(401, 'No auth credentials found'));

    expect(error.name).toBe('OpenRouterBackendError');
    expect(error.httpStatus).toBe(500);
    expect(error.message).toMatch(/OPENROUTER_API_KEY/u);
  });

  it('names an exhausted balance rather than a mystery', async () => {
    const error = await failureOf(() => errorResponse(402, 'Insufficient credits'));

    expect(error.httpStatus).toBe(500);
    expect(error.message).toMatch(/credits/iu);
  });

  it('keeps rate limiting retryable, with OpenRouter’s own words', async () => {
    const error = await failureOf(() =>
      errorResponse(429, 'Rate limit exceeded: free-models-per-day'),
    );

    expect(error.httpStatus).toBe(429);
    expect(error.message).toMatch(/free-models-per-day/u);
  });

  it('marks a rejected request terminal and names the model that was sent, since the slug is the usual cause', async () => {
    const error = await failureOf(() => errorResponse(400, 'No endpoints found'));

    expect(error.httpStatus).toBe(400);
    expect(error.message).toMatch(/nvidia\/nemotron-3-ultra-550b-a55b:free/u);
    expect(error.message).toMatch(/No endpoints found/u);
  });

  it('answers a provider outage as a bad gateway, which the client retries', async () => {
    const error = await failureOf(() => errorResponse(503, 'Provider unavailable'));

    expect(error.httpStatus).toBe(502);
  });

  it('turns an error that arrives mid-stream into the same sentence and status', async () => {
    const error = await failureOf(() =>
      streamResponse(
        chunk({ content: '{"ratio' }) +
          `data: ${JSON.stringify({
            id: 'gen-1',
            error: { code: 429, message: 'Rate limit exceeded' },
            choices: [{ index: 0, delta: { content: '' }, finish_reason: 'error' }],
          })}\n\n`,
      ),
    );

    expect(error.name).toBe('OpenRouterBackendError');
    expect(error.httpStatus).toBe(429);
    expect(error.message).toMatch(/Rate limit exceeded/u);
  });

  it('reports a stream that ended before the model finished, instead of parsing half a plan', async () => {
    const error = await failureOf(() => streamResponse(chunk({ content: '{"rationale":"ok' })));

    expect(error.name).toBe('OpenRouterBackendError');
    expect(error.httpStatus).toBe(502);
    expect(error.message).toMatch(/ended before/u);
  });

  it('names an unreachable OpenRouter rather than failing namelessly', async () => {
    const error = await failureOf(() => Promise.reject(new TypeError('fetch failed')));

    expect(error.name).toBe('OpenRouterBackendError');
    expect(error.httpStatus).toBe(502);
    expect(error.message).toMatch(/could not be reached/u);
  });

  it('passes the abort through untouched, so a hung-up client answers 499', async () => {
    const controller = new AbortController();
    const fetch = vi.fn<OpenRouterFetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );
    const client = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch });

    const finished = client.messages
      .stream(REQUEST as never, { signal: controller.signal })
      .finalMessage();
    controller.abort();

    await expect(finished).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
});

describe('openrouter narration', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function openStream() {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    return {
      response: new Response(body, { status: 200 }),
      write: (text: string) => controller?.enqueue(encoder.encode(text)),
      close: () => controller?.close(),
    };
  }

  function narrationOf(fetch: OpenRouterFetch) {
    const seen: string[] = [];
    const stream = createOpenRouterClient({ apiKey: 'k', model: 'm', fetch }).messages.stream(
      REQUEST as never,
    );
    stream.on('thinking', (delta: string) => {
      for (const text of delta.split('\n')) if (text.trim() !== '') seen.push(text.trim());
    });
    return { seen, finished: stream.finalMessage() };
  }

  /* Minutes of silence read as a hang. The clock alone is enough to disprove it. */
  it('keeps the line moving while OpenRouter says nothing at all', async () => {
    vi.useFakeTimers();
    const { seen } = narrationOf(() => new Promise(() => undefined));

    await vi.advanceTimersByTimeAsync(30_000);

    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen[seen.length - 1]).toMatch(/Waiting for the model to start .*00:[23]\d/u);
  });

  it('narrates the writing phase by how much plan has actually arrived', async () => {
    vi.useFakeTimers();
    const open = openStream();
    const { seen, finished } = narrationOf(() => Promise.resolve(open.response));

    await vi.advanceTimersByTimeAsync(100);
    open.write(chunk({ content: 'x'.repeat(4_200) }));
    await vi.advanceTimersByTimeAsync(3_000);

    expect(seen.join(' | ')).toMatch(/Writing the plan/u);
    expect(seen.join(' | ')).toMatch(/4,200|4200/u);

    open.write(chunk({ content: '' }, {}, 'stop') + DONE);
    open.close();
    await finished;
  });

  it("stays quiet while the model's own reasoning is narrating", async () => {
    vi.useFakeTimers();
    const open = openStream();
    const { seen, finished } = narrationOf(() => Promise.resolve(open.response));

    await vi.advanceTimersByTimeAsync(100);
    open.write(chunk({ reasoning: 'Choosing a hero layout.\n' }));
    await vi.advanceTimersByTimeAsync(9_000);

    expect(seen).toEqual(['Choosing a hero layout.']);

    open.write(chunk({ content: '{"rationale":"ok"}' }, {}, 'stop') + DONE);
    open.close();
    await finished;
  });
});
