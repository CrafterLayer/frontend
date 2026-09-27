import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { createHandler } from './handler';

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
    expect(body).toContain('Reading the catalog');
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

  it('reports nothing for an answer that never became a plan', async () => {
    const onUsage = vi.fn();
    const handle = createHandler({
      client: fakeClient({ stop_reason: 'refusal', stop_details: { explanation: 'No.' } }),
      onUsage,
    });

    await handle(post(wireBody()));

    expect(onUsage).not.toHaveBeenCalled();
  });
});

describe('per-call reasoning budget', () => {
  function recordingClient(): { client: Anthropic; seen: unknown[] } {
    const seen: unknown[] = [];
    const client = {
      messages: {
        stream: (_params: unknown, requestOptions: unknown) => {
          seen.push(requestOptions);
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
});
