import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import { batchBackendFor } from './api-models';
import type { BatchCapability } from './batch-routes';
import { withCors } from './cors';
import { createHandler, type HandlerOptions } from './handler';
import { PAGE_PLAN_EXAMPLE } from './plan-shape';
import { createRoutingClient } from './routing-client';

/**
 * Background batches against a faked Anthropic client: no test here calls the API.
 *
 * What is verified is the promise the routes make — an item is held to /plan's checks, is
 * sent as exactly the request /plan would have streamed, and comes back as exactly the body
 * /plan would have answered — plus the refusals: a server or a model that cannot batch.
 */

type Message = Record<string, unknown>;
type Individual = Anthropic.Messages.MessageBatchIndividualResponse;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rationale: { type: 'string' },
    commands: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { command: { type: 'string' }, args: {} },
      },
    },
  },
};

function wire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    request: 'Translate the headline',
    context: {
      fragments: [],
      totalTokens: 0,
      blocks: [],
      document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
      selection: { ids: [] },
      commands: [{ name: 'setProp', argsSchema: { type: 'object' } }],
      outputContract: { version: 1, schema: SCHEMA },
    },
    ...overrides,
  };
}

const PLAN = {
  rationale: 'Headline in Arabic.',
  commands: [{ command: 'setProp', args: { id: 'h', key: 'text', value: 'مرحبا' } }],
};

function message(overrides: Message = {}): Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    stop_reason: 'end_turn',
    stop_details: null,
    content: [{ type: 'text', text: JSON.stringify(PLAN) }],
    usage: {
      input_tokens: 120,
      output_tokens: 40,
      cache_read_input_tokens: 9_000,
      cache_creation_input_tokens: 0,
    },
    ...overrides,
  };
}

function batch(id: string, status: 'in_progress' | 'canceling' | 'ended'): unknown {
  return {
    id,
    type: 'message_batch',
    processing_status: status,
    request_counts: {
      processing: status === 'ended' ? 0 : 2,
      succeeded: status === 'ended' ? 2 : 0,
      errored: 0,
      canceled: 0,
      expired: 0,
    },
    created_at: '2026-10-12T10:00:00Z',
    ended_at: status === 'ended' ? '2026-10-12T10:40:00Z' : null,
    expires_at: '2026-10-13T10:00:00Z',
    archived_at: null,
    cancel_initiated_at: null,
    results_url: status === 'ended' ? 'https://api.example/results' : null,
  };
}

/** A stream the handler, the routing client and the cache gate all read. */
function stream(answer: Message): unknown {
  return {
    on: () => undefined,
    finalMessage: () => Promise.resolve(answer),
  };
}

/** A client that streams `answer` live and keeps every batch it is sent, for the API's half of a batch. */
function fakeApi(results: () => readonly Individual[] = () => [], answer: Message = message()) {
  const streamed: unknown[] = [];
  const created: Anthropic.Messages.BatchCreateParams[] = [];
  let status: 'in_progress' | 'canceling' | 'ended' = 'in_progress';
  const known = (id: string): void => {
    if (id !== 'msgbatch_1') {
      throw new Anthropic.NotFoundError(404, undefined, 'not found', new Headers());
    }
  };
  const client = {
    apiKey: 'test-key',
    authToken: null,
    messages: {
      stream: (params: unknown) => {
        streamed.push(params);
        return stream(answer);
      },
      batches: {
        create: (params: Anthropic.Messages.BatchCreateParams) => {
          created.push(params);
          return Promise.resolve(batch('msgbatch_1', status));
        },
        retrieve: (id: string) => {
          known(id);
          return Promise.resolve(batch(id, status));
        },
        cancel: (id: string) => {
          known(id);
          status = 'canceling';
          return Promise.resolve(batch(id, status));
        },
        results: (id: string) => {
          known(id);
          const entries = results();
          return Promise.resolve(
            (async function* () {
              // One line of JSONL at a time, as the SDK's decoder hands them over.
              for (const entry of entries) yield await Promise.resolve(entry);
            })(),
          );
        },
      },
    },
  } as unknown as Anthropic;
  return {
    client,
    streamed,
    created,
    end: () => {
      status = 'ended';
    },
  };
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, { headers });
}

