import { describe, expect, it } from 'vitest';

import { createSiteBuilder, type BuilderSiteKernel } from '@craftkit/builder-core';
import { fixedClock, fixtureBlocks, seededIds } from '@craftkit/builder-core/testing';
import { defaultDesignSystem, emptyDocument, type BuilderSite } from '@craftkit/builder-schema';

import { runAiAgent } from '../agent/run-agent';
import type { AiBatchClient, AiBatchItemResult, AiBatchState } from '../provider/batch-client';
import type { AiBatchWireItem } from '../provider/batch-wire';
import { createRemoteAiPlanProvider } from '../provider/remote-provider';
import type { AiPlan, AiValidationPorts } from '../types';
import { createMemoryBatchJobStore } from './memory-store';
import { createAiBatchRunner, isAiBatchJobError } from './runner';
import type { AiBatchAgentOptions, AiBatchJobRecord, AiBatchJobStore } from './types';

/*
  The runner on a real site kernel, with the batch client faked: what each page is asked
  (exactly what a live run on it would send), and what each answer becomes (the live door,
  one Undo per page, every miss reported per page).
*/

const pageWith = (id: string, address: string, title: string, marker: string) => ({
  id,
  address,
  title,
  purpose: `What ${title} is for.`,
  audience: 'anyone',
  document: {
    ...emptyDocument('site', 'ltr'),
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['body'] } },
      body: { id: 'body', type: 'text', props: { content: marker } },
    },
  },
  regions: [],
});

function siteKernel(): BuilderSiteKernel {
  const site: BuilderSite = {
    siteVersion: 1,
    dir: 'ltr',
    pages: [
      pageWith('home', '/', 'Home', 'home words'),
      pageWith('work', '/work', 'Work', 'work words'),
      pageWith('contact', '/contact', 'Contact', 'contact words'),
      pageWith('shop', '/shop', 'Shop', 'shop words'),
    ],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  };
  return createSiteBuilder({
    site,
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('batch-site') },
  });
}

const ports: AiValidationPorts = { ids: seededIds('batch-plan'), clock: fixedClock() };
const agent: AiBatchAgentOptions = { validationPorts: ports };
const REQUEST = 'Rewrite the body text in French';

const rewrite = (content: string): AiPlan => ({
  rationale: 'Body in French',
  commands: [{ command: 'setProp', args: { id: 'body', key: 'content', value: content } }],
});

function fakeClient(answer: (items: readonly AiBatchWireItem[]) => readonly AiBatchItemResult[]) {
  const sent: { items: readonly AiBatchWireItem[]; model: string | undefined }[] = [];
  let status: AiBatchState['status'] = 'in_progress';
  const state = (): AiBatchState => ({
    batchId: 'msgbatch_1',
    status,
    counts: {
      processing: status === 'ended' ? 0 : 1,
      succeeded: status === 'ended' ? 1 : 0,
      errored: 0,
      canceled: 0,
      expired: 0,
    },
    createdAt: '2026-10-12T10:00:00Z',
    endedAt: status === 'ended' ? '2026-10-12T10:30:00Z' : null,
  });
  const client: AiBatchClient = {
    submit: (items, options) => {
      // A page job sends plan items only.
      const plans = items.filter((item): item is AiBatchWireItem => 'request' in item);
      sent.push({ items: plans, model: options?.model });
      return Promise.resolve(state());
    },
    status: () => Promise.resolve(state()),
    results: () => Promise.resolve(answer(sent[0]?.items ?? [])),
    cancel: () => {
      status = 'canceling';
      return Promise.resolve(state());
    },
  };
  return {
    client,
    sent,
    end: () => {
      status = 'ended';
    },
  };
}

function runnerOn(client: AiBatchClient, store: AiBatchJobStore = createMemoryBatchJobStore()) {
  return createAiBatchRunner({ client, store, ids: seededIds('job'), clock: { now: () => 1_700 } });
}

/** What `runAiAgent` POSTs for this page when it runs live through the remote provider. */
async function liveBody(site: BuilderSiteKernel, pageId: string): Promise<unknown> {
  let body: unknown;
  const provider = createRemoteAiPlanProvider({
    endpoint: 'https://assistant.example.test/plan',
    fetch: (_url, init) => {
      body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      return Promise.reject(new Error('seen'));
    },
  });
  await runAiAgent({
    ...agent,
    runId: `live-${pageId}`,
    clock: fixedClock(),
    kernel: site.page(pageId),
    provider,
    request: REQUEST,
    directEdits: false,
  }).catch(() => undefined);
  return body;
}

