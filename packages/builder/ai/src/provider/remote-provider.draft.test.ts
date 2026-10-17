import { describe, expect, it } from 'vitest';

import type {
  AiPagePlanDraftEvent,
  AiProposePagePlanOptions,
  AssembledAiContext,
  PagePlanCandidate,
} from '../types';
import { createRemoteAiPlanProvider } from './remote-provider';

/*
  The `draft` SSE frame (fast page build, 2026-10-05, DESIGN §5.2): the
  page-plan answer's raw text reaches `live.onDraft` while the model writes
  it, so the engine can land the skeleton and start writers before the whole
  plan arrives. Drafts are advisory — the `result` frame stays the authority,
  and nothing about a draft can change what the call resolves to.
*/

const ENDPOINT = 'https://assistant.example.test/plan';

function context(): AssembledAiContext {
  return {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
  };
}

const CANDIDATE: PagePlanCandidate = { title: 'Cardamom Roasters', sections: [] };
const RESULT = { version: 1, rationale: 'Warm.', pagePlan: CANDIDATE };

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;
}

/** An SSE body delivered in the given chunks (so a frame may straddle two reads). */
function sseResponse(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
}

function providerAnswering(respond: () => Response) {
  const fetchImpl = (): Promise<Response> => Promise.resolve(respond());
  return createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
}

function recorder() {
  const events: AiPagePlanDraftEvent[] = [];
  const live: AiProposePagePlanOptions = {
    onDraft: (event) => {
      events.push(event);
    },
  };
  return { events, live };
}

describe('createRemoteAiPlanProvider — page-plan drafts', () => {
  it('says start when the stream begins, then hands over each draft text in order', async () => {
    const body =
      frame('status', { text: 'Planning the page…' }) +
      frame('draft', { text: '{"version":1,"rationale":"Warm."' }) +
      frame('draft', { text: ',"pagePlan":{"title":"Cardamom Roasters"' }) +
      frame('result', RESULT);
    // Split mid-frame, so the reader's buffering is on the path.
    const provider = providerAnswering(() => sseResponse([body.slice(0, 57), body.slice(57)]));
    const { events, live } = recorder();
    const progress: string[] = [];

    const answer = await provider.proposePagePlan('Build my page', context(), {
      ...live,
      onProgress: (text) => {
        progress.push(text);
      },
    });

    expect(answer).toEqual({ pagePlan: CANDIDATE, rationale: 'Warm.' });
    expect(events).toEqual([
      { kind: 'start' },
      { kind: 'text', text: '{"version":1,"rationale":"Warm."' },
      { kind: 'text', text: ',"pagePlan":{"title":"Cardamom Roasters"' },
    ]);
    expect(progress).toEqual(['Planning the page…']);
  });

  it('reads a reset frame as a second start: the earlier text is to be forgotten', async () => {
    const provider = providerAnswering(() =>
      sseResponse([
        frame('draft', { text: '{"version":1,"rati' }) +
          frame('draft', { reset: true }) +
          frame('draft', { text: '{"version":1}' }) +
          frame('result', RESULT),
      ]),
    );
    const { events, live } = recorder();

    await provider.proposePagePlan('Build my page', context(), live);

    expect(events).toEqual([
      { kind: 'start' },
      { kind: 'text', text: '{"version":1,"rati' },
      { kind: 'start' },
      { kind: 'text', text: '{"version":1}' },
    ]);
  });

  it('ignores a draft whose payload is not a string text or a reset, without failing', async () => {
    const provider = providerAnswering(() =>
      sseResponse([
        frame('draft', { text: 42 }) +
          frame('draft', { reset: 'yes' }) +
          frame('draft', ['not', 'a', 'record']) +
          frame('draft', { text: 'ok' }) +
          frame('result', RESULT),
      ]),
    );
    const { events, live } = recorder();

    await expect(provider.proposePagePlan('Build my page', context(), live)).resolves.toEqual({
      pagePlan: CANDIDATE,
      rationale: 'Warm.',
    });
    expect(events).toEqual([{ kind: 'start' }, { kind: 'text', text: 'ok' }]);
  });

  it('ignores a draft after the result instead of calling it a protocol error', async () => {
    const provider = providerAnswering(() =>
      sseResponse([
        frame('draft', { text: 'a' }) +
          frame('result', RESULT) +
          frame('draft', { text: 'late' }) +
          frame('draft', { reset: true }),
      ]),
    );
    const { events, live } = recorder();

    await expect(provider.proposePagePlan('Build my page', context(), live)).resolves.toEqual({
      pagePlan: CANDIDATE,
      rationale: 'Warm.',
    });
    expect(events).toEqual([{ kind: 'start' }, { kind: 'text', text: 'a' }]);
  });

  it('keeps the result when the draft observer throws', async () => {
    const provider = providerAnswering(() =>
      sseResponse([frame('draft', { text: 'a' }) + frame('result', RESULT)]),
    );
    let calls = 0;

    const answer = await provider.proposePagePlan('Build my page', context(), {
      onDraft: () => {
        calls += 1;
        throw new Error('observer broke');
      },
    });

    expect(answer).toEqual({ pagePlan: CANDIDATE, rationale: 'Warm.' });
    expect(calls).toBe(2);
  });

  it('never feeds drafts to an ordinary plan proposal, which ignores them as before', async () => {
    const plan = { rationale: 'Added a hero.', commands: [] };
    const provider = providerAnswering(() =>
      sseResponse([
        frame('draft', { text: 'a' }) + frame('draft', { reset: true }) + frame('result', plan),
      ]),
    );
    const { events, live } = recorder();

    // A page-plan options object handed to `propose`: its observer must stay silent.
    await expect(provider.propose('Add a hero', context(), live)).resolves.toEqual(plan);
    expect(events).toEqual([]);
  });

  it('emits nothing for a plain JSON answer', async () => {
    const provider = providerAnswering(
      () =>
        new Response(JSON.stringify(RESULT), {
          headers: { 'content-type': 'application/json' },
        }),
    );
    const { events, live } = recorder();

    await expect(provider.proposePagePlan('Build my page', context(), live)).resolves.toEqual({
      pagePlan: CANDIDATE,
      rationale: 'Warm.',
    });
    expect(events).toEqual([]);
  });
});
