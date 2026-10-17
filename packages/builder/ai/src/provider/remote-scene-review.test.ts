import { describe, expect, it } from 'vitest';

import { createCachingAiPlanProvider } from './caching-provider';
import { createDirectPlanProvider } from './direct-provider';
import { AiTaskUnsupportedError, createRemoteAiPlanProvider } from './remote-provider';
import {
  AI_SCENE_REVIEW_MAX_IMAGE_CHARS,
  aiSceneReviewWireRequest,
  readAiSceneReviewWireRequest,
  readAiSceneReviewWireResponse,
  type AiSceneReviewRequest,
} from './scene-review-wire';

/*
  The scene review over the remote wire (visual self-review, 2026-10-13): `POST /v1/scene/review`
  on the plan endpoint's origin, the pictures as base64 beside the contract and the brief, read
  back into a verdict — and every way it is not one.
*/

const ENDPOINT = 'https://assistant.example.test/plan';

interface RecordedCall {
  readonly input: string;
  readonly init: RequestInit;
  readonly body: Record<string, unknown>;
}

function fakeFetch(respond: () => Response) {
  const calls: RecordedCall[] = [];
  const fetchImpl = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (typeof input !== 'string' || typeof init?.body !== 'string') {
      throw new Error('The provider must POST a JSON string to a string endpoint.');
    }
    calls.push({ input, init, body: JSON.parse(init.body) as Record<string, unknown> });
    return Promise.resolve(respond());
  };
  return { calls, fetchImpl };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const REQUEST: AiSceneReviewRequest = {
  image: { mediaType: 'image/jpeg', base64: 'SlBFRw==', width: 640, height: 360 },
  phone: { mediaType: 'image/jpeg', base64: 'UEhPTkU=', width: 201, height: 360 },
  contract: {
    title: 'The night garden',
    purpose: 'A playable garden where Layla collects fireflies.',
    mustSay: ['Open every evening'],
  },
  brief: { palette: ['bg #101820', 'accent #f2c14e'], cast: ['Layla (hero, teal)'] },
  lang: 'en',
};