describe('submitting a page-request job', () => {
  it('asks each page exactly as a live run on it would, and stores the job', async () => {
    const site = siteKernel();
    const { client, sent } = fakeClient(() => []);
    const runner = runnerOn(client);

    const job = await runner.submitPageRequest({
      site,
      pageIds: ['home', 'work'],
      request: REQUEST,
      agent,
      model: 'api:claude-haiku-5-5',
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.model).toBe('api:claude-haiku-5-5');
    expect(sent[0]?.items.map(({ id }) => id)).toEqual(['p0', 'p1']);
    expect(sent[0]?.items[0]?.request).toEqual(await liveBody(site, 'home'));
    expect(sent[0]?.items[1]?.request).toEqual(await liveBody(site, 'work'));
    expect(JSON.stringify(sent[0]?.items[0]?.request)).toContain('home words');
    expect(JSON.stringify(sent[0]?.items[1]?.request)).toContain('work words');
    expect(job).toMatchObject({
      version: 1,
      kind: 'page-request',
      request: REQUEST,
      pageIds: ['home', 'work'],
      targets: [
        { itemId: 'p0', pageId: 'home' },
        { itemId: 'p1', pageId: 'work' },
      ],
      skipped: [],
      batchId: 'msgbatch_1',
      status: 'in_progress',
      createdAt: 1_700,
      model: 'api:claude-haiku-5-5',
    });
    expect(await runner.get(job.id)).toEqual(job);
    expect(site.transactions()).toHaveLength(0);
  });

  it('keeps what the warm call before the batch cost on the job', async () => {
    const { client } = fakeClient(() => []);
    const warmUsage = {
      inputTokens: 4,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 6_100,
      costUsd: null,
    };
    const warmed: AiBatchClient = {
      ...client,
      submit: async (items, options) => ({ ...(await client.submit(items, options)), warmUsage }),
    };

    const job = await runnerOn(warmed).submitPageRequest({
      site: siteKernel(),
      pageIds: ['home'],
      request: REQUEST,
      agent,
    });

    expect(job.warmUsage).toEqual(warmUsage);
  });

  it('refuses a malformed job, and one where no page could be asked', async () => {
    const runner = runnerOn(fakeClient(() => []).client);
    const site = siteKernel();
    const code = async (run: Promise<unknown>): Promise<string | undefined> =>
      run.then(
        () => undefined,
        (cause: unknown) => (isAiBatchJobError(cause) ? cause.code : 'other'),
      );

    expect(
      await code(runner.submitPageRequest({ site, pageIds: [], request: REQUEST, agent })),
    ).toBe('invalid-job');
    expect(
      await code(
        runner.submitPageRequest({ site, pageIds: ['home', 'home'], request: REQUEST, agent }),
      ),
    ).toBe('invalid-job');
    expect(
      await code(runner.submitPageRequest({ site, pageIds: ['blog'], request: REQUEST, agent })),
    ).toBe('invalid-job');
    expect(
      await code(runner.submitPageRequest({ site, pageIds: ['home'], request: ' ', agent })),
    ).toBe('invalid-job');
    const nothing = runner.submitPageRequest({
      site,
      pageIds: ['home', 'work'],
      request: REQUEST,
      agent: { ...agent, policy: { allowedCommands: [] } },
    });
    await expect(nothing).rejects.toMatchObject({
      code: 'nothing-to-send',
      skipped: [{ pageId: 'home' }, { pageId: 'work' }],
    });
    expect(await runner.list()).toEqual([]);
  });
});

describe('applying a job', () => {
  it('lands a plan as one Undo on its page and reports a refusal on the other', async () => {
    const site = siteKernel();
    const { client, end } = fakeClient((items) => [
      { id: items[1]?.id ?? '', outcome: 'refusal', message: 'Not on this page.' },
      {
        id: items[0]?.id ?? '',
        outcome: 'plan',
        plan: rewrite('mots de la maison'),
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          cacheReadTokens: 900,
          cacheWriteTokens: 0,
          costUsd: null,
        },
      },
    ]);
    const runner = runnerOn(client);
    const job = await runner.submitPageRequest({
      site,
      pageIds: ['home', 'work'],
      request: REQUEST,
      agent,
    });

    await expect(runner.apply(job.id, { site, agent })).rejects.toMatchObject({
      code: 'not-ended',
    });
    end();
    expect((await runner.refresh(job.id)).status).toBe('ended');
    const applied = await runner.apply(job.id, { site, agent, label: 'Batch: French' });

    expect(applied.status).toBe('applied');
    expect(applied.outcomes).toEqual([
      {
        pageId: 'home',
        status: 'applied',
        transactionIds: [expect.any(String) as unknown],
        usage: expect.objectContaining({ cacheReadTokens: 900 }) as unknown,
      },
      { pageId: 'work', status: 'refused', message: 'Not on this page.' },
    ]);
    expect(site.page('home').getDocument().nodes['body']?.props['content']).toBe(
      'mots de la maison',
    );
    expect(site.page('work').getDocument().nodes['body']?.props['content']).toBe('work words');
    expect(site.transactions()).toHaveLength(1);
    expect(site.undo()).toBe(true);
    expect(site.page('home').getDocument().nodes['body']?.props['content']).toBe('home words');
    await expect(runner.apply(job.id, { site, agent })).rejects.toMatchObject({
      code: 'already-applied',
    });
  });

  it('reports every way a page can miss, so the panel can offer a live retry', async () => {
    const site = siteKernel();
    const { client, end } = fakeClient((items) => [
      { id: items[0]?.id ?? '', outcome: 'plan', plan: rewrite('x') },
      {
        id: items[1]?.id ?? '',
        outcome: 'plan',
        plan: { rationale: 'Bad', commands: [{ command: 'nope', args: {} }] },
      },
      {
        id: items[2]?.id ?? '',
        outcome: 'error',
        type: 'expired',
        message: 'Expired.',
        retryable: true,
      },
      { id: items[3]?.id ?? '', outcome: 'invalid-output', message: 'Not JSON.' },
    ]);
    const runner = runnerOn(client);
    const job = await runner.submitPageRequest({
      site,
      pageIds: ['contact', 'work', 'home', 'shop'],
      request: REQUEST,
      agent,
    });
    end();
    // The contact page was deleted while the batch ran.
    const shrunk = {
      pages: () => site.pages().filter((id) => id !== 'contact'),
      page: (id: string) => site.page(id),
    };

    const applied = await runner.apply(job.id, { site: shrunk, agent });

    expect(applied.outcomes).toEqual([
      { pageId: 'contact', status: 'missing', message: expect.any(String) as unknown },
      {
        pageId: 'work',
        status: 'rejected',
        message: expect.any(String) as unknown,
        issues: [expect.anything() as unknown],
      },
      { pageId: 'home', status: 'error', message: 'Expired.', retryable: true },
      { pageId: 'shop', status: 'invalid', message: 'Not JSON.' },
    ]);
    expect(site.transactions()).toHaveLength(0);
  });

  it('resumes an interrupted apply without landing any page twice', async () => {
    const site = siteKernel();
    const { client, end } = fakeClient((items) =>
      items.map(({ id }, at) => ({
        id,
        outcome: 'plan' as const,
        plan: rewrite(`v${String(at)}`),
      })),
    );
    const memory = createMemoryBatchJobStore();
    const stop = new AbortController();
    const store: AiBatchJobStore = {
      ...memory,
      put: async (record: AiBatchJobRecord) => {
        await memory.put(record);
        if ((record.outcomes?.length ?? 0) === 1) stop.abort();
      },
    };
    const runner = runnerOn(client, store);
    const job = await runner.submitPageRequest({
      site,
      pageIds: ['home', 'work'],
      request: REQUEST,
      agent,
    });
    end();

    await expect(runner.apply(job.id, { site, agent, signal: stop.signal })).rejects.toThrow();
    expect(site.transactions()).toHaveLength(1);
    const resumed = await runner.apply(job.id, { site, agent });

    expect(resumed.outcomes?.map(({ pageId, status }) => `${pageId}:${status}`)).toEqual([
      'home:applied',
      'work:applied',
    ]);
    expect(site.transactions()).toHaveLength(2);
    expect(site.page('work').getDocument().nodes['body']?.props['content']).toBe('v1');
  });
});

describe('polling and cancelling', () => {
  it('lists jobs newest first, cancels a running batch and forgets a job', async () => {
    const site = siteKernel();
    const { client } = fakeClient(() => []);
    const runner = runnerOn(client);
    const job = await runner.submitPageRequest({
      site,
      pageIds: ['home'],
      request: REQUEST,
      agent,
    });

    expect((await runner.list()).map(({ id }) => id)).toEqual([job.id]);
    const cancelled = await runner.cancel(job.id);
    expect(cancelled.status).toBe('canceling');
    expect((await runner.refresh(job.id)).status).toBe('canceling');
    await runner.remove(job.id);
    expect(await runner.list()).toEqual([]);
    await expect(runner.refresh(job.id)).rejects.toMatchObject({ code: 'unknown-job' });
  });
});
