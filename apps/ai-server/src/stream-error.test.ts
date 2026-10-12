/**
 * A failure after the stream began (2026-10-12). The status line is spent by then, so the
 * server used to answer only with an invalid-output result: a rate limit or an outage spent a
 * repair call and was never classed as retryable. Ours to prove, end to end through the real
 * remote adapter: the server sends an `error` frame with the status the plain answer would
 * have had, the client rejects with that status and the right `retryable`, and the
 * invalid-output result an older client reads is still there.
 */
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import { createRemoteAiPlanProvider, type AssembledAiContext } from '@craftkit/builder/headless';

import { createHandler } from './handler';

const CONTEXT = {
  fragments: [],
  totalTokens: 0,
  blocks: [],
  document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
  selection: { ids: [] },
  outputContract: { version: 1, schema: { type: 'object' } },
} as unknown as AssembledAiContext;

/** A backend whose stream starts, then fails with `error`. */
function failingMidStream(error: Error): Anthropic {
  return {
    messages: {
      stream: () => ({ on: () => undefined, finalMessage: () => Promise.reject(error) }),
    },
  } as unknown as Anthropic;
}

function rateLimited(): Error {
  return Object.create(Anthropic.RateLimitError.prototype) as Error;
}

describe('a failure after the stream began', () => {
  it('reaches the client as its status, retryable for a rate limit', async () => {
    const handle = createHandler({ client: failingMidStream(rateLimited()) });
    const provider = createRemoteAiPlanProvider({
      endpoint: 'https://assistant.example.test/plan',
      fetch: async (_input, init) =>
        handle(new Request('https://assistant.example.test/plan', init)),
    });

    await expect(
      provider.propose('Improve the hero', CONTEXT, { onProgress: () => undefined }),
    ).rejects.toMatchObject({
      name: 'RemoteAiProviderError',
      code: 'http-status',
      status: 429,
      retryable: true,
    });
  });

  it('sends the frame before the result an older client reads, in the server’s own words', async () => {
    const handle = createHandler({ client: failingMidStream(new Error('ENOTFOUND at /x.ts:1')) });
    const response = await handle(
      new Request('http://localhost/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({ version: 1, request: 'add a hero', context: CONTEXT }),
      }),
    );
    const text = await response.text();
    const errorAt = text.indexOf('event: error');
    expect(errorAt).toBeGreaterThan(-1);
    expect(text.indexOf('event: result')).toBeGreaterThan(errorAt);
    expect(text).toContain('"status":502');
    // The server's own sentence, never the raw SDK text or a path.
    expect(text).not.toContain('/x.ts');
  });
});
