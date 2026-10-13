import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import type { AiSceneReviewWireRequest } from '@craftkit/builder/wire';

import { createHandler } from './handler';
import { estimateTokens } from './prompt';
import { minCacheableTokens } from './prompt-cache';
import {
  SCENE_REVIEW_ANSWER_SCHEMA,
  SCENE_REVIEW_DEEP_MAX_TOKENS,
  SCENE_REVIEW_MAX_TOKENS,
  SCENE_REVIEW_PATH,
  SCENE_REVIEW_RULES,
  canSeePictures,
  readSceneReviewMessage,
  reviewScene,
  sceneReviewPageText,
  sceneReviewParams,
} from './scene-review';

/*
  The scene review (visual self-review, 2026-10-13) against a faked backend: the request it
  sends — the pictures as image blocks beside the contract, the answer schema, a small budget,
  thinking off unless asked for depth — what it makes of an answer, refusals and garbage, and
  the route behind the handler's door. No live model is called.
*/

interface Seen {
  readonly params: Record<string, unknown>;
  readonly options: { readonly headers?: Record<string, string>; readonly signal?: unknown };
}

/** A client the SDK would build (so it can see pictures), answering `text`. */
function seeing(text: string, stop = 'end_turn', seen: Seen[] = []): Anthropic {
  const client = Object.create(Anthropic.prototype) as Anthropic;
  Object.assign(client, {
    messages: {
      stream: (params: Record<string, unknown>, options: Seen['options']) => {
        seen.push({ params, options });
        return {
          on: () => undefined,
          finalMessage: () =>
            Promise.resolve({
              stop_reason: stop,
              stop_details: stop === 'refusal' ? { explanation: 'Not this one.' } : null,
              content: [{ type: 'text', text }],
              usage: { input_tokens: 880, output_tokens: 74 },
            }),
        };
      },
    },
  });
  return client;
}

const REQUEST: AiSceneReviewWireRequest = {
  version: 1,
  lang: 'ar',
  contract: {
    title: 'حديقة الليل',
    purpose: 'A playable garden where Layla collects fireflies.',
    mustSay: ['Open every evening'],
  },
  brief: {
    palette: ['bg #101820', 'accent #f2c14e'],
    cast: ['Layla (hero, teal)'],
    setting: 'arcade · forest, night',
  },
  images: [
    { view: 'desktop', mediaType: 'image/jpeg', base64: 'REVTSw==', width: 640, height: 360 },
    { view: 'phone', mediaType: 'image/jpeg', base64: 'UEhPTkU=', width: 201, height: 360 },
  ],
};

const VERDICT = {
  ok: false,
  findings: [
    {
      where: 'desktop',
      problem: 'The title sits on bright fireflies.',
      fix: 'Add a dark scrim behind it.',
    },
  ],
};