describe('createRemoteAiPlanProvider — reviewScene (POST /v1/scene/review)', () => {
  it('POSTs the pictures, contract and brief to the review endpoint and returns the verdict', async () => {
    const { calls, fetchImpl } = fakeFetch(() =>
      jsonResponse({
        version: 1,
        ok: false,
        findings: [
          {
            where: 'desktop',
            problem: ' The title sits on the brightest stars. ',
            fix: 'Add a dark scrim behind it.',
          },
          { problem: 'no fix given' },
          { where: 'tablet', problem: 'Layla is missing.', fix: 'Draw Layla in the foreground.' },
        ],
        usage: { inputTokens: 900, outputTokens: 80, cacheReadTokens: 0, cacheWriteTokens: 0 },
      }),
    );
    const usage: unknown[] = [];
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fetchImpl,
      headers: { authorization: 'Bearer secret' },
    });

    const review = await provider.reviewScene(REQUEST, { onUsage: (value) => usage.push(value) });

    expect(review).toEqual({
      ok: false,
      findings: [
        {
          where: 'desktop',
          problem: 'The title sits on the brightest stars.',
          fix: 'Add a dark scrim behind it.',
        },
        { problem: 'Layla is missing.', fix: 'Draw Layla in the foreground.' },
      ],
    });
    expect(usage).toEqual([
      expect.objectContaining({ inputTokens: 900, outputTokens: 80 }) as unknown,
    ]);
    const [call] = calls;
    expect(call?.input).toBe('https://assistant.example.test/v1/scene/review');
    expect(new Headers(call?.init.headers).get('authorization')).toBe('Bearer secret');
    expect(call?.body).toEqual({
      version: 1,
      lang: 'en',
      contract: REQUEST.contract,
      brief: REQUEST.brief,
      images: [
        { view: 'desktop', ...REQUEST.image },
        { view: 'phone', ...REQUEST.phone },
      ],
    });
  });

  it('reads a refusal, garbage and a server whose model cannot see as typed failures', async () => {
    const answer = (payload: unknown) =>
      createRemoteAiPlanProvider({
        endpoint: ENDPOINT,
        fetch: fakeFetch(() => jsonResponse(payload)).fetchImpl,
      }).reviewScene(REQUEST);
    await expect(answer({ version: 1, refusal: 'No.' })).rejects.toMatchObject({
      code: 'refusal',
      message: 'No.',
    });
    await expect(answer({ version: 1, ok: 'yes' })).rejects.toMatchObject({
      code: 'invalid-output',
      retryable: false,
    });
    await expect(
      answer({ version: 1, invalidOutput: { message: 'Cut off.' } }),
    ).rejects.toMatchObject({ code: 'invalid-output' });
    const blind = await answer({ version: 1, unsupported: 'cli:haiku cannot see pictures.' }).catch(
      (error: unknown) => error,
    );
    expect(blind).toBeInstanceOf(AiTaskUnsupportedError);
    expect(blind).toMatchObject({
      task: 'scene-review',
      message: 'cli:haiku cannot see pictures.',
    });
  });

  it('remembers a server that predates the endpoint (404), and never POSTs it again', async () => {
    const { calls, fetchImpl } = fakeFetch(() =>
      jsonResponse({ error: 'Endpoint not found.' }, 404),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const first = await provider.reviewScene(REQUEST).catch((error: unknown) => error);
    expect(first).toBeInstanceOf(AiTaskUnsupportedError);
    await expect(provider.reviewScene(REQUEST)).rejects.toBeInstanceOf(AiTaskUnsupportedError);
    expect(calls).toHaveLength(1);
  });

  it('refuses a picture over the size cap, and a stopped call, before posting', async () => {
    const { calls, fetchImpl } = fakeFetch(() =>
      jsonResponse({ version: 1, ok: true, findings: [] }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const huge = { ...REQUEST.image, base64: 'A'.repeat(AI_SCENE_REVIEW_MAX_IMAGE_CHARS + 4) };
    await expect(provider.reviewScene({ ...REQUEST, image: huge })).rejects.toMatchObject({
      code: 'resource-limit',
    });
    await expect(
      provider.reviewScene(REQUEST, { signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(0);
  });

  it('passes through the caching and catalog decorators, never remembered', async () => {
    const { calls, fetchImpl } = fakeFetch(() =>
      jsonResponse({ version: 1, ok: true, findings: [] }),
    );
    const remote = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const cached = createCachingAiPlanProvider(remote);
    expect(Object.hasOwn(cached, 'reviewScene')).toBe(true);
    await cached.reviewScene?.(REQUEST);
    await cached.reviewScene?.(REQUEST);
    expect(calls).toHaveLength(2);
    const direct = createDirectPlanProvider({ catalog: () => [], fallback: cached });
    await expect(direct.reviewScene?.(REQUEST)).resolves.toEqual({ ok: true, findings: [] });
    // A provider that cannot see stays one that cannot: the build then looks at nothing.
    const blind = createCachingAiPlanProvider({ propose: () => Promise.reject(new Error('x')) });
    expect(Object.hasOwn(blind, 'reviewScene')).toBe(false);
    expect(Object.hasOwn(createDirectPlanProvider({ catalog: () => [] }), 'reviewScene')).toBe(
      false,
    );
  });
});

describe('the scene review wire', () => {
  it('drops the phone picture when both would pass the size cap', () => {
    const phone = { ...REQUEST.image, base64: 'A'.repeat(AI_SCENE_REVIEW_MAX_IMAGE_CHARS - 4) };
    const body = aiSceneReviewWireRequest({ ...REQUEST, phone });
    expect(body.images.map(({ view }) => view)).toEqual(['desktop']);
  });

  it('reads a request as a server must: limits held, pictures checked, never decoded', () => {
    const body = aiSceneReviewWireRequest(REQUEST);
    expect(readAiSceneReviewWireRequest(JSON.parse(JSON.stringify(body)))).toEqual({
      request: body,
    });
    const refused = (value: unknown) =>
      'error' in readAiSceneReviewWireRequest(value) ? 'refused' : 'read';
    expect(refused({ ...body, version: 2 })).toBe('refused');
    expect(refused({ ...body, images: [] })).toBe('refused');
    expect(refused({ ...body, images: [{ ...body.images[0], mediaType: 'image/gif' }] })).toBe(
      'refused',
    );
    expect(
      refused({ ...body, images: [{ ...body.images[0], base64: 'data:image/jpeg;base64,QQ==' }] }),
    ).toBe('refused');
    expect(refused({ ...body, images: [{ ...body.images[0], width: 0 }] })).toBe('refused');
    expect(refused({ ...body, contract: { title: 'x' } })).toBe('refused');
    const long = readAiSceneReviewWireRequest({
      ...body,
      lang: '',
      contract: { title: 'T'.repeat(500), purpose: 'p', mustSay: ['a', 3, 'b'] },
    });
    expect(long).toMatchObject({
      request: { lang: 'en', contract: { mustSay: ['a', 'b'] } },
    });
    if ('request' in long) expect(long.request.contract.title).toHaveLength(200);
  });

  it('keeps at most five well-formed findings', () => {
    const findings = Array.from({ length: 9 }, (_, at) => ({
      problem: `Problem ${String(at)}`,
      fix: `Fix ${String(at)}`,
    }));
    const reading = readAiSceneReviewWireResponse({ version: 1, ok: false, findings });
    expect(reading.kind === 'review' ? reading.review.findings : []).toHaveLength(5);
    expect(readAiSceneReviewWireResponse('nope')).toMatchObject({ kind: 'invalid-output' });
    expect(readAiSceneReviewWireResponse({ version: 3, ok: true, findings: [] })).toMatchObject({
      kind: 'invalid-output',
    });
  });
});
