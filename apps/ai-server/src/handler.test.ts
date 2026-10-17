import Anthropic from '@anthropic-ai/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRemoteAiPlanProvider, type AssembledAiContext } from '@craftkit/builder/headless';

import { DRAFT_FLUSH_CHARS, DRAFT_FLUSH_MS, createHandler } from './handler';
import { createOpenRouterClient, type OpenRouterFetch } from './openrouter-client';
import { PAGE_PLAN_ANSWER_SCHEMA, PAGE_PLAN_EXAMPLE } from './plan-shape';
import { PAGE_PLAN_CONTRACT_MARK } from './prompt';

/**
 * The wire contract, tested against a faked Claude.
 *
 * No test here calls the API. What is being verified is the TRANSLATION —
 * every way Claude can answer or fail becoming one of the three shapes
 * `remote-provider` knows how to read. That translation is this server's whole
 * job, and it is the part a live smoke test would exercise least.
 */

interface FakeMessage {
  readonly stop_reason?: string;
  readonly stop_details?: { readonly explanation: string } | null;
  readonly content?: { readonly type: string; readonly text: string }[];
  readonly usage?: Record<string, number>;
}

/** A client whose `messages.stream` resolves to whatever the test supplies. */
function fakeClient(
  answer: FakeMessage | (() => never),
  onThinking?: readonly string[],
): Anthropic {
  return {
    messages: {
      stream: () => ({
        on: (event: string, listener: (delta: string) => void) => {
          if (event === 'thinking' && onThinking !== undefined) {
            for (const delta of onThinking) listener(delta);
          }
        },
        finalMessage: () => {
          if (typeof answer === 'function') answer();
          return Promise.resolve({
            stop_reason: 'end_turn',
            stop_details: null,
            content: [],
            usage: { input_tokens: 10, output_tokens: 5 },
            ...(typeof answer === 'function' ? {} : answer),
          });
        },
      }),
    },
  } as unknown as Anthropic;
}

const PLAN = { rationale: 'add a hero', commands: [{ command: 'insertNode', args: {} }] };

function planAnswer(): FakeMessage {
  return {
    content: [{ type: 'text', text: JSON.stringify(PLAN) }],
    usage: {
      input_tokens: 400,
      output_tokens: 220,
      cache_read_input_tokens: 57_000,
      cache_creation_input_tokens: 0,
    },
  };
}

function wireBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: 1,
    request: 'add a hero',
    context: {
      fragments: [],
      totalTokens: 0,
      blocks: [],
      document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
      selection: { ids: [] },
      outputContract: { version: 1, schema: { type: 'object' } },
    },
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('transport', () => {
  it('answers a plan as a bare JSON body, which is what the client parses', async () => {
    const handle = createHandler({ client: fakeClient(planAnswer()) });

    const response = await handle(post(wireBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PLAN);
  });

  it('rejects anything but POST', async () => {
    const handle = createHandler({ client: fakeClient(planAnswer()) });

    const response = await handle(new Request('http://localhost/plan', { method: 'GET' }));

    expect(response.status).toBe(405);
  });

  it('refuses a body that is not a version-1 wire request', async () => {
    const handle = createHandler({ client: fakeClient(planAnswer()) });

    expect((await handle(post({ version: 99 }))).status).toBe(400);
    expect((await handle(post({ version: 1, request: 'x' }))).status).toBe(400);
  });

  it('requires the bearer token when one is configured', async () => {
    const handle = createHandler({ client: fakeClient(planAnswer()), authToken: 'secret' });

    expect((await handle(post(wireBody()))).status).toBe(401);
    expect((await handle(post(wireBody(), { authorization: 'Bearer wrong' }))).status).toBe(401);
    expect((await handle(post(wireBody(), { authorization: 'Bearer secret' }))).status).toBe(200);
  });
});

/*
  The panel may name a model per request (`x-craftkit-ai-model`). The server,
  not the browser, decides which models are allowed: a public endpoint must
  not let a client pick the most expensive model on someone else's key.
*/
describe('model choice', () => {
  function capturingClient(): {
    client: Anthropic;
    sent: () => Record<string, unknown> | undefined;
  } {
    let seen: Record<string, unknown> | undefined;
    const client = {
      messages: {
        stream: (params: Record<string, unknown>) => {
          seen = params;
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [{ type: 'text', text: JSON.stringify(PLAN) }],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    return { client, sent: () => seen };
  }

  it('passes an allowed model choice to the backend', async () => {
    const { client, sent } = capturingClient();
    const handle = createHandler({
      client,
      model: 'minimax/minimax-m3:free',
      models: ['nvidia/nemotron-3-ultra-550b-a55b:free'],
    });

    const response = await handle(
      post(wireBody(), { 'x-craftkit-ai-model': 'nvidia/nemotron-3-ultra-550b-a55b:free' }),
    );

    expect(response.status).toBe(200);
    expect(sent()?.['model']).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
  });

  it('uses the configured model when the request names none', async () => {
    const { client, sent } = capturingClient();
    const handle = createHandler({
      client,
      model: 'minimax/minimax-m3:free',
      models: ['other/model'],
    });

    await handle(post(wireBody()));

    expect(sent()?.['model']).toBe('minimax/minimax-m3:free');
  });

  it('refuses a model the server does not allow, as a terminal 400 that names it', async () => {
    const { client, sent } = capturingClient();
    const handle = createHandler({
      client,
      model: 'minimax/minimax-m3:free',
      models: ['other/model'],
    });

    const response = await handle(post(wireBody(), { 'x-craftkit-ai-model': 'openai/gpt-5' }));

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toContain('openai/gpt-5');
    expect(sent()).toBeUndefined();
  });

  it('always accepts the configured model by name, even with no allowlist', async () => {
    const { client } = capturingClient();
    const handle = createHandler({ client, model: 'minimax/minimax-m3:free' });

    const response = await handle(
      post(wireBody(), { 'x-craftkit-ai-model': 'minimax/minimax-m3:free' }),
    );

    expect(response.status).toBe(200);
  });

  it('refuses every other choice when no allowlist is configured', async () => {
    const { client } = capturingClient();
    const handle = createHandler({ client, model: 'minimax/minimax-m3:free' });

    const response = await handle(post(wireBody(), { 'x-craftkit-ai-model': 'other/model' }));

    expect(response.status).toBe(400);
  });
});

describe('answer translation', () => {
  /*
    prompt.ts tells the model to answer "a plan whose single command is
    impossible" when a request cannot be expressed. No command by that name
    exists, so without this translation the panel showed the validator's
    `names unknown command "impossible"` instead of the model's own reason.
  */
  it('turns the prompt’s "impossible" convention into a refusal that carries the reason', async () => {
    const handle = createHandler({
      client: fakeClient({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              rationale: 'This page has no pricing block to edit.',
              commands: [{ command: 'impossible', args: {} }],
            }),
          },
        ],
      }),
    });

    const response = await handle(post(wireBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      version: 1,
      refusal: 'This page has no pricing block to edit.',
    });
  });

  it('shows the "impossible" refusal on the streaming path the panel reads', async () => {
    const handle = createHandler({
      client: fakeClient({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              rationale: 'Not about this page.',
              commands: [{ command: 'impossible', args: {} }],
            }),
          },
        ],
      }),
    });

    const response = await handle(
      new Request('http://localhost/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(wireBody()),
      }),
    );

    const text = await response.text();
    expect(text).toContain('"refusal":"Not about this page."');
    expect(text).not.toContain('impossible');
  });

  it('returns a safety decline as a 200 refusal, not an error status', async () => {
    /*
      It is an ANSWER, and the wire has a shape for it. A 4xx would make the
      client report a transport failure and lose the explanation entirely.
    */
    const handle = createHandler({
      client: fakeClient({ stop_reason: 'refusal', stop_details: { explanation: 'No.' } }),
    });

    const response = await handle(post(wireBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 1, refusal: 'No.' });
  });

  it('reports a truncated plan as invalid output with advice, not as a broken plan', async () => {
    const handle = createHandler({ client: fakeClient({ stop_reason: 'max_tokens' }) });

    const body = (await handle(post(wireBody()))).json() as Promise<{
      invalidOutput: { message: string };
    }>;

    expect((await body).invalidOutput.message).toContain('smaller change');
  });

  /*
    Every backend, not only OpenRouter, can hand back a plan wrapped in a code
    fence or a sentence, or with a trailing comma — the CLI's Sonnet did, and
    the panel said "not valid JSON" about a plan that was one wrapper away
    from valid. The salvage belongs where every answer is parsed.
  */
  it('unwraps a fenced or narrated plan from any backend before parsing it', async () => {
    const handle = createHandler({
      client: fakeClient({
        content: [
          {
            type: 'text',
            text: `Here is the plan:\n\n\`\`\`json\n${JSON.stringify(PLAN)}\n\`\`\`\n`,
          },
        ],
      }),
    });

    const response = await handle(post(wireBody()));

    expect(await response.json()).toEqual(PLAN);
  });

  it('forgives trailing commas, the commonest way a model breaks otherwise-sound JSON', async () => {
    const handle = createHandler({
      client: fakeClient({
        content: [
          {
            type: 'text',
            text: '{"rationale":"add a hero","commands":[{"command":"insertNode","args":{},},],}',
          },
        ],
      }),
    });

    const response = await handle(post(wireBody()));

    expect(await response.json()).toEqual(PLAN);
  });

  it('reports unparseable output rather than forwarding it to the validator', async () => {
    const handle = createHandler({
      client: fakeClient({ content: [{ type: 'text', text: 'not json at all' }] }),
    });

    const response = await handle(post(wireBody()));

    expect(await response.json()).toMatchObject({ version: 1, invalidOutput: {} });
  });

  it('reports an empty answer', async () => {
    const handle = createHandler({ client: fakeClient({ content: [] }) });

    expect(await (await handle(post(wireBody()))).json()).toMatchObject({ invalidOutput: {} });
  });

  it('refuses to guess a plan shape when the request carried no output contract', async () => {
    const handle = createHandler({ client: fakeClient(planAnswer()) });
    const body = wireBody({
      context: {
        fragments: [],
        totalTokens: 0,
        blocks: [],
        document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
        selection: { ids: [] },
      },
    });

    expect(await (await handle(post(body))).json()).toMatchObject({ invalidOutput: {} });
  });
});

