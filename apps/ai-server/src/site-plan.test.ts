import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { createRemoteAiPlanProvider } from '@craftkit/builder/headless';

import { createHandler } from './handler';
import { SITE_PLAN_MAX_TOKENS, SITE_PLAN_RULES, readSitePlanMessage } from './site-plan';

/*
  The site-plan task (T230), against a faked Claude: what the model is asked, and how each
  answer becomes the wire body `remote-provider` reads. No test calls the API.
*/

const PAGES = [
  { title: 'Home', request: 'The Crumbs bakery home page: a warm hero and the daily bread.' },
  { title: 'About', request: 'The story of the Crumbs bakery, in the same warm style.' },
];

interface Seen {
  readonly params: Record<string, unknown>;
}

function fakeClient(text: string, seen: Seen[] = [], stop = 'end_turn'): Anthropic {
  return {
    messages: {
      stream: (params: Record<string, unknown>) => {
        seen.push({ params });
        return {
          on: () => undefined,
          finalMessage: () =>
            Promise.resolve({
              stop_reason: stop,
              stop_details: null,
              content: [{ type: 'text', text }],
              usage: { input_tokens: 300, output_tokens: 120 },
            }),
        };
      },
    },
  } as unknown as Anthropic;
}

function sitePlanRequest(): Request {
  return new Request('http://localhost/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      version: 1,
      request: 'Build a 2-page website for my bakery Crumbs',
      history: [{ role: 'user', text: 'I run a bakery.' }],
      task: 'site-plan',
      context: {
        fragments: [],
        totalTokens: 0,
        blocks: [],
        document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
        selection: { ids: [] },
      },
    }),
  });
}

describe('task: site-plan', () => {
  it('asks with its own short prompt, thinking off, and answers the pages', async () => {
    const seen: Seen[] = [];
    const handle = createHandler({
      client: fakeClient(JSON.stringify({ rationale: 'A warm bakery.', pages: PAGES }), seen),
    });

    const response = await handle(sitePlanRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      version: 1,
      rationale: 'A warm bakery.',
      pages: PAGES,
    });
    const params = seen[0]?.params ?? {};
    expect(params['system']).toEqual([{ type: 'text', text: SITE_PLAN_RULES }]);
    expect(params['max_tokens']).toBe(SITE_PLAN_MAX_TOKENS);
    expect(params['thinking']).toEqual({ type: 'disabled' });
    expect(params['messages']).toEqual([
      {
        role: 'user',
        content:
          'The conversation so far:\nuser: I run a bakery.\n\nThe request to plan:\nBuild a 2-page website for my bakery Crumbs',
      },
    ]);
  });

  it('reads a refusal, a cut-off answer and too few pages as the wire says', () => {
    const message = (text: string, stop = 'end_turn'): Anthropic.Message =>
      ({
        stop_reason: stop,
        content: [{ type: 'text', text }],
        usage: {},
      }) as unknown as Anthropic.Message;
    expect(readSitePlanMessage(message('{"rationale":"x","refusal":"Not a website."}'))).toEqual({
      kind: 'refusal',
      message: 'Not a website.',
    });
    expect(readSitePlanMessage(message('{"rationale":"x","pa', 'max_tokens')).kind).toBe(
      'invalid-output',
    );
    expect(
      readSitePlanMessage(message(JSON.stringify({ rationale: 'x', pages: [PAGES[0]] }))).kind,
    ).toBe('invalid-output');
    expect(readSitePlanMessage(message('no json here')).kind).toBe('invalid-output');
  });

  it('keeps at most eight pages', () => {
    const pages = Array.from({ length: 11 }, (_, index) => ({
      title: `Page ${String(index + 1)}`,
      request: `Brief ${String(index + 1)}.`,
    }));
    const outcome = readSitePlanMessage({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ rationale: 'x', pages }) }],
      usage: {},
    } as unknown as Anthropic.Message);
    expect(outcome.kind === 'site-plan' ? outcome.pages.length : 0).toBe(8);
  });

  it('round-trips through the remote provider', async () => {
    const handle = createHandler({
      client: fakeClient(JSON.stringify({ rationale: 'A warm bakery.', pages: PAGES })),
    });
    const provider = createRemoteAiPlanProvider({
      endpoint: 'https://assistant.example.test/plan',
      fetch: async (_input, init) =>
        handle(new Request('https://assistant.example.test/plan', init)),
    });

    await expect(provider.proposeSitePlan('Build a 2-page website for my bakery')).resolves.toEqual(
      {
        pages: PAGES,
        rationale: 'A warm bakery.',
      },
    );
  });
});
