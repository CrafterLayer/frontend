import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import type { AiSceneReviewWireRequest } from '@craftkit/builder/wire';

import { PREWARM_MIN_SHARERS, prewarmPlan } from './batch-prewarm';
import { createHandler, type HandlerOptions } from './handler';
import { PROMPT_CACHE } from './prompt-cache';
import { createRoutingClient } from './routing-client';

/*
  Batches and the prompt cache together (2026-10-13), against a faked Anthropic client — no test
  here calls the API: every item carries its live call's one-hour breakpoints; a background
  build's scene reviews ride /batch and come back as /v1/scene/review's body; one live warm call
  goes first when three or more items share a cacheable prefix the call can match; and an item
  that wrote the cache anyway says why, as a live call does.
*/

type Individual = Anthropic.Messages.MessageBatchIndividualResponse;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { rationale: { type: 'string' }, commands: { type: 'array', items: {} } },
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

const REVIEW: AiSceneReviewWireRequest = {
  version: 1,
  lang: 'en',
  contract: { title: 'Night garden', purpose: 'Layla collects fireflies.', mustSay: [] },
  brief: { palette: ['bg #101820', 'accent #f2c14e'], cast: ['Layla (hero, teal)'] },
  images: [
    { view: 'desktop', mediaType: 'image/jpeg', base64: 'REVTSw==', width: 640, height: 360 },
  ],
};

const VERDICT = {
  ok: false,
  findings: [{ where: 'desktop', problem: 'The title is unreadable.', fix: 'Add a scrim.' }],
};

function message(text: string, usage: Record<string, number> = {}): Record<string, unknown> {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    stop_reason: 'end_turn',
    stop_details: null,
    content: [{ type: 'text', text }],
    usage: { input_tokens: 900, output_tokens: 60, ...usage },
  };
}

function batch(status: 'in_progress' | 'ended'): unknown {
  const done = status === 'ended';
  return {
    id: 'msgbatch_1',
    type: 'message_batch',
    processing_status: status,
    request_counts: { processing: done ? 0 : 3, succeeded: done ? 3 : 0 },
    created_at: '2026-10-13T10:00:00Z',
    ended_at: done ? '2026-10-13T10:20:00Z' : null,
    expires_at: '2026-10-14T10:00:00Z',
  };
}