describe('failure translation', () => {
  function throwing(error: Error): Anthropic {
    return fakeClient(() => {
      throw error;
    });
  }

  it('maps rate limiting to 429, which the client treats as retryable', async () => {
    const error = Object.create(Anthropic.RateLimitError.prototype) as Error;
    const handle = createHandler({ client: throwing(error) });

    expect((await handle(post(wireBody()))).status).toBe(429);
  });

  it('maps a malformed upstream request to 400, which the client treats as terminal', async () => {
    const error = Object.create(Anthropic.BadRequestError.prototype) as Error;
    const handle = createHandler({ client: throwing(error) });

    expect((await handle(post(wireBody()))).status).toBe(400);
  });

  it('never leaks a raw SDK message or a stack to the client', async () => {
    const error = new Error('ENOTFOUND api.anthropic.com at /internal/path.ts:42');
    const handle = createHandler({ client: throwing(error) });

    const body = (await (await handle(post(wireBody()))).json()) as { error: string };

    expect(body.error).not.toContain('ENOTFOUND');
    expect(body.error).not.toContain('.ts:');
  });

  it('says the key is missing plainly, since that is a deployment mistake', async () => {
    const error = Object.create(Anthropic.AuthenticationError.prototype) as Error;
    const handle = createHandler({ client: throwing(error) });

    const body = (await (await handle(post(wireBody()))).json()) as { error: string };

    expect(body.error).toContain('API key');
  });

  /*
    The case the panel actually hit: a server started with NO credentials at
    all. The SDK then throws a plain Error at request time — not an
    AuthenticationError, not even an AnthropicError — and the translator fell
    through to "failed unexpectedly", which told the owner nothing.
  */
  const NO_CREDENTIALS = new Error(
    'Could not resolve authentication method. Expected one of apiKey, authToken, credentials, config, or profile to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted',
  );

  it('names a server with no credentials at all, and where the key goes', async () => {
    const handle = createHandler({ client: throwing(NO_CREDENTIALS) });

    const response = await handle(post(wireBody()));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe(
      'The assistant server has no credentials: set ANTHROPIC_API_KEY (apps/ai-server/.env) and restart it.',
    );
  });

  it('names missing credentials on the streaming path too, where the panel reads it', async () => {
    const handle = createHandler({ client: throwing(NO_CREDENTIALS) });

    const response = await handle(
      new Request('http://localhost/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(wireBody()),
      }),
    );

    expect(response.headers.get('content-type')).toBe('text/event-stream');
    const text = await response.text();
    expect(text).toContain('event: result');
    expect(text).toContain('"invalidOutput":{"message":"The assistant server has no credentials');
    expect(text).not.toContain('failed unexpectedly');
  });

  /*
    The dev CLI backend authors its own owner-facing sentences (a timeout, a
    missing `claude`, an exit code with stderr). They are not SDK text and not
    stacks, so collapsing them into "failed unexpectedly" throws away the only
    description of the failure anyone has — the exact blindness that made a
    110s CLI cap look like a mystery server crash.
  */
  function cliBackendError(message: string): Error {
    const error = new Error(message);
    error.name = 'CliBackendError';
    return error;
  }

  it('passes a dev CLI backend failure through by name, not as a mystery', async () => {
    const handle = createHandler({
      client: throwing(cliBackendError('The dev `claude` CLI backend gave up after 110s.')),
    });

    const body = (await (await handle(post(wireBody()))).json()) as { error: string };

    expect(body.error).toBe('The dev `claude` CLI backend gave up after 110s.');
  });

  it('shows the dev CLI backend failure on the streaming path the panel reads', async () => {
    const handle = createHandler({
      client: throwing(cliBackendError('The dev `claude` CLI backend gave up after 110s.')),
    });

    const response = await handle(
      new Request('http://localhost/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(wireBody()),
      }),
    );

    const text = await response.text();
    expect(text).toContain('gave up after 110s');
    expect(text).not.toContain('failed unexpectedly');
  });

  /*
    The OpenRouter backend knows which of its failures are retryable and
    which are deployment mistakes, and says so on the error. The handler
    carries the sentence AND the status, or `remote-provider` would retry a
    bad key and give up on a rate limit.
  */
  function openRouterBackendError(message: string, httpStatus: number): Error {
    const error = new Error(message) as Error & { httpStatus: number };
    error.name = 'OpenRouterBackendError';
    error.httpStatus = httpStatus;
    return error;
  }

  it('passes an OpenRouter failure through by name, with the status the backend chose', async () => {
    const handle = createHandler({
      client: throwing(
        openRouterBackendError('OpenRouter is rate limiting this key right now.', 429),
      ),
    });

    const response = await handle(post(wireBody()));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(429);
    expect(body.error).toBe('OpenRouter is rate limiting this key right now.');
  });

  it('treats an OpenRouter key problem as the deployment mistake it is', async () => {
    const handle = createHandler({
      client: throwing(
        openRouterBackendError('OpenRouter rejected the API key: check OPENROUTER_API_KEY.', 500),
      ),
    });

    const response = await handle(post(wireBody()));

    expect(response.status).toBe(500);
    expect(((await response.json()) as { error: string }).error).toMatch(/OPENROUTER_API_KEY/u);
  });

  it('shows the OpenRouter failure on the streaming path the panel reads', async () => {
    const handle = createHandler({
      client: throwing(
        openRouterBackendError('OpenRouter rejected the request for model openai/gpt-5.', 400),
      ),
    });

    const response = await handle(
      new Request('http://localhost/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(wireBody()),
      }),
    );

    const text = await response.text();
    expect(text).toContain('openai/gpt-5');
    expect(text).not.toContain('failed unexpectedly');
  });
});