function handlerOn(api: Anthropic, options: Partial<HandlerOptions> = {}) {
  const batches: BatchCapability = { client: api, route: 'sdk' };
  return createHandler({ client: api, batches, ...options });
}

/** What /plan answers when the model answers `answer`: the body a batch item must equal. */
async function livePlanBody(answer: Message, body: unknown = wire()): Promise<unknown> {
  const response = await createHandler({ client: fakeApi(() => [], answer).client })(
    post('/plan', body),
  );
  return response.json();
}

describe('POST /batch', () => {
  it('sends every item as the very request /plan would stream for it', async () => {
    const pinned = (id: string): Record<string, unknown> =>
      wire({
        context: {
          ...(wire()['context'] as Record<string, unknown>),
          skills: [{ id, version: '1.0.0', contentFingerprint: 'x', reason: 'explicit' }],
        },
      });
    const variants: readonly { body: Record<string, unknown>; headers?: Record<string, string> }[] =
      [
        { body: wire() },
        { body: wire({ effort: 'low' }) },
        { body: wire(), headers: { 'x-craftkit-ai-effort': 'max' } },
        {
          body: wire({
            history: [
              { role: 'user', text: 'Earlier' },
              { role: 'assistant', text: 'Done.' },
            ],
          }),
        },
        { body: wire({ task: 'page-plan' }) },
        { body: pinned('craftkit.build-fill') },
        { body: wire({ freeCode: true }) },
        { body: wire(), headers: { 'x-craftkit-ai-model': 'claude-opus-5-5' } },
      ];
    for (const { body, headers = {} } of variants) {
      const api = fakeApi();
      const handle = handlerOn(api.client, {
        model: 'claude-opus-5',
        models: ['claude-opus-5-5'],
        sectionEffort: 'low',
        maxTokens: 24_000,
      });

      await handle(post('/plan', body, headers));
      const response = await handle(
        post('/batch', { version: 1, items: [{ id: 'a', request: body }] }, headers),
      );

      expect(response.status).toBe(200);
      expect(api.streamed).toHaveLength(1);
      expect(api.created[0]?.requests[0]?.params).toEqual(api.streamed[0]);
    }
  });

  it('sends an api: model as the routing client sends it live, schema and all', async () => {
    const api = fakeApi();
    const live = createRoutingClient({
      openrouter: fakeApi().client,
      cli: () => fakeApi().client,
      api: api.client,
    });
    const options = { model: 'vendor/model', models: ['api:claude-haiku-5-5'] };
    await createHandler({ client: live, ...options })(
      post('/plan', wire(), { 'x-craftkit-ai-model': 'api:claude-haiku-5-5' }),
    );
    const handle = createHandler({
      client: live,
      batches: { client: api.client, route: 'api' },
      ...options,
    });

    const response = await handle(
      post('/batch', {
        version: 1,
        model: 'api:claude-haiku-5-5',
        items: [{ id: 'a', request: wire() }],
      }),
    );

    expect(response.status).toBe(200);
    expect(api.streamed).toHaveLength(1);
    expect(api.created[0]?.requests[0]?.params).toEqual(api.streamed[0]);
    expect(api.created[0]?.requests[0]?.params).toMatchObject({ model: 'claude-haiku-5-5' });
    expect(api.created[0]?.requests[0]?.params).not.toHaveProperty('output_config.format');
  });

  it('caches with one-hour breakpoints, and marks each custom_id with its task', async () => {
    const api = fakeApi();
    const response = await handlerOn(api.client)(
      post('/batch', {
        version: 1,
        items: [
          {
            id: 'home',
            request: wire({
              history: [
                { role: 'user', text: 'Hi' },
                { role: 'assistant', text: 'Hello.' },
              ],
            }),
          },
          { id: 'about-page', request: wire({ task: 'page-plan' }) },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      version: 1,
      id: 'msgbatch_1',
      status: 'in_progress',
      counts: { processing: 2, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
      createdAt: '2026-10-12T10:00:00Z',
      endedAt: null,
      expiresAt: '2026-10-13T10:00:00Z',
    });
    const requests = api.created[0]?.requests ?? [];
    expect(requests.map(({ custom_id }) => custom_id)).toEqual(['p-home', 'g-about-page']);
    const marks = JSON.stringify(requests[0]?.params).match(/"cache_control":\{[^}]*\}/gu) ?? [];
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(mark).toBe('"cache_control":{"type":"ephemeral","ttl":"1h"}');
  });

  it('holds every item to /plan’s checks and names the item it refuses', async () => {
    const handle = handlerOn(fakeApi().client, { models: [] });
    const refused = async (body: unknown, headers: Record<string, string> = {}) => {
      const response = await handle(post('/batch', body, headers));
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    };

    expect((await refused({ version: 2, items: [] })).status).toBe(400);
    expect((await refused({ version: 1, items: [] })).status).toBe(400);
    const many = Array.from({ length: 101 }, (_, at) => ({
      id: `i${String(at)}`,
      request: wire(),
    }));
    expect((await refused({ version: 1, items: many })).status).toBe(400);
    const twice = await refused({
      version: 1,
      items: [
        { id: 'a', request: wire() },
        { id: 'a', request: wire() },
      ],
    });
    expect(twice.body['error']).toMatch(/appears twice/u);
    expect((await refused({ version: 1, items: [{ id: 'a b', request: wire() }] })).status).toBe(
      400,
    );
    const task = await refused({
      version: 1,
      items: [
        { id: 'ok', request: wire() },
        { id: 'odd', request: wire({ task: 'poem' }) },
      ],
    });
    expect(task).toEqual({
      status: 400,
      body: { error: 'Item "odd": Unknown task "poem".', item: 'odd' },
    });
    // A site plan (T230) is a live call; a batch has no reader for one.
    const site = await refused({
      version: 1,
      items: [{ id: 'site', request: wire({ task: 'site-plan' }) }],
    });
    expect(site).toEqual({
      status: 400,
      body: { error: 'Item "site": A site plan is not batched.', item: 'site' },
    });
    const model = await refused({
      version: 1,
      model: 'claude-mythos-5',
      items: [{ id: 'a', request: wire() }],
    });
    expect(model.body['error']).toBe(
      'Item "a": Model "claude-mythos-5" is not one this server allows.',
    );
    const contract = await refused({
      version: 1,
      items: [
        {
          id: 'a',
          request: wire({ context: { ...(wire()['context'] as object), outputContract: null } }),
        },
      ],
    });
    expect(contract.status).toBe(400);
    expect(
      (await refused({ version: 1, items: [{ id: 'a', request: { version: 1 } }] })).status,
    ).toBe(400);
  });

  it('shares /plan’s bearer and size rules, and CORS through the same wrapper', async () => {
    const api = fakeApi();
    const handle = handlerOn(api.client, { authToken: 'secret', maxRequestBytes: 4_000 });
    const one = { version: 1, items: [{ id: 'a', request: wire() }] };

    expect((await handle(post('/batch', one))).status).toBe(401);
    expect((await handle(get('/batch/msgbatch_1'))).status).toBe(401);
    const big = { version: 1, items: [{ id: 'a', request: wire({ request: 'x'.repeat(5_000) }) }] };
    expect((await handle(post('/batch', big, { authorization: 'Bearer secret' }))).status).toBe(
      413,
    );
    expect((await handle(post('/batch', one, { authorization: 'Bearer secret' }))).status).toBe(
      200,
    );

    const browser = withCors(handle, (origin) => origin === 'http://localhost:5173');
    const allowed = await browser(
      get('/batch/msgbatch_1', { authorization: 'Bearer secret', origin: 'http://localhost:5173' }),
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const foreign = await browser(get('/batch/msgbatch_1', { origin: 'https://evil.example' }));
    expect(foreign.status).toBe(403);
  });
});

describe('a server or a model that cannot batch', () => {
  it('answers 501 naming what is missing, before reading the body', async () => {
    for (const batches of [
      batchBackendFor('cli', fakeApi().client, ['cli:haiku'], 'key'),
      batchBackendFor('openrouter', fakeApi().client, ['vendor/model'], 'key'),
      batchBackendFor('openrouter', fakeApi().client, ['api:claude-haiku-5-5'], undefined),
      batchBackendFor(
        'sdk',
        { apiKey: null, authToken: null } as unknown as Anthropic,
        [],
        undefined,
      ),
    ]) {
      const handle = createHandler({ client: fakeApi().client, batches });
      const response = await handle(
        post('/batch', { version: 1, items: [{ id: 'a', request: wire() }] }),
      );

      expect(response.status).toBe(501);
      expect(((await response.json()) as { error: string }).error).toMatch(/ANTHROPIC_API_KEY/u);
    }
    const unset = await createHandler({ client: fakeApi().client })(get('/batch/msgbatch_1'));
    expect(unset.status).toBe(501);
  });

  it('runs batches on the sdk backend with a key, and on api: models beside OpenRouter', () => {
    const api = fakeApi().client;
    expect(batchBackendFor('sdk', api, [], undefined)).toEqual({ client: api, route: 'sdk' });
    expect(
      batchBackendFor('openrouter', api, ['vendor/model', 'api:claude-haiku-5-5'], 'k'),
    ).toMatchObject({
      route: 'api',
    });
  });

  it('answers 409 for an item whose model only the CLI or OpenRouter serves', async () => {
    const api = fakeApi();
    const handle = createHandler({
      client: api.client,
      batches: { client: api.client, route: 'api' },
      model: 'vendor/model',
      models: ['cli:haiku', 'api:claude-haiku-5-5'],
    });

    for (const model of ['vendor/model', 'cli:haiku']) {
      const response = await handle(
        post('/batch', { version: 1, model, items: [{ id: 'a', request: wire() }] }),
      );
      expect(response.status).toBe(409);
      expect(((await response.json()) as { error: string }).error).toMatch(
        /cannot run in a batch/u,
      );
    }
    expect(api.created).toHaveLength(0);
  });
});

describe('GET /batch/:id/results', () => {
  const answers = {
    plan: message(),
    refusal: message({
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: null, explanation: 'Not this one.' },
      content: [],
    }),
    cut: message({ stop_reason: 'max_tokens' }),
    impossible: message({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            rationale: 'No such page.',
            commands: [{ command: 'impossible', args: {} }],
          }),
        },
      ],
    }),
    fenced: message({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(PLAN) + ',\n```' }],
    }),
  };

  /** Mixed results, in an order unlike the batch's own. */
  const shuffled = (): readonly Individual[] =>
    [
      { custom_id: 'p-cut', result: { type: 'succeeded', message: answers.cut } },
      { custom_id: 'p-lost', result: { type: 'expired' } },
      { custom_id: 'p-plan', result: { type: 'succeeded', message: answers.plan } },
      {
        custom_id: 'p-broken',
        result: {
          type: 'errored',
          error: {
            type: 'error',
            request_id: null,
            error: { type: 'invalid_request_error', message: 'raw API prose' },
          },
        },
      },
      { custom_id: 'p-impossible', result: { type: 'succeeded', message: answers.impossible } },
      { custom_id: 'p-stopped', result: { type: 'canceled' } },
      { custom_id: 'p-refusal', result: { type: 'succeeded', message: answers.refusal } },
      { custom_id: 'p-fenced', result: { type: 'succeeded', message: answers.fenced } },
      {
        custom_id: 'g-page',
        result: {
          type: 'succeeded',
          message: message({
            content: [{ type: 'text', text: JSON.stringify(PAGE_PLAN_EXAMPLE) }],
          }),
        },
      },
    ] as unknown as readonly Individual[];

  async function sentAndEnded(
    results: () => readonly Individual[] = shuffled,
    options: Partial<HandlerOptions> = {},
  ) {
    const api = fakeApi(results);
    const handle = handlerOn(api.client, options);
    const items = [
      'cut',
      'lost',
      'plan',
      'broken',
      'impossible',
      'stopped',
      'refusal',
      'fenced',
    ].map((id) => ({
      id,
      request: wire(),
    }));
    await handle(
      post('/batch', {
        version: 1,
        items: [...items, { id: 'page', request: wire({ task: 'page-plan' }) }],
      }),
    );
    return { api, handle };
  }

  it('answers 409 until the batch has ended, then every item, keyed by its id', async () => {
    const usage: unknown[] = [];
    const { api, handle } = await sentAndEnded(shuffled, { onUsage: (line) => usage.push(line) });

    const early = await handle(get('/batch/msgbatch_1/results'));
    expect(early.status).toBe(409);
    expect(
      ((await (await handle(get('/batch/msgbatch_1'))).json()) as { status: string }).status,
    ).toBe('in_progress');

    api.end();
    const response = await handle(get('/batch/msgbatch_1/results'));
    expect(response.status).toBe(200);
    const read = (await response.json()) as {
      version: number;
      id: string;
      items: { id: string }[];
    };
    expect(read.version).toBe(1);
    expect(read.id).toBe('msgbatch_1');
    const byId = new Map(read.items.map((item) => [item.id, item]));
    expect(byId.size).toBe(9);

    for (const id of ['plan', 'refusal', 'cut', 'impossible', 'fenced'] as const) {
      expect(byId.get(id)).toMatchObject({ body: await livePlanBody(answers[id]) });
    }
    expect(byId.get('plan')).toEqual({
      id: 'plan',
      body: PLAN,
      usage: {
        inputTokens: 120,
        outputTokens: 40,
        cacheReadTokens: 9_000,
        cacheWriteTokens: 0,
        costUsd: null,
      },
    });
    expect(byId.get('refusal')).toMatchObject({ body: { version: 1, refusal: 'Not this one.' } });
    expect(byId.get('cut')).toMatchObject({ body: { version: 1, invalidOutput: {} } });
    expect(byId.get('page')).toMatchObject({
      body: { version: 1, pagePlan: { intent: 'new-page' } },
    });
    expect(byId.get('broken')).toEqual({
      id: 'broken',
      error: {
        type: 'invalid_request_error',
        message: 'The assistant rejected this request as malformed.',
      },
    });
    expect(byId.get('lost')).toMatchObject({ error: { type: 'expired' } });
    expect(byId.get('stopped')).toMatchObject({ error: { type: 'canceled' } });
    expect(JSON.stringify(read)).not.toContain('raw API prose');
    // Logged once per batch, however often its results are read.
    const logged = usage.length;
    expect(logged).toBe(6);
    await handle(get('/batch/msgbatch_1/results'));
    expect(usage).toHaveLength(logged);
  });

  it('still reads a batch sent before this server started, without its shape judges', async () => {
    const lines: string[] = [];
    const { api } = await sentAndEnded();
    api.end();
    const restarted = handlerOn(api.client, { onLog: (line) => lines.push(line) });

    const response = await restarted(get('/batch/msgbatch_1/results'));

    expect(response.status).toBe(200);
    const { items } = (await response.json()) as { items: { id: string; body?: unknown }[] };
    expect(items.find(({ id }) => id === 'plan')?.body).toEqual(PLAN);
    expect(lines.some((line) => line.includes('without its shape judges'))).toBe(true);
  });
});

describe('GET /batch/:id and POST /batch/:id/cancel', () => {
  it('reports the state, cancels, and says 404 for a batch the API does not know', async () => {
    const api = fakeApi();
    const handle = handlerOn(api.client);

    const cancelled = await handle(post('/batch/msgbatch_1/cancel', {}));
    expect(cancelled.status).toBe(200);
    expect(((await cancelled.json()) as { status: string }).status).toBe('canceling');
    expect((await handle(get('/batch/msgbatch_9'))).status).toBe(404);
    expect((await handle(get('/batch/not%20an%20id'))).status).toBe(404);
    expect((await handle(get('/batch/msgbatch_1/elsewhere'))).status).toBe(404);
    expect((await handle(get('/batch'))).status).toBe(405);
    expect((await handle(post('/batch/msgbatch_1', {}))).status).toBe(405);
  });
});