describe('reviewScene', () => {
  it('shows the pictures as image blocks beside the contract, with the schema and a small budget', async () => {
    const seen: Seen[] = [];
    const outcome = await reviewScene(REQUEST, {
      client: seeing(JSON.stringify(VERDICT), 'end_turn', seen),
      model: 'claude-haiku-5-5',
    });

    expect(outcome).toEqual({
      kind: 'review',
      ok: false,
      findings: VERDICT.findings,
      usage: expect.objectContaining({ inputTokens: 880, outputTokens: 74 }) as unknown,
    });
    const [call] = seen;
    const params = call?.params as {
      model: string;
      max_tokens: number;
      thinking?: { type: string };
      system: { text: string }[];
      messages: { role: string; content: { type: string; text?: string; source?: unknown }[] }[];
      output_config: { format: { schema: unknown }; effort?: string };
    };
    expect(params.model).toBe('claude-haiku-5-5');
    expect(params.max_tokens).toBe(SCENE_REVIEW_MAX_TOKENS);
    expect(params.thinking).toEqual({ type: 'disabled' });
    // What every review of a build shares comes first — the rules, then the page — and carries
    // no breakpoint: together they are under the smallest prefix a model caches.
    expect(params.system).toEqual([
      { type: 'text', text: SCENE_REVIEW_RULES },
      { type: 'text', text: sceneReviewPageText(REQUEST) },
    ]);
    expect(params.system[1]?.text).toContain('Page language: ar (right-to-left');
    expect(params.system[1]?.text).toContain('Palette: bg #101820, accent #f2c14e');
    expect(params.output_config.format.schema).toBe(SCENE_REVIEW_ANSWER_SCHEMA);
    const [turn] = params.messages;
    expect(turn?.role).toBe('user');
    expect(turn?.content.map(({ type }) => type)).toEqual([
      'text',
      'text',
      'image',
      'text',
      'image',
      'text',
    ]);
    expect(turn?.content[2]?.source).toEqual({
      type: 'base64',
      media_type: 'image/jpeg',
      data: 'REVTSw==',
    });
    expect(turn?.content[4]?.source).toMatchObject({ data: 'UEhPTkU=' });
    const contract = turn?.content[0]?.text ?? '';
    expect(contract).toContain('Title: حديقة الليل');
    expect(contract).toContain('Must say: "Open every evening"');
    expect(contract).toContain('Cast the picture should show: Layla (hero, teal)');
    expect(contract).toContain('Kind and setting: arcade · forest, night');
    expect(contract).not.toContain('Palette');
    expect(turn?.content[1]?.text).toMatch(/^Desktop, a 1280×720 screen/u);
    expect(turn?.content[3]?.text).toMatch(/^Phone, 390 px wide/u);
    expect(call?.options.headers).toEqual({ 'x-craftkit-internal-reasoning-effort': 'low' });
  });

  it('thinks only at a deep effort, and then with room for it', async () => {
    const seen: Seen[] = [];
    await reviewScene(REQUEST, {
      client: seeing(JSON.stringify(VERDICT), 'end_turn', seen),
      model: 'claude-haiku-4-5',
      effort: 'high',
    });
    expect(seen[0]?.params).toMatchObject({
      max_tokens: SCENE_REVIEW_DEEP_MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
    });
    // Claude Opus 5.5 cannot turn thinking off: it thinks least at effort low instead.
    const always: Seen[] = [];
    await reviewScene(REQUEST, {
      client: seeing(JSON.stringify(VERDICT), 'end_turn', always),
      model: 'claude-opus-5-5',
    });
    expect(always[0]?.params).not.toHaveProperty('thinking');
    expect(always[0]?.params).toMatchObject({ output_config: { effort: 'low' } });
  });
});

describe('the shared prefix', () => {
  /*
    The breakpoint question, measured (2026-10-13): the rules and the page block are what every
    review of a build shares. Even the largest page block the wire admits — a 35-character
    right-to-left language and ten 48-character colours — leaves the pair under 512 tokens by the
    server's estimate, the smallest minimum any model caches, so no breakpoint is placed rather
    than one that never writes. When this fails, the rules grew: the breakpoint comes back by
    itself (`sharedPrefixBlocks`), and this note and the one in scene-review.ts need new numbers.
  */
  it('stays under the smallest cacheable minimum even at the wire’s limits', () => {
    const largest = sceneReviewPageText({
      lang: `ar-${'x'.repeat(32)}`,
      brief: { palette: Array.from({ length: 10 }, (_, at) => String(at).padEnd(48, '#')) },
    });
    const shared = estimateTokens(SCENE_REVIEW_RULES) + estimateTokens(largest);
    expect(shared).toBeLessThan(512);
    expect(minCacheableTokens('claude-haiku-5-5')).toBe(512);
    const params = sceneReviewParams(REQUEST, { model: 'api:claude-haiku-5-5' });
    expect(JSON.stringify(params.system)).not.toContain('cache_control');
  });
});