describe('streaming', () => {
  async function readStream(response: Response): Promise<string> {
    const body: ReadableStream<Uint8Array> | null = response.body;
    if (body === null) return '';
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value);
    }
    return text;
  }

  it('streams status frames then exactly one result', async () => {
    const handle = createHandler({
      client: fakeClient(planAnswer(), ['Reading the catalog\n', 'Choosing a parent\n']),
    });

    const response = await handle(
      post(wireBody(), { accept: 'text/event-stream, application/json' }),
    );
    const body = await readStream(response);

    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(body).toContain('event: status');
    expect(body).toContain('Understanding the request…');
    expect(body).not.toContain('Reading the catalog');
    expect(body).not.toContain('Choosing a parent');
    expect(body).toContain('event: usage');
    expect(body.match(/event: result/gu)).toHaveLength(1);
  });

  it('carries a mid-stream failure as a result frame, the only shape left', async () => {
    // The status code is already sent by then; an invalid-output result is the
    // one answer that still reaches the client's taxonomy.
    const error = Object.create(Anthropic.RateLimitError.prototype) as Error;
    const handle = createHandler({
      client: fakeClient(() => {
        throw error;
      }),
    });

    const body = await readStream(await handle(post(wireBody(), { accept: 'text/event-stream' })));

    expect(body).toContain('event: result');
    expect(body).toContain('rate limited');
  });

  it('answers plain JSON when the client did not ask for a stream', async () => {
    const handle = createHandler({ client: fakeClient(planAnswer()) });

    const response = await handle(post(wireBody(), { accept: 'application/json' }));

    expect(response.headers.get('content-type')).toBe('application/json');
  });
});

/*
  "Step 0 names unknown command "e"" is all the panel can say about a plan the
  validator refused; the owner's terminal has to show what the model actually
  answered, or a bad model and a bad prompt look the same.
*/
describe('answer reporting', () => {
  it('hands the raw answer text to the host before it is parsed, for every kind of answer', async () => {
    const seen: string[] = [];
    const handle = createHandler({
      client: fakeClient({ content: [{ type: 'text', text: 'not json at all' }] }),
      onAnswer: (text) => {
        seen.push(text);
      },
    });

    await handle(post(wireBody()));

    expect(seen).toEqual(['not json at all']);
  });
});

describe('usage reporting', () => {
  it('streams public activity before completion and measured usage through the real remote adapter', async () => {
    let finish: ((value: FakeMessage) => void) | undefined;
    const held = new Promise<FakeMessage>((resolve) => {
      finish = resolve;
    });
    const client = {
      messages: { stream: () => ({ on: () => undefined, finalMessage: () => held }) },
    } as unknown as Anthropic;
    const handle = createHandler({ client });
    const progress: string[] = [];
    const measurements: unknown[] = [];
    const provider = createRemoteAiPlanProvider({
      endpoint: 'https://assistant.example.test/plan',
      fetch: async (_input, init) =>
        handle(new Request('https://assistant.example.test/plan', init)),
    });
    const wire = wireBody() as { context: AssembledAiContext };
    const pending = provider.propose('Improve the hero', wire.context, {
      onProgress: (text) => {
        progress.push(text);
      },
      onUsage: (usage) => {
        measurements.push(usage);
      },
    });
    await vi.waitFor(() => {
      expect(progress).toContain('Understanding the request…');
    });
    expect(measurements).toHaveLength(0);
    finish?.(planAnswer());
    await pending;
    expect(progress).toContain('Checking the generated result…');
    expect(measurements).toEqual([
      expect.objectContaining({ inputTokens: 400, outputTokens: 220, cacheReadTokens: 57_000 }),
    ]);
  });
  it('preserves missing counts as unknown and contains a throwing telemetry observer', async () => {
    const handle = createHandler({
      client: fakeClient({
        content: [{ type: 'text', text: '{"rationale":"ok","commands":[]}' }],
        usage: {},
      }),
      onUsage: () => {
        throw new Error('host telemetry');
      },
    });
    const response = await handle(post(wireBody()));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.headers.get('x-craftkit-ai-usage') ?? 'null')).toMatchObject({
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    });
  });
  it('reports the cached share, the number that reveals a broken prefix', async () => {
    const onUsage = vi.fn();
    const handle = createHandler({ client: fakeClient(planAnswer()), onUsage });

    await handle(post(wireBody()));

    expect(onUsage).toHaveBeenCalledTimes(1);
    const report = onUsage.mock.calls[0]?.[0] as { cachedShare: number; cacheReadTokens: number };
    expect(report.cacheReadTokens).toBe(57_000);
    // ~99%: a figure near zero would mean the catalog is being re-billed.
    expect(report.cachedShare).toBeGreaterThan(0.98);
  });

  it('reports measured usage for a refusal without losing the refusal body', async () => {
    const onUsage = vi.fn();
    const handle = createHandler({
      client: fakeClient({ stop_reason: 'refusal', stop_details: { explanation: 'No.' } }),
      onUsage,
    });

    const response = await handle(post(wireBody()));

    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(response.headers.get('x-craftkit-ai-usage') ?? 'null')).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
    });
  });
});

