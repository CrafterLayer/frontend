import { describe, expect, it } from 'vitest';

import { createRemoteBatchClient } from './batch-client';
import { RemoteAiProviderError } from './remote-errors';

/*
  The batch client against a scripted fetch: the four calls it makes, and how it reads what
  comes back — every answer through the live decoders, every failure with the server's own
  sentence and a status the caller can branch on.
*/

const ENDPOINT = 'https://assistant.example.test/plan';
const PLAN = { rationale: 'Body in French', commands: [{ command: 'setProp', args: { id: 'b' } }] };

const STATE = {
  version: 1,
  id: 'msgbatch_1',
  status: 'in_progress',
  counts: { processing: 2, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
  createdAt: '2026-10-12T10:00:00Z',
  endedAt: null,
  expiresAt: '2026-10-13T10:00:00Z',
};

interface Seen {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

function scripted(answer: (url: string) => Response) {
  const seen: Seen[] = [];
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    seen.push({
      url,
      method: init?.method,
      headers: init?.headers as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return Promise.resolve(answer(url));
  }) as typeof globalThis.fetch;
  return { fetch, seen };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createRemoteBatchClient', () => {
  it('submits, polls and cancels on the batch routes of the endpoint’s origin', async () => {
    const { fetch, seen } = scripted(() => json(STATE));
    const client = createRemoteBatchClient({
      endpoint: ENDPOINT,
      fetch,
      headers: { authorization: 'Bearer secret' },
    });
    const items = [{ id: 'p0', request: { version: 1, request: 'x', context: {} } }] as never;

    const state = await client.submit(items, { model: ' api:claude-haiku-5-5 ' });
    await client.status('msgbatch_1');
    await client.cancel('msgbatch_1');

    expect(state).toEqual({
      batchId: 'msgbatch_1',
      status: 'in_progress',
      counts: STATE.counts,
      createdAt: '2026-10-12T10:00:00Z',
      endedAt: null,
    });
    expect(seen.map(({ method, url }) => `${String(method)} ${url}`)).toEqual([
      'POST https://assistant.example.test/batch',
      'GET https://assistant.example.test/batch/msgbatch_1',
      'POST https://assistant.example.test/batch/msgbatch_1/cancel',
    ]);
    expect(seen[0]?.body).toEqual({ version: 1, model: 'api:claude-haiku-5-5', items });
    expect(seen[0]?.headers).toMatchObject({
      authorization: 'Bearer secret',
      'content-type': 'application/json',
    });
    await expect(client.status('../plan')).rejects.toThrow(RangeError);
  });

  it('reads every answer with the live decoders, and every miss with its retryability', async () => {
    const usage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 900, cacheWriteTokens: 0 };
    const { fetch } = scripted(() =>
      json({
        version: 1,
        id: 'msgbatch_1',
        items: [
          { id: 'refused', body: { version: 1, refusal: 'Not this one.' } },
          { id: 'plan', body: PLAN, usage },
          { id: 'cut', body: { version: 1, invalidOutput: { message: 'The plan was cut off.' } } },
          { id: 'odd', body: { hello: 'world' } },
          { id: 'late', error: { type: 'expired', message: 'Send it again.' } },
          { id: 'bad', error: { type: 'invalid_request_error', message: 'Malformed.' } },
          { nonsense: true },
        ],
      }),
    );
    const client = createRemoteBatchClient({ endpoint: ENDPOINT, fetch });

    const results = await client.results('msgbatch_1');

    expect(results).toEqual([
      { id: 'refused', outcome: 'refusal', message: 'Not this one.' },
      { id: 'plan', outcome: 'plan', plan: PLAN, usage: { ...usage, costUsd: null } },
      { id: 'cut', outcome: 'invalid-output', message: 'The plan was cut off.' },
      {
        id: 'odd',
        outcome: 'invalid-output',
        message: expect.stringMatching(/not a plan/u) as unknown,
      },
      { id: 'late', outcome: 'error', type: 'expired', message: 'Send it again.', retryable: true },
      {
        id: 'bad',
        outcome: 'error',
        type: 'invalid_request_error',
        message: 'Malformed.',
        retryable: false,
      },
    ]);
  });

  it('reads page-plan answers when asked to', async () => {
    const pagePlan = { intent: 'new-page', sections: [] };
    const { fetch } = scripted(() =>
      json({
        version: 1,
        id: 'b',
        items: [{ id: 'a', body: { version: 1, rationale: ' Warm. ', pagePlan } }],
      }),
    );
    const client = createRemoteBatchClient({ endpoint: ENDPOINT, fetch });

    expect(await client.results('b', { task: 'page-plan' })).toEqual([
      { id: 'a', outcome: 'page-plan', proposal: { pagePlan, rationale: 'Warm.' } },
    ]);
  });

  it('sends scene reviews, and reads their verdicts with the live review’s reader', async () => {
    const review = {
      version: 1,
      lang: 'en',
      contract: { title: 'Garden', purpose: 'Fireflies.', mustSay: [] },
      images: [
        { view: 'desktop', mediaType: 'image/jpeg', base64: 'QQ==', width: 640, height: 360 },
      ],
    } as const;
    const usage = { inputTokens: 900, outputTokens: 60, cacheReadTokens: 0, cacheWriteTokens: 0 };
    const finding = { where: 'desktop', problem: 'Unreadable title.', fix: 'Add a scrim.' };
    const { fetch, seen } = scripted((url) =>
      url.endsWith('/results')
        ? json({
            version: 1,
            id: 'b',
            items: [
              { id: 'hero', body: { version: 1, ok: false, findings: [finding] }, usage },
              { id: 'shy', body: { version: 1, refusal: 'Not this one.' }, usage },
            ],
          })
        : json({ ...STATE, warmUsage: { ...usage, cacheWriteTokens: 6_100 } }),
    );
    const client = createRemoteBatchClient({ endpoint: ENDPOINT, fetch });

    const state = await client.submit([{ id: 'hero', review }]);
    const results = await client.results('b', { task: 'scene-review' });

    expect(seen[0]?.body).toEqual({ version: 1, items: [{ id: 'hero', review }] });
    // What the warm call before the batch cost is part of what the job cost.
    expect(state.warmUsage).toEqual({ ...usage, cacheWriteTokens: 6_100, costUsd: null });
    expect(results).toEqual([
      {
        id: 'hero',
        outcome: 'scene-review',
        review: { ok: false, findings: [finding] },
        usage: { ...usage, costUsd: null },
      },
      {
        id: 'shy',
        outcome: 'refusal',
        message: 'Not this one.',
        usage: { ...usage, costUsd: null },
      },
    ]);
  });

  it('fails with the server’s own sentence and status', async () => {
    const said = 'Background batches need the Anthropic Messages API, and OpenRouter cannot batch.';
    const { fetch } = scripted((url) =>
      url.endsWith('/results') ? json({ error: 'Not yet.' }, 409) : json({ error: said }, 501),
    );
    const client = createRemoteBatchClient({ endpoint: ENDPOINT, fetch });

    const refused = await client.submit([]).catch((cause: unknown) => cause);
    expect(refused).toBeInstanceOf(RemoteAiProviderError);
    expect(refused).toMatchObject({
      message: said,
      status: 501,
      retryable: true,
      code: 'http-status',
    });
    await expect(client.results('b')).rejects.toMatchObject({
      message: 'Not yet.',
      status: 409,
      retryable: false,
    });
  });

  it('refuses an insecure endpoint, a non-batch answer, and an oversized body', async () => {
    expect(() =>
      createRemoteBatchClient({ endpoint: 'http://assistant.example.test/plan' }),
    ).toThrow(/HTTPS/u);
    const odd = createRemoteBatchClient({
      endpoint: ENDPOINT,
      fetch: scripted(() => json({ ok: 1 })).fetch,
    });
    await expect(odd.status('b')).rejects.toMatchObject({ code: 'invalid-output' });
    const small = createRemoteBatchClient({
      endpoint: ENDPOINT,
      fetch: scripted(() => json(STATE)).fetch,
      maxResponseBytes: 16,
    });
    await expect(small.status('b')).rejects.toMatchObject({ code: 'response-limit' });
  });

  it('keeps a caller’s cancellation an AbortError and a lost connection retryable', async () => {
    const stop = new AbortController();
    stop.abort(new DOMException('Stopped.', 'AbortError'));
    const client = createRemoteBatchClient({
      endpoint: ENDPOINT,
      fetch: scripted(() => json(STATE)).fetch,
    });
    await expect(client.status('b', { signal: stop.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });

    const offline = createRemoteBatchClient({
      endpoint: ENDPOINT,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await expect(offline.status('b')).rejects.toMatchObject({ code: 'network', retryable: true });
  });
});