/** A client that streams `answer` live, answers a warm call, and keeps every batch it is sent. */
function fakeApi(
  answer: Record<string, unknown>,
  results: readonly Individual[] = [],
  warm: () => Promise<unknown> = () =>
    Promise.resolve({ ...message(''), content: [], stop_reason: 'max_tokens' }),
) {
  const streamed: Record<string, unknown>[] = [];
  const warmed: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const created: Anthropic.Messages.BatchCreateParams[] = [];
  let ended = false;
  // Built as the SDK would build it, so the live review endpoint may show it a picture.
  const client = Object.create(Anthropic.prototype) as Anthropic;
  Object.assign(client, {
    apiKey: 'test-key',
    authToken: null,
    messages: {
      stream: (params: Record<string, unknown>) => {
        streamed.push(params);
        return { on: () => undefined, finalMessage: () => Promise.resolve(answer) };
      },
      create: (params: Anthropic.MessageCreateParamsNonStreaming) => {
        warmed.push(params);
        return warm();
      },
      batches: {
        create: (params: Anthropic.Messages.BatchCreateParams) => {
          created.push(params);
          return Promise.resolve(batch('in_progress'));
        },
        retrieve: () => Promise.resolve(batch(ended ? 'ended' : 'in_progress')),
        results: () =>
          Promise.resolve(
            (async function* () {
              for (const entry of results) yield await Promise.resolve(entry);
            })(),
          ),
      },
    },
  });
  return {
    client,
    streamed,
    warmed,
    created,
    end: () => {
      ended = true;
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

/** Every cache breakpoint of a request, in order. */
function marks(params: unknown): string[] {
  return JSON.stringify(params).match(/"cache_control":\{[^}]*\}/gu) ?? [];
}

/** A server whose api: models run on `api` (the hybrid's batch backend), live and batched. */
function hybrid(api: ReturnType<typeof fakeApi>, options: Partial<HandlerOptions> = {}) {
  const live = createRoutingClient({
    openrouter: fakeApi(message('')).client,
    cli: () => fakeApi(message('')).client,
    api: api.client,
  });
  return createHandler({
    client: live,
    batches: { client: api.client, route: 'api' },
    model: 'vendor/model',
    models: ['api:claude-haiku-5-5'],
    ...options,
  });
}

const PICKED = { 'x-craftkit-ai-model': 'api:claude-haiku-5-5' };

describe('batch items and their live calls', () => {
  it('carry the same one-hour breakpoints, plan and review alike, on both routes', async () => {
    const sdk = fakeApi(message(JSON.stringify(VERDICT)));
    const direct = createHandler({
      client: sdk.client,
      batches: { client: sdk.client, route: 'sdk' },
    });
    await direct(post('/plan', wire()));
    await direct(post('/v1/scene/review', REVIEW));
    await direct(
      post('/batch', {
        version: 1,
        items: [
          { id: 'p', request: wire() },
          { id: 'r', review: REVIEW },
        ],
      }),
    );
    const [plan, review] = sdk.created[0]?.requests ?? [];
    expect(plan?.params).toEqual(sdk.streamed[0]);
    expect(review?.params).toEqual(sdk.streamed[1]);
    expect(review?.custom_id).toBe('r-r');
    expect(marks(plan?.params).length).toBeGreaterThan(0);
    for (const mark of marks(plan?.params))
      expect(mark).toBe('"cache_control":{"type":"ephemeral","ttl":"1h"}');

    const api = fakeApi(message(JSON.stringify(VERDICT)));
    const handle = hybrid(api);
    await handle(post('/plan', wire(), PICKED));
    await handle(post('/v1/scene/review', REVIEW, PICKED));
    await handle(
      post('/batch', {
        version: 1,
        model: 'api:claude-haiku-5-5',
        items: [
          { id: 'p', request: wire() },
          { id: 'r', review: REVIEW },
        ],
      }),
    );
    const sent = api.created[0]?.requests ?? [];
    // The live plan also asks the API why it missed (cache-doctor.ts); nothing else differs.
    const { diagnostics, ...livePlan } = api.streamed[0] ?? {};
    expect(diagnostics).toEqual({ previous_message_id: null });
    expect(sent[0]?.params).toEqual(livePlan);
    expect(sent[1]?.params).toEqual(api.streamed[1]);
    expect(marks(sent[0]?.params)).toEqual(marks(livePlan));
    expect(marks(sent[0]?.params).every((mark) => mark.includes('"ttl":"1h"'))).toBe(true);
  });
});

describe('a scene review in a batch', () => {
  it('meets the review door, and names the item it refuses', async () => {
    const api = fakeApi(message(''));
    const handle = createHandler({
      client: api.client,
      batches: { client: api.client, route: 'sdk' },
    });
    const refused = async (items: unknown[], headers: Record<string, string> = {}) => {
      const response = await handle(post('/batch', { version: 1, items }, headers));
      return { status: response.status, body: (await response.json()) as { error: string } };
    };
    const blank = await refused([{ id: 'r', review: { ...REVIEW, images: [] } }]);
    expect(blank).toEqual({
      status: 400,
      body: { error: 'Item "r": A scene review carries one or two images.', item: 'r' },
    });
    const both = await refused([{ id: 'x', request: wire(), review: REVIEW }]);
    expect(both.body.error).toMatch(/both a "request" and a "review"/u);
    const effort = await refused([{ id: 'r', review: REVIEW }], { 'x-craftkit-ai-effort': 'huge' });
    expect(effort.status).toBe(400);
    expect(api.created).toHaveLength(0);
  });

  it('runs on the fastest model of the picked route, and answers the live endpoint’s body', async () => {
    const answer = message(JSON.stringify(VERDICT), { cache_read_input_tokens: 0 });
    const usage: { task?: string }[] = [];
    const results = [
      { custom_id: 'r-hero', result: { type: 'succeeded', message: answer } },
    ] as unknown as readonly Individual[];
    const api = fakeApi(answer, results);
    const handle = createHandler({
      client: api.client,
      batches: { client: api.client, route: 'sdk' },
      model: 'claude-opus-5-5',
      models: ['claude-haiku-5-5'],
      onUsage: (line) => usage.push(line),
    });
    const live = await (await handle(post('/v1/scene/review', REVIEW))).json();
    await handle(post('/batch', { version: 1, items: [{ id: 'hero', review: REVIEW }] }));
    api.end();

    const read = (await (
      await handle(new Request('http://localhost/batch/msgbatch_1/results'))
    ).json()) as { items: { id: string; body: unknown; usage: unknown }[] };

    expect(api.created[0]?.requests[0]?.params).toMatchObject({ model: 'claude-haiku-5-5' });
    expect(read.items).toEqual([
      {
        id: 'hero',
        body: live,
        usage: expect.objectContaining({ inputTokens: 900, outputTokens: 60 }) as unknown,
      },
    ]);
    expect(usage.map(({ task }) => task)).toEqual(['scene-review', 'scene-review']);
  });
});

describe('the warm call', () => {
  const three = [
    { id: 'home', request: wire() },
    { id: 'about', request: wire() },
    { id: 'contact', request: wire() },
  ];

  it('goes first, live, with exactly the prefix three items share, and says what it cost', async () => {
    const api = fakeApi(message(''), [], () =>
      Promise.resolve({
        ...message(''),
        content: [],
        stop_reason: 'max_tokens',
        usage: { input_tokens: 4, output_tokens: 0, cache_creation_input_tokens: 6_100 },
      }),
    );
    const usage: { task?: string; cacheWriteTokens: number | null }[] = [];
    const lines: string[] = [];
    const handle = hybrid(api, {
      onUsage: (line) => usage.push(line),
      onLog: (line) => lines.push(line),
    });

    const response = await handle(
      post('/batch', { version: 1, model: 'api:claude-haiku-5-5', items: three }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: 'msgbatch_1',
      warmUsage: { cacheWriteTokens: 6_100, outputTokens: 0 },
    });
    expect(api.warmed).toHaveLength(1);
    const [warm] = api.warmed;
    const item: Anthropic.MessageCreateParamsNonStreaming | undefined =
      api.created[0]?.requests[0]?.params;
    const system = (item?.system ?? []) as Anthropic.TextBlockParam[];
    const last = system.map((block) => block.cache_control !== undefined).lastIndexOf(true);
    expect(warm).toEqual({
      model: 'claude-haiku-5-5',
      max_tokens: 0,
      ...(item?.thinking === undefined ? {} : { thinking: item.thinking }),
      ...(item?.output_config == null ? {} : { output_config: item.output_config }),
      system: system.slice(0, last + 1),
      messages: [{ role: 'user', content: 'warmup' }],
    });
    expect(warm).not.toHaveProperty('stream');
    expect(warm?.system?.at(-1)).toMatchObject({ cache_control: PROMPT_CACHE });
    expect(usage.map(({ task }) => task)).toEqual(['cache-warm']);
    expect(lines.some((line) => line.includes('warmed a ~'))).toBe(true);
  });

  it('is not sent for fewer than three sharers, nor where structured outputs decode the items', async () => {
    const two = fakeApi(message(''));
    await hybrid(two)(
      post('/batch', { version: 1, model: 'api:claude-haiku-5-5', items: three.slice(0, 2) }),
    );
    expect(two.warmed).toHaveLength(0);
    expect(two.created).toHaveLength(1);

    // The sdk backend sends `output_config.format`: no zero-token call can match that prefix.
    const sdk = fakeApi(message(''));
    await createHandler({ client: sdk.client, batches: { client: sdk.client, route: 'sdk' } })(
      post('/batch', { version: 1, items: three }),
    );
    expect(sdk.warmed).toHaveLength(0);
    expect(sdk.created[0]?.requests[0]?.params.output_config?.format).toBeDefined();
  });

  it('never costs the batch: a failed warm call is logged and the batch still goes', async () => {
    const api = fakeApi(message(''), [], () => Promise.reject(new Error('overloaded')));
    const lines: string[] = [];
    const response = await hybrid(api, { onLog: (line) => lines.push(line) })(
      post('/batch', { version: 1, model: 'api:claude-haiku-5-5', items: three }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty('warmUsage');
    expect(api.created).toHaveLength(1);
    expect(lines.some((line) => line.includes('warm-up failed (overloaded)'))).toBe(true);
  });

  it('picks the prefix with the most tokens × items, among those that clear the minimum', () => {
    const block = (text: string, cached = true): Anthropic.TextBlockParam => ({
      type: 'text',
      text,
      ...(cached ? { cache_control: PROMPT_CACHE } : {}),
    });
    const rules = block('r'.repeat(4_000));
    const request = (
      system: Anthropic.TextBlockParam[],
      model = 'claude-haiku-5-5',
      extra: Record<string, unknown> = {},
    ) => ({
      custom_id: 'x',
      params: {
        model,
        max_tokens: 100,
        system,
        messages: [{ role: 'user' as const, content: 'Hi' }],
        ...extra,
      },
    });
    const pages = ['a', 'b', 'c', 'd'].map((page) =>
      request([rules, block(page.repeat(400)), block('tail', false)]),
    );
    const plan = prewarmPlan(pages);
    // Four items share the rules (1,000 tokens); no catalog is shared by three.
    expect(plan).toMatchObject({ sharers: 4, tokens: 1_000 });
    expect(plan?.params.system).toEqual([rules]);
    expect(PREWARM_MIN_SHARERS).toBe(3);
    // Below Haiku 4.5's 4,096-token minimum nothing caches, so nothing is warmed.
    expect(
      prewarmPlan(
        pages.map((page) => ({ ...page, params: { ...page.params, model: 'claude-haiku-4-5' } })),
      ),
    ).toBeUndefined();
    // Extended thinking and forced tools cannot ride a zero-token call.
    const thinking = { thinking: { type: 'enabled', budget_tokens: 2_000 } };
    expect(
      prewarmPlan(pages.map(() => request([rules], 'claude-haiku-5-5', thinking))),
    ).toBeUndefined();
    const forced = { tool_choice: { type: 'any' } };
    expect(
      prewarmPlan(pages.map(() => request([rules], 'claude-haiku-5-5', forced))),
    ).toBeUndefined();
  });
});

describe('an item that wrote the cache', () => {
  it('says why, as a live call does; an item that read it says nothing', async () => {
    const wrote = message(JSON.stringify({ rationale: 'x', commands: [] }), {
      cache_creation_input_tokens: 6_000,
    });
    const read = message(JSON.stringify({ rationale: 'x', commands: [] }), {
      cache_read_input_tokens: 6_000,
    });
    const results = [
      { custom_id: 'p-first', result: { type: 'succeeded', message: wrote } },
      { custom_id: 'p-twin', result: { type: 'succeeded', message: wrote } },
      { custom_id: 'p-follow', result: { type: 'succeeded', message: read } },
    ] as unknown as readonly Individual[];
    const api = fakeApi(message(''), results);
    const handle = createHandler({
      client: api.client,
      batches: { client: api.client, route: 'sdk' },
    });
    await handle(
      post('/batch', {
        version: 1,
        items: [
          { id: 'first', request: wire() },
          { id: 'twin', request: wire() },
          {
            id: 'follow',
            request: wire({
              history: [
                { role: 'user', text: 'Earlier' },
                { role: 'assistant', text: 'Done.' },
              ],
            }),
          },
        ],
      }),
    );
    api.end();
    const body = (await (
      await handle(new Request('http://localhost/batch/msgbatch_1/results'))
    ).json()) as { items: { id: string; usage: { cacheMiss?: unknown } }[] };
    const miss = Object.fromEntries(body.items.map(({ id, usage }) => [id, usage.cacheMiss]));

    expect(miss).toEqual({
      first: { reason: 'first', missedTokens: null, source: 'local' },
      // Its prefix matched the one before it: it ran beside its twin.
      twin: { reason: 'unknown', missedTokens: null, source: 'local' },
      follow: undefined,
    });
  });
});