describe('per-call reasoning budget', () => {
  function recordingClient(): { client: Anthropic; seen: unknown[]; params: unknown[] } {
    const seen: unknown[] = [];
    const params: unknown[] = [];
    const client = {
      messages: {
        stream: (sent: unknown, requestOptions: unknown) => {
          seen.push(requestOptions);
          params.push(sent);
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [{ type: 'text', text: JSON.stringify(PLAN) }],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    return { client, seen, params };
  }

  const sectionWriter = (): unknown =>
    wireBody({
      context: {
        ...(wireBody() as { context: Record<string, unknown> }).context,
        skills: [
          {
            id: 'craftkit.build-fill',
            version: '3.0.0',
            contentFingerprint: 'x',
            reason: 'explicit',
          },
        ],
      },
    });

  it('gives a section writer the section budget', async () => {
    const { client, seen } = recordingClient();
    const handle = createHandler({ client, sectionEffort: 'low' });

    await handle(post(sectionWriter()));

    expect(seen[0]).toMatchObject({ headers: { 'x-craftkit-internal-reasoning-effort': 'low' } });
  });

  it('leaves every other call on the backend default', async () => {
    const { client, seen } = recordingClient();
    const handle = createHandler({ client, sectionEffort: 'low' });

    await handle(post(wireBody()));

    expect((seen[0] as { headers?: unknown }).headers).toBeUndefined();
  });

  it('turns thinking off for a section writer', async () => {
    const { client, params } = recordingClient();
    const handle = createHandler({ client, sectionEffort: 'low' });

    await handle(post(sectionWriter()));

    expect(params[0]).toMatchObject({ thinking: { type: 'disabled' } });
  });

  it('turns thinking off for a build scaffold (the fallback after a refused page plan)', async () => {
    const { client, params, seen } = recordingClient();
    const handle = createHandler({ client, sectionEffort: 'low' });
    const scaffold = wireBody({
      context: {
        ...(wireBody() as { context: Record<string, unknown> }).context,
        skills: [
          {
            id: 'craftkit.build-scaffold',
            version: '1.0.0',
            contentFingerprint: 'x',
            reason: 'explicit',
          },
        ],
      },
    });

    await handle(post(scaffold));

    expect(params[0]).toMatchObject({ thinking: { type: 'disabled' } });
    // The section budget is a writer's, not the scaffold's.
    expect((seen[0] as { headers?: unknown }).headers).toBeUndefined();
  });

  it('turns thinking off for an edit that asked for low effort', async () => {
    const { client, params } = recordingClient();
    const handle = createHandler({ client });

    await handle(post(wireBody({ effort: 'low' })));

    expect(params[0]).toMatchObject({ thinking: { type: 'disabled' } });
  });

  it('keeps thinking on for a medium edit and for a page plan', async () => {
    const { client, params } = recordingClient();
    const handle = createHandler({ client, sectionEffort: 'low' });

    await handle(post(wireBody({ effort: 'medium' })));
    await handle(post(wireBody()));

    expect(params[0]).toMatchObject({ thinking: { type: 'adaptive' } });
    expect(params[1]).toMatchObject({ thinking: { type: 'adaptive' } });
  });

  it('keeps thinking on for a section writer when the person asked for depth, at their budget', async () => {
    const { client, params, seen } = recordingClient();
    const handle = createHandler({ client, sectionEffort: 'low' });

    await handle(post({ ...(sectionWriter() as object), effort: 'high' }));
    await handle(post({ ...(sectionWriter() as object), effort: 'medium' }));

    expect(params[0]).toMatchObject({ thinking: { type: 'adaptive' } });
    expect(seen[0]).toMatchObject({ headers: { 'x-craftkit-internal-reasoning-effort': 'high' } });
    // Medium is the default: the writer still skips thinking, but runs at the budget named.
    expect(params[1]).toMatchObject({ thinking: { type: 'disabled' } });
    expect(seen[1]).toMatchObject({
      headers: { 'x-craftkit-internal-reasoning-effort': 'medium' },
    });
  });
});

/*
  The page-plan task (2026-09-28): the same /plan endpoint, `task: 'page-plan'`
  in the body, and the answer the client's `readAiPagePlanWireResponse`
  classifies — `{version: 1, pagePlan, rationale?}`, a refusal, or the
  versioned invalid-output report. Nothing about an ordinary request changes.
*/
describe('the page-plan task', () => {
  const RATIONALE = PAGE_PLAN_EXAMPLE.rationale;
  const PAGE_PLAN = PAGE_PLAN_EXAMPLE.pagePlan;

  function pagePlanBody(overrides: Record<string, unknown> = {}): unknown {
    return wireBody({ request: 'Build a page for my roastery', task: 'page-plan', ...overrides });
  }

  function answering(text: string): FakeMessage {
    return { content: [{ type: 'text', text }], usage: { input_tokens: 900, output_tokens: 700 } };
  }

  async function readStream(response: Response): Promise<string> {
    return new Response(response.body).text();
  }

  /** What the client's reader does first: the one `result` frame's data. */
  function resultFrame(body: string): unknown {
    const frame = /event: result\ndata: (.*)\n\n/u.exec(body);
    return JSON.parse(frame?.[1] ?? 'null') as unknown;
  }

  it('answers with the page plan on the wire the contract defines', async () => {
    const handle = createHandler({
      client: fakeClient(answering(JSON.stringify({ rationale: RATIONALE, pagePlan: PAGE_PLAN }))),
    });

    const response = await handle(post(pagePlanBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      version: 1,
      rationale: RATIONALE,
      pagePlan: PAGE_PLAN,
    });
  });

  it('streams status frames, then the page plan as the one result frame', async () => {
    const handle = createHandler({
      client: fakeClient(answering(JSON.stringify({ rationale: RATIONALE, pagePlan: PAGE_PLAN })), [
        'Choosing the cafe row\n',
      ]),
    });

    const body = await readStream(
      await handle(post(pagePlanBody(), { accept: 'text/event-stream, application/json' })),
    );

    expect(body).toContain('Understanding the request…');
    expect(body).not.toContain('Choosing the cafe row');
    expect(body.match(/event: result/gu)).toHaveLength(1);
    expect(resultFrame(body)).toEqual({ version: 1, rationale: RATIONALE, pagePlan: PAGE_PLAN });
  });

  it('brings its own answer shape, so a context without a plan contract still plans', async () => {
    const body = pagePlanBody() as { context: Record<string, unknown> };
    delete body.context['outputContract'];
    const handle = createHandler({
      client: fakeClient(answering(JSON.stringify({ rationale: RATIONALE, pagePlan: PAGE_PLAN }))),
    });

    const response = await handle(post(body));

    expect(await response.json()).toMatchObject({ version: 1, pagePlan: PAGE_PLAN });
  });

  it('wraps a bare page plan from a model that forgot the wrapper', async () => {
    const handle = createHandler({ client: fakeClient(answering(JSON.stringify(PAGE_PLAN))) });

    const response = await handle(post(pagePlanBody()));

    expect(await response.json()).toEqual({ version: 1, pagePlan: PAGE_PLAN });
  });

  it("carries the model's refusal as the wire's refusal", async () => {
    const handle = createHandler({
      client: fakeClient(answering('{"rationale":"r","refusal":"هذا ليس طلب صفحة."}')),
    });

    const response = await handle(post(pagePlanBody()));

    expect(await response.json()).toEqual({ version: 1, refusal: 'هذا ليس طلب صفحة.' });
  });

  it('reports an ordinary commands plan as invalid output, never as a page plan', async () => {
    const handle = createHandler({ client: fakeClient(answering(JSON.stringify(PLAN))) });

    const answer = (await (await handle(post(pagePlanBody()))).json()) as {
      version: number;
      invalidOutput?: { message: string };
      pagePlan?: unknown;
    };

    expect(answer.version).toBe(1);
    expect(answer.pagePlan).toBeUndefined();
    expect(answer.invalidOutput?.message).toMatch(/page plan/u);
  });

  it('reports a cut-off page plan as invalid output, with advice', async () => {
    const handle = createHandler({
      client: fakeClient({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"ra' }] }),
    });

    const answer = (await (await handle(post(pagePlanBody()))).json()) as {
      invalidOutput?: { message: string };
    };

    expect(answer.invalidOutput?.message).toMatch(/page plan was cut off/u);
  });

  it('refuses a task it does not know with a terminal 400, rather than answering a plan', async () => {
    const handle = createHandler({ client: fakeClient(planAnswer()) });

    const response = await handle(post(wireBody({ task: 'poem' })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Unknown task "poem".' });
  });

  it('plans at the backend default effort, even when a section-writer skill is pinned', async () => {
    const seen: { params: Record<string, unknown>; options: unknown }[] = [];
    const client = {
      messages: {
        stream: (params: Record<string, unknown>, options: unknown) => {
          seen.push({ params, options });
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [{ type: 'text', text: JSON.stringify({ pagePlan: PAGE_PLAN }) }],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    const handle = createHandler({ client, sectionEffort: 'low' });
    const body = pagePlanBody() as { context: Record<string, unknown> };
    body.context['skills'] = [
      { id: 'craftkit.build-fill', version: '3.0.0', contentFingerprint: 'x', reason: 'explicit' },
    ];

    await handle(post(body));

    expect((seen[0]?.options as { headers?: unknown }).headers).toBeUndefined();
    expect(seen[0]?.params['output_config']).toEqual({
      format: { type: 'json_schema', schema: PAGE_PLAN_ANSWER_SCHEMA },
    });
  });

  it('serves the page plan through the OpenRouter backend, schema and contract as text', async () => {
    const answer = JSON.stringify({ rationale: RATIONALE, pagePlan: PAGE_PLAN });
    const sent: Record<string, unknown>[] = [];
    const fetch = vi.fn<OpenRouterFetch>((_url, init) => {
      sent.push(
        JSON.parse(typeof init.body === 'string' ? init.body : '{}') as Record<string, unknown>,
      );
      const frame = { choices: [{ index: 0, delta: { content: answer }, finish_reason: 'stop' }] };
      return Promise.resolve(
        new Response(`data: ${JSON.stringify(frame)}\n\ndata: [DONE]\n\n`, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      );
    });
    const handle = createHandler({
      client: createOpenRouterClient({ apiKey: 'k', model: 'minimax/minimax-m3:free', fetch }),
    });

    const response = await handle(post(pagePlanBody()));

    expect(await response.json()).toEqual({
      version: 1,
      rationale: RATIONALE,
      pagePlan: PAGE_PLAN,
    });
    const system = JSON.stringify((sent[0]?.['messages'] as unknown[])[0]);
    expect(system).toContain(PAGE_PLAN_CONTRACT_MARK);
    expect(system).toContain('# Required output format');
    expect(system).toContain('\\"pagePlan\\"');
    expect(system).not.toContain('# Block catalog');
    // A free model decodes nothing strictly: the schema travels as text only.
    expect(sent[0]?.['response_format']).toBeUndefined();
  });
});

/*
  A shade name the client's palette cannot resolve reached the wire as written
  and cost a repair round (measured live 2026-09-28: "accentInk":"red-400" on
  an Arabic Dubai car dealer). It now leaves this server as its hex, on both
  transports, and a token already in hex is left exactly as it was.
*/
describe('page-plan colours and samples on the wire', () => {
  const liveAnswer = (): string => {
    const pagePlan = structuredClone(PAGE_PLAN_EXAMPLE.pagePlan) as unknown as Record<
      string,
      unknown
    >;
    pagePlan['tokens'] = {
      ...(pagePlan['tokens'] as Record<string, unknown>),
      accentInk: 'red-400',
      border: '#2a2a2a',
    };
    pagePlan['facts'] = [{ key: 'phone', sample: '+971 4 XXX XXXX', section: 'order' }];
    return JSON.stringify({ rationale: 'r', pagePlan });
  };
  const body = (): unknown => wireBody({ request: 'صفحة لمعرض سيارات في دبي', task: 'page-plan' });

  function expectRepaired(plan: unknown): void {
    const { tokens, facts } = (plan as { pagePlan: { tokens: unknown; facts: unknown } }).pagePlan;
    expect(tokens).toMatchObject({ accentInk: '#f87171', border: '#2a2a2a' });
    expect(facts).toEqual([{ key: 'phone', sample: '+971 4 234 5678', section: 'order' }]);
  }

  it('answers the unary request with the hex and the filled sample, and logs the repair', async () => {
    const logged: string[] = [];
    const handle = createHandler({
      client: fakeClient({ content: [{ type: 'text', text: liveAnswer() }] }),
      onLog: (line) => {
        logged.push(line);
      },
    });

    expectRepaired(await (await handle(post(body()))).json());
    expect(logged.join('\n')).toContain('tokens.accentInk "red-400" → "#f87171"');
  });

  it('streams the same repaired plan as the one result frame', async () => {
    const handle = createHandler({
      client: fakeClient({ content: [{ type: 'text', text: liveAnswer() }] }),
    });

    const text = await new Response(
      (await handle(post(body(), { accept: 'text/event-stream' }))).body,
    ).text();
    const frame = /event: result\ndata: (.*)\n\n/u.exec(text)?.[1] ?? 'null';

    expectRepaired(JSON.parse(frame));
  });
});

/*
  A small edit may name its own fast model and budget in the body (the
  fast-edits contract, 2026-09-28: RunAiAgentOptions.editModel/editEffort);
  the header stays the picker's choice for everything else. Same allowlist.
*/
describe('per-call model and effort', () => {
  function recording(): { client: Anthropic; seen: { params: unknown; options: unknown }[] } {
    const seen: { params: unknown; options: unknown }[] = [];
    const client = {
      messages: {
        stream: (params: unknown, options: unknown) => {
          seen.push({ params, options });
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [{ type: 'text', text: JSON.stringify(PLAN) }],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    return { client, seen };
  }
  const allowlist = { model: 'cli:sonnet', models: ['cli:haiku', 'vendor/free:free'] };

  it("runs a call on the person's picked model (the header), over the host's fast edit model in the body", async () => {
    // 2026-10-08: the owner picked Opus and every edit ran on `haiku, effort low`.
    const { client, seen } = recording();
    const handle = createHandler({ client, ...allowlist });

    const response = await handle(
      post(wireBody({ model: 'cli:haiku' }), { 'x-craftkit-ai-model': 'vendor/free:free' }),
    );

    expect(response.status).toBe(200);
    expect((seen[0]?.params as { model: string }).model).toBe('vendor/free:free');
  });

  it("runs a call on the host's fast edit model in the body when the person picked none", async () => {
    const { client, seen } = recording();
    const handle = createHandler({ client, ...allowlist });

    const response = await handle(post(wireBody({ model: 'cli:haiku' })));

    expect(response.status).toBe(200);
    expect((seen[0]?.params as { model: string }).model).toBe('cli:haiku');
  });

  it('refuses a body model outside the allowlist, as the header one is, before any call', async () => {
    const { client, seen } = recording();
    const handle = createHandler({ client, ...allowlist });

    const refused = await handle(post(wireBody({ model: 'anthropic/claude-opus-5' })));
    const malformed = await handle(post(wireBody({ model: 42 })));

    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { error: string }).error).toContain(
      'anthropic/claude-opus-5',
    );
    expect(malformed.status).toBe(400);
    expect(seen).toHaveLength(0);
  });

  it('gives a call the budget its body asks for among the five levels, and refuses any other', async () => {
    const { client, seen } = recording();
    const handle = createHandler({ client, ...allowlist });

    await handle(post(wireBody({ effort: 'low' })));
    const higher = await handle(post(wireBody({ effort: 'ludicrous' })));

    expect(seen[0]?.options).toMatchObject({
      headers: { 'x-craftkit-internal-reasoning-effort': 'low' },
    });
    expect((seen[0]?.params as { output_config: unknown }).output_config).toMatchObject({
      effort: 'low',
    });
    expect(higher.status).toBe(400);
    expect(seen).toHaveLength(1);
  });

  it('reads the budget from its header beside the model header, the body winning', async () => {
    const { client, seen } = recording();
    const handle = createHandler({ client, ...allowlist });

    await handle(
      post(wireBody(), { 'x-craftkit-ai-model': 'cli:haiku', 'x-craftkit-ai-effort': 'low' }),
    );
    await handle(post(wireBody({ effort: 'medium' }), { 'x-craftkit-ai-effort': 'low' }));
    const higher = await handle(post(wireBody(), { 'x-craftkit-ai-effort': 'ludicrous' }));

    expect((seen[0]?.params as { model: string }).model).toBe('cli:haiku');
    expect(seen[0]?.options).toMatchObject({
      headers: { 'x-craftkit-internal-reasoning-effort': 'low' },
    });
    expect(seen[1]?.options).toMatchObject({
      headers: { 'x-craftkit-internal-reasoning-effort': 'medium' },
    });
    expect(higher.status).toBe(400);
    expect(seen).toHaveLength(2);
  });

  it('never lets a body budget change a page plan, which plans at the backend default', async () => {
    const seen: unknown[] = [];
    const client = {
      messages: {
        stream: (_params: unknown, options: unknown) => {
          seen.push(options);
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [
                  { type: 'text', text: JSON.stringify({ pagePlan: PAGE_PLAN_EXAMPLE.pagePlan }) },
                ],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    const handle = createHandler({ client });

    await handle(post(wireBody({ task: 'page-plan', effort: 'low' })));

    expect((seen[0] as { headers?: unknown }).headers).toBeUndefined();
  });

  it('plans a page with thinking off by default (speed first), and on when planThinking is set', async () => {
    const params: { thinking?: { type?: string } }[] = [];
    const client = {
      messages: {
        stream: (sent: { thinking?: { type?: string } }) => {
          params.push(sent);
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [
                  { type: 'text', text: JSON.stringify({ pagePlan: PAGE_PLAN_EXAMPLE.pagePlan }) },
                ],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;

    await createHandler({ client })(post(wireBody({ task: 'page-plan' })));
    await createHandler({ client, planThinking: true })(post(wireBody({ task: 'page-plan' })));

    expect(params[0]?.thinking?.type).toBe('disabled');
    expect(params[1]?.thinking?.type).toBe('adaptive');
  });

  it('lets a page plan think when the person asked for depth, and only then', async () => {
    const params: { thinking?: { type?: string } }[] = [];
    const client = {
      messages: {
        stream: (sent: { thinking?: { type?: string } }) => {
          params.push(sent);
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [
                  { type: 'text', text: JSON.stringify({ pagePlan: PAGE_PLAN_EXAMPLE.pagePlan }) },
                ],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    const handle = createHandler({ client });

    await handle(post(wireBody({ task: 'page-plan' }), { 'x-craftkit-ai-effort': 'medium' }));
    await handle(post(wireBody({ task: 'page-plan' }), { 'x-craftkit-ai-effort': 'xhigh' }));

    expect(params[0]?.thinking?.type).toBe('disabled');
    expect(params[1]?.thinking?.type).toBe('adaptive');
  });
});

describe('GET /v1/models, the picker’s list', () => {
  const get = (headers: Record<string, string> = {}): Request =>
    new Request('http://localhost/v1/models', { method: 'GET', headers });
  const catalog = (
    models: readonly { id: string; name: string }[],
    extra: { fetchedAt?: number; error?: string } = {},
  ) => ({
    list: () =>
      Promise.resolve({
        models: models.map((model) => ({
          ...model,
          contextLength: 262_144,
          structuredOutputs: true,
          created: 1,
        })),
        fetchedAt: extra.fetchedAt ?? 1,
        ...(extra.error === undefined ? {} : { error: extra.error }),
      }),
    has: (slug: string) => Promise.resolve(models.some((model) => model.id === slug)),
  });
  const config = {
    client: fakeClient(planAnswer()),
    model: 'cli:claude-sonnet-5-5',
    models: ['cli:claude-opus-5-5', 'old/withdrawn:free', 'kept/free:free'],
  };

  it('offers the configured models, then every free one OpenRouter lists, and the five budgets', async () => {
    const handle = createHandler({
      ...config,
      freeModels: catalog([
        { id: 'kept/free:free', name: 'Kept' },
        { id: 'new/arrival:free', name: 'New Arrival' },
      ]),
    });

    const response = await handle(get());
    const body = (await response.json()) as {
      default: string;
      defaultEffort: string;
      efforts: string[];
      models: { id: string; kind: string; name?: string }[];
    };

    expect(response.status).toBe(200);
    expect(body.default).toBe('cli:claude-sonnet-5-5');
    expect(body.defaultEffort).toBe('medium');
    expect(body.efforts).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    // The withdrawn free slug is gone; the configured one that is still listed keeps its name.
    expect(body.models.map((model) => [model.id, model.kind])).toEqual([
      ['cli:claude-sonnet-5-5', 'configured'],
      ['cli:claude-opus-5-5', 'configured'],
      ['kept/free:free', 'configured'],
      ['new/arrival:free', 'live'],
    ]);
    expect(body.models[2]?.name).toBe('Kept');
  });

  it('keeps every configured model while the live listing is unreadable, and says why', async () => {
    const handle = createHandler({
      ...config,
      freeModels: catalog([], { fetchedAt: 0, error: 'OpenRouter answered 503' }),
    });

    const body = (await (await handle(get())).json()) as {
      models: { id: string }[];
      error: string;
    };

    expect(body.models.map((model) => model.id)).toContain('old/withdrawn:free');
    expect(body.error).toBe('OpenRouter answered 503');
  });

  it('wants the bearer token like every other route', async () => {
    const handle = createHandler({ ...config, authToken: 'secret' });

    expect((await handle(get())).status).toBe(401);
    expect((await handle(get({ authorization: 'Bearer secret' }))).status).toBe(200);
  });

  it('lets a request name a free model the live listing carries, and refuses one it does not', async () => {
    const seen: unknown[] = [];
    const client = {
      messages: {
        stream: (params: unknown) => {
          seen.push(params);
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [{ type: 'text', text: JSON.stringify(PLAN) }],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    const handle = createHandler({
      ...config,
      client,
      freeModels: catalog([{ id: 'new/arrival:free', name: 'New Arrival' }]),
    });

    const allowed = await handle(post(wireBody(), { 'x-craftkit-ai-model': 'new/arrival:free' }));
    const gone = await handle(post(wireBody(), { 'x-craftkit-ai-model': 'gone/model:free' }));
    // Free only: a paid slug is never opened by the live list.
    const paid = await handle(post(wireBody(), { 'x-craftkit-ai-model': 'openai/gpt-5' }));

    expect(allowed.status).toBe(200);
    expect((seen[0] as { model: string }).model).toBe('new/arrival:free');
    expect(gone.status).toBe(400);
    expect(paid.status).toBe(400);
  });
});

/*
  POST /v1/prompt/enhance (enhance.ts has the contract): the same bearer,
  body limit and error envelope as /plan, the fastest allowed model — never
  the picker's — and its own cap.
*/
describe('the prompt enhancer route', () => {
  const ENHANCED = {
    enhanced: 'اعمل صفحة هبوط لمخبز في عمّان: الهيرو، المنتجات، الأسعار، التواصل.',
    understood: 'صفحة هبوط لمخبز في عمّان.',
    changes: ['«صفحه» ← «صفحة»'],
    questions: [],
    language: 'ar',
  };
  const REQUEST_BODY = {
    version: 1,
    text: 'اعمل صفحه هبوط لمخبز في عمان',
    locale: 'ar',
    intent: { kind: 'build-page', confidence: 0.85 },
    page: { empty: true, sections: [] },
    selection: null,
    answers: [],
  };

  function enhancing(text: string): {
    client: Anthropic;
    seen: { params: Record<string, unknown>; options: unknown }[];
  } {
    const seen: { params: Record<string, unknown>; options: unknown }[] = [];
    const client = {
      messages: {
        stream: (params: Record<string, unknown>, options: unknown) => {
          seen.push({ params, options });
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [{ type: 'text', text }],
                usage: { input_tokens: 700, output_tokens: 120 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    return { client, seen };
  }

  function enhanceRequest(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request('http://localhost/v1/prompt/enhance', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  it('answers the contract’s JSON on the fastest allowed model, low effort, no thinking', async () => {
    const { client, seen } = enhancing(JSON.stringify(ENHANCED));
    const onUsage = vi.fn();
    const handle = createHandler({
      client,
      model: 'cli:sonnet',
      models: ['vendor/big:free', 'cli:haiku'],
      onUsage,
    });

    const response = await handle(
      enhanceRequest(REQUEST_BODY, { 'x-craftkit-ai-model': 'cli:sonnet' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 1, ...ENHANCED });
    expect(seen[0]?.params).toMatchObject({
      model: 'cli:haiku',
      max_tokens: 900,
      thinking: { type: 'disabled' },
    });
    expect(seen[0]?.options).toMatchObject({
      headers: { 'x-craftkit-internal-reasoning-effort': 'low' },
    });
    expect(onUsage.mock.calls[0]?.[0]).toMatchObject({ task: 'enhance', outputTokens: 120 });
  });

  it('takes the enhancer model the server was configured with', async () => {
    const { client, seen } = enhancing(JSON.stringify(ENHANCED));
    const handle = createHandler({ client, model: 'cli:sonnet', enhanceModel: 'cli:sonnet' });

    await handle(enhanceRequest(REQUEST_BODY));

    expect((seen[0]?.params as { model: string }).model).toBe('cli:sonnet');
  });

  it('requires the same bearer token as /plan', async () => {
    const { client, seen } = enhancing(JSON.stringify(ENHANCED));
    const handle = createHandler({ client, authToken: 'secret' });

    expect((await handle(enhanceRequest(REQUEST_BODY))).status).toBe(401);
    expect(
      (await handle(enhanceRequest(REQUEST_BODY, { authorization: 'Bearer wrong' }))).status,
    ).toBe(401);
    expect(
      (await handle(enhanceRequest(REQUEST_BODY, { authorization: 'Bearer secret' }))).status,
    ).toBe(200);
    expect(seen).toHaveLength(1);
  });

  it('refuses a malformed request with a terminal 400 that says what is wrong', async () => {
    const { client, seen } = enhancing(JSON.stringify(ENHANCED));
    const handle = createHandler({ client });

    for (const bad of [
      { ...REQUEST_BODY, version: 2 },
      { ...REQUEST_BODY, text: '   ' },
      { ...REQUEST_BODY, locale: 'fr' },
      { ...REQUEST_BODY, intent: { kind: 'build-everything', confidence: 1 } },
      { ...REQUEST_BODY, page: { empty: 'yes' } },
      { ...REQUEST_BODY, answers: [{ question: 'q' }] },
    ]) {
      const response = await handle(enhanceRequest(bad));
      expect(response.status, JSON.stringify(bad)).toBe(400);
      expect(((await response.json()) as { error: string }).error.length).toBeGreaterThan(0);
    }
    expect(seen).toHaveLength(0);
  });

  it('reports an answer that is not an enhancement as a 502, and a refusal as a terminal 422', async () => {
    const garbled = createHandler({ client: enhancing('I would make it nicer.').client });
    const declined = createHandler({
      client: fakeClient({ stop_reason: 'refusal', stop_details: { explanation: 'No.' } }),
    });

    const bad = await garbled(enhanceRequest(REQUEST_BODY));
    const no = await declined(enhanceRequest(REQUEST_BODY));

    expect(bad.status).toBe(502);
    expect(((await bad.json()) as { error: string }).error).toMatch(/improved request/u);
    expect(no.status).toBe(422);
    expect(await no.json()).toEqual({ error: 'No.' });
  });

  it('passes a backend failure through with its own sentence and status, as /plan does', async () => {
    const error = new Error('OpenRouter is rate limiting this key right now.') as Error & {
      httpStatus: number;
    };
    error.name = 'OpenRouterBackendError';
    error.httpStatus = 429;
    const handle = createHandler({
      client: fakeClient(() => {
        throw error;
      }),
    });

    const response = await handle(enhanceRequest(REQUEST_BODY));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: 'OpenRouter is rate limiting this key right now.',
    });
  });

  it('stops a call that outruns its cap and says so with a 504', async () => {
    const client = {
      messages: {
        stream: (_params: unknown, options: { signal?: AbortSignal }) => ({
          on: () => undefined,
          finalMessage: () =>
            new Promise((_resolve, reject) => {
              options.signal?.addEventListener('abort', () => {
                const aborted = new Error('aborted');
                aborted.name = 'AbortError';
                reject(aborted);
              });
            }),
        }),
      },
    } as unknown as Anthropic;
    const handle = createHandler({ client, enhanceTimeoutMs: 30 });

    const response = await handle(enhanceRequest(REQUEST_BODY));

    expect(response.status).toBe(504);
    expect(((await response.json()) as { error: string }).error).toMatch(
      /send the request as written/u,
    );
  });

  /*
    The builder client gives up on an enhancement after 45 s
    (remote-provider.ts, DEFAULT_ENHANCE_TIMEOUT_MS); this server's cap was
    60 s. So the client always hung up first and the panel said only "took
    longer than allowed", while the server — the side that knew why — was
    still waiting. The server's cap must end first.
  */
  it("stops by default before the builder client's 45 s wait runs out", async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      const { client } = enhancing(JSON.stringify(ENHANCED));
      await createHandler({ client })(enhanceRequest(REQUEST_BODY));

      const capMs = timeout.mock.calls[0]?.[0];
      expect(capMs).toBeGreaterThan(0);
      expect(capMs).toBeLessThan(45_000);
    } finally {
      timeout.mockRestore();
    }
  });

  it('leaves /plan exactly as it was beside it', async () => {
    const handle = createHandler({ client: fakeClient(planAnswer()) });

    expect(await (await handle(post(wireBody()))).json()).toEqual(PLAN);
    const unknownPath = await handle(
      new Request('http://localhost/v1/prompt/other', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(REQUEST_BODY),
      }),
    );
    expect(unknownPath.status).toBe(404);
  });
});

/*
  Page-plan drafts (DESIGN §5.1, 2026-10-05). A streamed page plan also
  carries the model's raw text while it is written, as `event: draft` frames,
  so the client can land the skeleton and start each section writer on the
  part of the plan that has closed. Coalesced (every DRAFT_FLUSH_MS, or at
  DRAFT_FLUSH_CHARS), always flushed before the one `result`; a backend that
  starts over sends `{reset: true}` and the unsent text is dropped. Unary
  answers and every other task are exactly as before.
*/
describe('page-plan drafts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const ANSWER = JSON.stringify({
    rationale: PAGE_PLAN_EXAMPLE.rationale,
    pagePlan: PAGE_PLAN_EXAMPLE.pagePlan,
  });

  /** A backend the test writes through by hand, answering when released. */
  function liveClient(text: string = ANSWER) {
    const listeners = new Map<string, (...args: string[]) => void>();
    const subscribed: string[] = [];
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const client = {
      messages: {
        stream: () => ({
          on: (event: string, listener: (...args: string[]) => void) => {
            subscribed.push(event);
            listeners.set(event, listener);
          },
          finalMessage: async () => {
            await released;
            return {
              stop_reason: 'end_turn',
              stop_details: null,
              content: [{ type: 'text', text }],
              usage: { input_tokens: 900, output_tokens: 700 },
            };
          },
        }),
      },
    } as unknown as Anthropic;
    return {
      client,
      subscribed,
      write: (delta: string) => {
        // The SDK's (delta, snapshot); only the delta may become a draft.
        listeners.get('text')?.(delta, `snapshot:${delta}`);
      },
      restart: () => {
        listeners.get('restart')?.();
      },
      release: () => {
        release();
      },
    };
  }

  interface Frame {
    readonly event: string;
    readonly data: unknown;
  }

  function framesOf(body: string): Frame[] {
    return [...body.matchAll(/event: (\w+)\ndata: (.*)\n\n/gu)].map((match) => ({
      event: match[1] ?? '',
      data: JSON.parse(match[2] ?? 'null') as unknown,
    }));
  }

  function pagePlanBody(overrides: Record<string, unknown> = {}): unknown {
    return wireBody({ request: 'Build a page for my roastery', task: 'page-plan', ...overrides });
  }

  const STREAM = { accept: 'text/event-stream' };

  it('sends the coalesced draft text before exactly one result', async () => {
    const live = liveClient();
    const response = await createHandler({ client: live.client })(post(pagePlanBody(), STREAM));
    const pieces = ANSWER.match(/[\s\S]{1,7}/gu) ?? [];
    for (const piece of pieces) live.write(piece);
    live.release();

    const frames = framesOf(await new Response(response.body).text());
    const drafts = frames.filter((entry) => entry.event === 'draft');
    const results = frames.filter((entry) => entry.event === 'result');

    expect(drafts.length).toBeGreaterThan(0);
    // Coalesced: far fewer frames than deltas.
    expect(drafts.length).toBeLessThan(pieces.length);
    expect(drafts.map((entry) => (entry.data as { text: string }).text).join('')).toBe(ANSWER);
    expect(results).toHaveLength(1);
    expect(frames.at(-1)?.event).toBe('result');
    expect(results[0]?.data).toMatchObject({ version: 1, pagePlan: PAGE_PLAN_EXAMPLE.pagePlan });
  });

  it(`flushes every ${String(DRAFT_FLUSH_MS)} ms or at ${String(DRAFT_FLUSH_CHARS)} characters`, async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const live = liveClient();
    const response = await createHandler({ client: live.client })(post(pagePlanBody(), STREAM));
    const long = 'x'.repeat(DRAFT_FLUSH_CHARS);

    live.write('ab');
    await vi.advanceTimersByTimeAsync(DRAFT_FLUSH_MS - 1);
    live.write('cd');
    await vi.advanceTimersByTimeAsync(1);
    live.write('ef');
    live.write(long);
    live.write('gh');
    live.release();

    const drafts = framesOf(await new Response(response.body).text())
      .filter((entry) => entry.event === 'draft')
      .map((entry) => entry.data);
    expect(drafts).toEqual([{ text: 'abcd' }, { text: `ef${long}` }, { text: 'gh' }]);
  });

  it('drops the unsent text on a reset and says {reset: true}', async () => {
    const live = liveClient();
    const response = await createHandler({ client: live.client })(post(pagePlanBody(), STREAM));

    live.write('{"from":"the failed model');
    live.restart();
    live.write('{"from":"cli"}');
    live.release();

    const frames = framesOf(await new Response(response.body).text());
    expect(
      frames
        .filter((entry) => entry.event === 'draft' || entry.event === 'result')
        .map((entry) => entry.data),
    ).toEqual([
      { reset: true },
      { text: '{"from":"cli"}' },
      expect.objectContaining({ version: 1 }),
    ]);
  });

  it('sends no drafts when the deployment turned them off', async () => {
    const live = liveClient();
    const response = await createHandler({ client: live.client, planDrafts: false })(
      post(pagePlanBody(), STREAM),
    );
    live.write('{"rationale"');
    live.release();

    const frames = framesOf(await new Response(response.body).text());
    expect(frames.some((entry) => entry.event === 'draft')).toBe(false);
    expect(frames.filter((entry) => entry.event === 'result')).toHaveLength(1);
    expect(live.subscribed).toContain('text'); // Public lifecycle signal, not raw drafts.
  });

  it('sends no drafts for an ordinary plan', async () => {
    const live = liveClient(JSON.stringify(PLAN));
    const response = await createHandler({ client: live.client })(post(wireBody(), STREAM));
    live.write('{"rationale"');
    live.release();

    const frames = framesOf(await new Response(response.body).text());
    expect(frames.some((entry) => entry.event === 'draft')).toBe(false);
    expect(frames.filter((entry) => entry.event === 'result')).toHaveLength(1);
    expect(live.subscribed).toContain('text'); // Public lifecycle signal, not raw drafts.
  });

  it('answers a unary page plan exactly as before, with no draft subscription', async () => {
    const live = liveClient();
    const pending = createHandler({ client: live.client })(post(pagePlanBody()));
    live.release();
    const response = await pending;

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({
      version: 1,
      rationale: PAGE_PLAN_EXAMPLE.rationale,
      pagePlan: PAGE_PLAN_EXAMPLE.pagePlan,
    });
    expect(live.subscribed).toContain('restart'); // Cache/progress subscription; the response is JSON.
  });
});
