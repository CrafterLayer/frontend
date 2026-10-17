import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import {
  createAiBatchRunner,
  createMemoryBatchJobStore,
  createRemoteBatchClient,
  createSiteBuilder,
  headlessBlockManifest,
  liftDocumentSession,
  pageSchema,
  type BuilderDocument,
  type BuilderSiteKernel,
  type IdPort,
} from '@craftkit/builder/headless';

import { createHandler } from './handler';

/*
  BACKGROUND BATCHES, end to end and in process (2026-10-12): the headless runner asks two
  pages of a real site kernel, its batch client's fetch calls this server's real handler, the
  handler sends the batch to a fake Anthropic client and reads the fake's results back — and
  the runner lands the one plan through the live door as one Undo, and reports the refusal.
  Packages may not import apps, so the test lives on the server's side of the wire.
*/

const TOKEN = 'integration-secret';
const ENDPOINT = 'https://assistant.example.test/plan';
const REQUEST = 'Translate the page title into French';

function countingIds(seed: string): IdPort {
  let counter = 0;
  return {
    newId() {
      counter += 1;
      return `${seed}-${counter.toString(36).padStart(4, '0')}`;
    },
  };
}

function page(title: string): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { title } } },
  };
}

/** A site of two pages, Home and About us, over the headless page root. */
function twoPages(): BuilderSiteKernel {
  const lifted = liftDocumentSession({ doc: page('Home'), seq: 0, tail: [] });
  const home = lifted.pages[0];
  if (home === undefined) throw new Error('A lifted site has its home page.');
  return createSiteBuilder({
    site: {
      ...lifted,
      pages: [
        home,
        { ...home, id: 'about', address: '/about', title: 'About', document: page('About us') },
      ],
    },
    extensions: [headlessBlockManifest('batch-blocks', '0.0.0', [pageSchema])],
    ports: { clock: { now: () => 1 }, ids: countingIds('site') },
  });
}

const RETITLE = {
  rationale: 'The title in French.',
  commands: [{ command: 'setProp', args: { id: 'root', key: 'title', value: 'Accueil' } }],
};

/** The Batches API, faked: Home is answered with a plan, About us declined. */
function fakeBatchesApi() {
  const created: Anthropic.Messages.BatchCreateParams[] = [];
  let status: 'in_progress' | 'ended' = 'in_progress';
  const state = () => ({
    id: 'msgbatch_e2e',
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
    ended_at: status === 'ended' ? '2026-10-12T10:20:00Z' : null,
    expires_at: '2026-10-13T10:00:00Z',
    archived_at: null,
    cancel_initiated_at: null,
    results_url: status === 'ended' ? 'https://api.example/results' : null,
  });
  const answer = (request: Anthropic.Messages.BatchCreateParams.Request) => {
    const about = JSON.stringify(request.params.messages).includes('About us');
    return {
      custom_id: request.custom_id,
      result: {
        type: 'succeeded',
        message: {
          id: `msg_${request.custom_id}`,
          type: 'message',
          role: 'assistant',
          model: request.params.model,
          stop_reason: about ? 'refusal' : 'end_turn',
          stop_details: about
            ? { type: 'refusal', explanation: 'The About page stays in English.' }
            : null,
          content: about ? [] : [{ type: 'text', text: JSON.stringify(RETITLE) }],
          usage: {
            input_tokens: 300,
            output_tokens: 60,
            cache_read_input_tokens: 4_000,
            cache_creation_input_tokens: 0,
          },
        },
      },
    };
  };
  const client = {
    messages: {
      batches: {
        create: (params: Anthropic.Messages.BatchCreateParams) => {
          created.push(params);
          return Promise.resolve(state());
        },
        retrieve: () => Promise.resolve(state()),
        cancel: () => Promise.resolve(state()),
        results: () => {
          // In an order unlike the batch's own: results are keyed, never positional.
          const entries = [...(created[0]?.requests ?? [])].reverse().map(answer);
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
    created,
    end: () => {
      status = 'ended';
    },
  };
}

describe('a background batch, runner to door', () => {
  it('lands the plan as one Undo on its page and reports the refusal on the other', async () => {
    const api = fakeBatchesApi();
    const handle = createHandler({
      client: api.client,
      batches: { client: api.client, route: 'sdk' },
      authToken: TOKEN,
    });
    const client = createRemoteBatchClient({
      endpoint: ENDPOINT,
      headers: { authorization: `Bearer ${TOKEN}` },
      fetch: (input, init) => handle(new Request(input, init)),
    });
    const runner = createAiBatchRunner({
      client,
      store: createMemoryBatchJobStore(),
      ids: countingIds('job'),
      clock: { now: () => 1_000 },
    });
    const site = twoPages();
    const agent = { validationPorts: { clock: { now: () => 2 }, ids: countingIds('plan') } };

    const job = await runner.submitPageRequest({
      site,
      pageIds: ['home', 'about'],
      request: REQUEST,
      agent,
    });

    const sent = api.created[0]?.requests ?? [];
    expect(sent.map(({ custom_id }) => custom_id)).toEqual(['p-p0', 'p-p1']);
    expect(JSON.stringify(sent[0]?.params.messages)).toContain('Home');
    expect(JSON.stringify(sent[1]?.params.messages)).toContain('About us');
    expect(JSON.stringify(sent[0]?.params.system)).toContain('"ttl":"1h"');
    expect(job.status).toBe('in_progress');
    expect((await runner.refresh(job.id)).counts.processing).toBe(2);

    api.end();
    expect((await runner.refresh(job.id)).status).toBe('ended');
    const applied = await runner.apply(job.id, { site, agent });

    expect(applied.status).toBe('applied');
    expect(applied.outcomes).toEqual([
      {
        pageId: 'home',
        status: 'applied',
        transactionIds: [expect.any(String) as unknown],
        usage: expect.objectContaining({ inputTokens: 300, cacheReadTokens: 4_000 }) as unknown,
      },
      {
        pageId: 'about',
        status: 'refused',
        message: 'The About page stays in English.',
        usage: expect.objectContaining({ outputTokens: 60 }) as unknown,
      },
    ]);
    expect(site.page('home').getDocument().nodes['root']?.props['title']).toBe('Accueil');
    expect(site.page('about').getDocument().nodes['root']?.props['title']).toBe('About us');
    expect(site.transactions()).toHaveLength(1);
    expect(site.undo()).toBe(true);
    expect(site.page('home').getDocument().nodes['root']?.props['title']).toBe('Home');
  });
});