describe('readSceneReviewMessage', () => {
  function message(text: string, stop = 'end_turn'): Anthropic.Message {
    return {
      stop_reason: stop,
      stop_details: stop === 'refusal' ? { explanation: 'Not this one.' } : null,
      content: [{ type: 'text', text }],
      usage: { input_tokens: 10, output_tokens: 5 },
    } as unknown as Anthropic.Message;
  }

  it('reads a verdict out of prose, trusting the findings over the flag', () => {
    const fenced = `Here you go:\n\`\`\`json\n${JSON.stringify({ ok: true, findings: VERDICT.findings })}\n\`\`\``;
    expect(readSceneReviewMessage(message(fenced))).toMatchObject({
      kind: 'review',
      ok: false,
      findings: VERDICT.findings,
    });
    expect(readSceneReviewMessage(message('{"ok":false,"findings":[]}'))).toMatchObject({
      kind: 'review',
      ok: true,
      findings: [],
    });
  });

  it('turns a refusal, a cut-off and garbage into their outcomes', () => {
    expect(readSceneReviewMessage(message('', 'refusal'))).toMatchObject({
      kind: 'refusal',
      message: 'Not this one.',
    });
    expect(readSceneReviewMessage(message('{"ok":fal', 'max_tokens'))).toMatchObject({
      kind: 'invalid-output',
    });
    expect(readSceneReviewMessage(message('The scene looks lovely!'))).toMatchObject({
      kind: 'invalid-output',
    });
    expect(readSceneReviewMessage(message('{"verdict":"fine"}'))).toMatchObject({
      kind: 'invalid-output',
    });
  });
});

describe('canSeePictures', () => {
  it('sees through the Messages API only', () => {
    const sdk = seeing('{}');
    const shim = { messages: { stream: () => undefined } } as unknown as Anthropic;
    expect(canSeePictures(sdk, 'claude-haiku-5-5')).toBe(true);
    expect(canSeePictures(shim, 'api:claude-haiku-5-5')).toBe(true);
    expect(canSeePictures(shim, 'cli:haiku')).toBe(false);
    expect(canSeePictures(shim, 'anthropic/claude-haiku-4.5')).toBe(false);
    expect(canSeePictures(shim, 'claude-haiku-5-5')).toBe(false);
    expect(canSeePictures(sdk, 'cli:haiku')).toBe(false);
  });
});

describe(`POST ${SCENE_REVIEW_PATH}`, () => {
  function post(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request(`https://assistant.example.test${SCENE_REVIEW_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer t', ...headers },
      body: JSON.stringify(body),
    });
  }

  it('answers a verdict on the fastest model of the route, and reports its usage', async () => {
    const seen: Seen[] = [];
    const usage: { task?: string }[] = [];
    const handle = createHandler({
      client: seeing(JSON.stringify(VERDICT), 'end_turn', seen),
      authToken: 't',
      model: 'claude-opus-5',
      models: ['claude-haiku-5-5'],
      onUsage: (report) => usage.push(report),
    });

    const response = await handle(post(REQUEST));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 1, ...VERDICT });
    expect(JSON.parse(response.headers.get('x-craftkit-ai-usage') ?? '{}')).toMatchObject({
      inputTokens: 880,
    });
    expect(seen[0]?.params['model']).toBe('claude-haiku-5-5');
    expect(usage.map(({ task }) => task)).toEqual(['scene-review']);
  });

  it('refuses a malformed request, and answers unsupported where no model can see', async () => {
    const seen: Seen[] = [];
    const handle = createHandler({ client: seeing('{}', 'end_turn', seen), authToken: 't' });
    expect((await handle(post({ ...REQUEST, images: [] }))).status).toBe(400);
    expect((await handle(post(REQUEST, { 'x-craftkit-ai-effort': 'huge' }))).status).toBe(400);
    expect((await handle(post(REQUEST, { authorization: 'Bearer wrong' }))).status).toBe(401);

    const shim = { messages: { stream: () => undefined } } as unknown as Anthropic;
    const blind = createHandler({ client: shim, model: 'cli:haiku' });
    const answer = await blind(post(REQUEST));
    expect(answer.status).toBe(200);
    expect(await answer.json()).toMatchObject({
      version: 1,
      unsupported: expect.any(String) as unknown,
    });
    expect(seen).toHaveLength(0);
  });

  it('answers a refusal and garbage as v1 bodies the client reads', async () => {
    const refusing = createHandler({ client: seeing('', 'refusal') });
    expect(await (await refusing(post(REQUEST))).json()).toEqual({
      version: 1,
      refusal: 'Not this one.',
    });
    const babbling = createHandler({ client: seeing('Nice scene.') });
    expect(await (await babbling(post(REQUEST))).json()).toMatchObject({
      version: 1,
      invalidOutput: { message: expect.any(String) as unknown },
    });
  });
});
