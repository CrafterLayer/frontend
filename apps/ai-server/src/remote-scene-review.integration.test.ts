import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import { createRemoteAiPlanProvider, type AiPlanProvider } from '@craftkit/builder/headless';

import { createHandler } from './handler';
import { SCENE_REVIEW_ANSWER_SCHEMA } from './scene-review';

/*
  The scene review end to end and in process (visual self-review, 2026-10-13): the real remote
  provider, whose fetch calls this server's real handler, whose backend is a fake SDK client —
  so every hop a picture takes is here except the browser and the model: the provider's POST to
  `/v1/scene/review`, the handler's door and route, the Messages API request with its image
  blocks and schema, and the verdict read back into `reviewScene`'s answer. No live model call.
*/

const TOKEN = 'integration-secret';
const ENDPOINT = 'https://assistant.example.test/plan';

type ReviewRequest = Parameters<NonNullable<AiPlanProvider['reviewScene']>>[0];

interface BackendCall {
  readonly model: unknown;
  readonly images: readonly unknown[];
  readonly schema: unknown;
}

/** The SDK client a `sdk` deployment builds, faked at the stream seam every call goes through. */
function fakeBackend(calls: BackendCall[], answer: unknown): Anthropic {
  const client = Object.create(Anthropic.prototype) as Anthropic;
  Object.assign(client, {
    messages: {
      stream: (params: {
        readonly model?: unknown;
        readonly messages?: readonly {
          readonly content: readonly { type: string; source?: unknown }[];
        }[];
        readonly output_config?: { readonly format?: { readonly schema?: unknown } };
      }) => {
        calls.push({
          model: params.model,
          images: (params.messages?.[0]?.content ?? [])
            .filter(({ type }) => type === 'image')
            .map(({ source }) => source),
          schema: params.output_config?.format?.schema,
        });
        return {
          on: () => undefined,
          finalMessage: () =>
            Promise.resolve({
              stop_reason: 'end_turn',
              stop_details: null,
              content: [{ type: 'text', text: JSON.stringify(answer) }],
              usage: { input_tokens: 912, output_tokens: 61 },
            }),
        };
      },
    },
  });
  return client;
}

function remoteOverHandler(answer: unknown, options: { readonly olderServer?: boolean } = {}) {
  const backend: BackendCall[] = [];
  const urls: string[] = [];
  const handle = createHandler({
    client: fakeBackend(backend, answer),
    authToken: TOKEN,
    model: 'claude-opus-5',
    models: ['claude-haiku-5-5'],
  });
  const provider = createRemoteAiPlanProvider({
    endpoint: ENDPOINT,
    headers: { authorization: `Bearer ${TOKEN}` },
    timeoutMs: 60_000,
    fetch: (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      urls.push(url);
      // A server written before the review answers its path as it answers any unknown one.
      const sent =
        options.olderServer === true ? url.replace('/v1/scene/review', '/v1/nowhere') : url;
      return handle(new Request(sent, init));
    },
  });
  return { provider, backend, urls };
}

const REQUEST: ReviewRequest = {
  image: { mediaType: 'image/jpeg', base64: 'REVTSw==', width: 640, height: 360 },
  phone: { mediaType: 'image/jpeg', base64: 'UEhPTkU=', width: 201, height: 360 },
  contract: {
    title: 'The night garden',
    purpose: 'A playable garden where Layla collects fireflies.',
    mustSay: ['Open every evening'],
  },
  brief: { palette: ['bg #101820'], cast: ['Layla (hero, teal)'] },
  lang: 'en',
};

describe('the scene review is reachable through the real remote provider and handler', () => {
  it('carries the pictures to the model as image blocks and its verdict back', async () => {
    const verdict = {
      ok: false,
      findings: [
        {
          where: 'phone',
          problem: 'The Start button is cut off at the right edge.',
          fix: 'Let the controls wrap.',
        },
      ],
    };
    const { provider, backend, urls } = remoteOverHandler(verdict);
    const usage: unknown[] = [];

    const review = await provider.reviewScene(REQUEST, { onUsage: (value) => usage.push(value) });

    expect(review).toEqual(verdict);
    expect(urls).toEqual(['https://assistant.example.test/v1/scene/review']);
    expect(backend).toEqual([
      {
        // The fastest model the server allows: a review is a small call.
        model: 'claude-haiku-5-5',
        images: [
          { type: 'base64', media_type: 'image/jpeg', data: 'REVTSw==' },
          { type: 'base64', media_type: 'image/jpeg', data: 'UEhPTkU=' },
        ],
        schema: SCENE_REVIEW_ANSWER_SCHEMA,
      },
    ]);
    expect(usage).toEqual([
      expect.objectContaining({ inputTokens: 912, outputTokens: 61 }) as unknown,
    ]);
  });

  it('is remembered as missing on a server that predates it: asked once, never again', async () => {
    const { provider, backend, urls } = remoteOverHandler(
      { ok: true, findings: [] },
      { olderServer: true },
    );
    await expect(provider.reviewScene(REQUEST)).rejects.toMatchObject({ task: 'scene-review' });
    await expect(provider.reviewScene(REQUEST)).rejects.toMatchObject({ task: 'scene-review' });
    expect(urls).toHaveLength(1);
    expect(backend).toHaveLength(0);
  });
});
