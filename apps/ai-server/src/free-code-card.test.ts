import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { asksForFreeCode } from './free-code-intent';
import { createHandler } from './handler';
import { FREE_CODE_CARD, FREE_CODE_OFF_HINT, buildPrompt, planPromptVariant } from './prompt';

/**
 * Free code mode on the server (2026-10-09). The card and the off-hint are
 * COPIES of builder-ai's (`agent/free-code-card.ts`): this app reaches the
 * builder only through `@craftkit/builder/wire`, which carries neither. The
 * real ones are imported here from their source file — the technique
 * script-card.test.ts uses — so an edit to the card in builder-ai fails this
 * test, not a live request.
 *
 * Both live in the PER-REQUEST half of the prompt, after the cached prefix:
 * the switch is flipped by a person mid-session, and a prefix that moved with
 * it would re-pay the cache on every flip.
 */
async function builderCard<T>(): Promise<T> {
  const url = new URL(
    '../../../packages/builder/ai/src/agent/free-code-card.ts',
    import.meta.url,
  ).href;
  return (await import(/* @vite-ignore */ url)) as T;
}

/** An edit as the panel sends one: markup, a page with content, no page playbook pinned. */
function editRequest(request: string, extra: Partial<AiPlanWireRequest> = {}): AiPlanWireRequest {
  return {
    version: 1,
    request,
    context: {
      fragments: [],
      totalTokens: 0,
      blocks: [{ type: 'customCode', description: 'A freely composed region.' }],
      templates: [],
      document: {
        schemaVersion: 1,
        surface: 'site',
        dir: 'rtl',
        rootId: 'root',
        nodes: [
          { id: 'root', type: 'page', props: {}, slots: { default: ['pg-hero'] } },
          {
            id: 'pg-hero',
            type: 'customCode',
            props: { label: 'Hero', tree: "<section class='bg-stone-950'>…</section>", css: '' },
            slots: {},
          },
        ],
      } as unknown as AiPlanWireRequest['context']['document'],
      selection: { ids: [] },
      commands: [{ name: 'setProp', argsSchema: { type: 'object' } }],
      outputContract: { version: 1, schema: { type: 'object' } },
      treeMarkup: true,
      utilities: 'tailwind',
    },
    ...extra,
  };
}

/** The same words on an empty page: a build. */
function buildRequest(request: string, extra: Partial<AiPlanWireRequest> = {}): AiPlanWireRequest {
  const edit = editRequest(request, extra);
  return {
    ...edit,
    context: {
      ...edit.context,
      document: {
        schemaVersion: 1,
        surface: 'site',
        dir: 'rtl',
        rootId: 'root',
        nodes: [{ id: 'root', type: 'page', props: {}, slots: { default: [] } }],
      } as unknown as AiPlanWireRequest['context']['document'],
    },
  };
}

function pagePlanRequest(request: string, extra: Partial<AiPlanWireRequest> = {}): AiPlanWireRequest {
  return { ...buildRequest(request, extra), task: 'page-plan' };
}

function lastMessage(request: AiPlanWireRequest): string {
  return buildPrompt(request).messages.at(-1)?.content ?? '';
}

const CODE_ASK = 'ابغى مشهد PixiJS مخصص فيه شخصيات تتحرك';
const PLAIN_ASK = 'make the hero title bigger';

describe('the free-code card (drift guard)', () => {
  it('is exactly builder-ai FREE_CODE_CARD, and the off-hint is exactly FREE_CODE_OFF_HINT', async () => {
    const real = await builderCard<{
      FREE_CODE_CARD: string;
      FREE_CODE_OFF_HINT: string;
      FREE_CODE_CARD_MAX_CHARS: number;
    }>();
    expect(FREE_CODE_CARD).toBe(real.FREE_CODE_CARD);
    expect(FREE_CODE_OFF_HINT).toBe(real.FREE_CODE_OFF_HINT);
    expect(FREE_CODE_CARD.length).toBeLessThanOrEqual(real.FREE_CODE_CARD_MAX_CHARS);
    expect(FREE_CODE_CARD.length).toBeLessThanOrEqual(2_800);
  }, 30_000);
});

describe('with the switch ON (freeCode === true)', () => {
  it.each([
    ['an edit', editRequest(PLAIN_ASK, { freeCode: true })],
    ['a build', buildRequest(PLAIN_ASK, { freeCode: true })],
  ])('appends the card to the per-request message of %s, before the request', (_label, request) => {
    const last = lastMessage(request);

    expect(last).toContain(`# Free code mode\n${FREE_CODE_CARD}`);
    expect(last.indexOf('# Free code mode')).toBeLessThan(last.indexOf('# The request'));
    // Never in the cached system segments.
    expect(JSON.stringify(buildPrompt(request).system)).not.toContain('FREE CODE MODE');
    expect(JSON.stringify(buildPrompt(request).system)).not.toContain('ck.stage');
    // The off-hint does not ride beside it, whatever the words are.
    expect(last).not.toContain(FREE_CODE_OFF_HINT);
  });

  it('carries the card whether or not the words ask for code', () => {
    expect(lastMessage(editRequest(CODE_ASK, { freeCode: true }))).toContain(FREE_CODE_CARD);
    expect(lastMessage(editRequest(PLAIN_ASK, { freeCode: true }))).toContain(FREE_CODE_CARD);
  });

  it('gives the page planner one line, not the card: its sections are written later', () => {
    const request = pagePlanRequest('a roastery page with a Pixi hero', { freeCode: true });
    expect(planPromptVariant(request)).toBe('page-plan');
    const last = lastMessage(request);

    expect(last).toContain('# Free code mode\nFREE CODE MODE is ON');
    expect(last).not.toContain('ck.stage');
    expect(last.indexOf('# Free code mode')).toBeLessThan(last.indexOf('# The request'));
  });

  it('reads the flag strictly: only the boolean true switches the card on', () => {
    for (const freeCode of ['true', 1, 'yes', {}, null, false]) {
      const request = editRequest(PLAIN_ASK, { freeCode } as never);

      expect(lastMessage(request), JSON.stringify(freeCode)).not.toContain('# Free code mode');
    }
  });
});

describe('with the switch OFF', () => {
  it.each([
    ['an edit', editRequest(CODE_ASK)],
    ['a build', buildRequest(CODE_ASK)],
    ['a page plan', pagePlanRequest(CODE_ASK)],
  ])('adds the one-line hint to %s that asks for page code, and never the card', (_label, request) => {
    const last = lastMessage(request);

    expect(last).toContain(`# Free code mode\n${FREE_CODE_OFF_HINT}`);
    expect(last.indexOf('# Free code mode')).toBeLessThan(last.indexOf('# The request'));
    expect(last).not.toContain('ck.stage');
    expect(JSON.stringify(buildPrompt(request))).not.toContain(FREE_CODE_CARD);
  });

  it('adds nothing to a request that does not ask for code', () => {
    for (const request of [
      editRequest(PLAIN_ASK),
      buildRequest('build a landing page for a game store'),
      pagePlanRequest('موقع لمتجر ألعاب فيديو'),
    ]) {
      expect(lastMessage(request)).not.toContain('# Free code mode');
    }
  });

  it('treats an explicit false like an absent flag', () => {
    expect(lastMessage(editRequest(CODE_ASK, { freeCode: false }))).toContain(FREE_CODE_OFF_HINT);
    expect(lastMessage(editRequest(PLAIN_ASK, { freeCode: false }))).not.toContain('# Free code mode');
  });
});

describe('the cached prefix', () => {
  it.each([
    ['an edit', editRequest],
    ['a build', buildRequest],
    ['a page plan', pagePlanRequest],
  ])('is byte-identical for %s whatever the switch and the words are', (_label, make) => {
    const baseline = buildPrompt(make(PLAIN_ASK)).system;

    expect(buildPrompt(make(PLAIN_ASK, { freeCode: true })).system).toEqual(baseline);
    expect(buildPrompt(make(CODE_ASK)).system).toEqual(baseline);
    expect(buildPrompt(make(CODE_ASK, { freeCode: true })).system).toEqual(baseline);
    expect(buildPrompt(make(PLAIN_ASK, { freeCode: false })).system).toEqual(baseline);
  });

  it('puts the cache breakpoint in the same place with the switch on or off', () => {
    const on = buildPrompt(editRequest(PLAIN_ASK, { freeCode: true })).system;
    const off = buildPrompt(editRequest(PLAIN_ASK)).system;

    expect(on.map((part) => 'cache_control' in part)).toEqual(off.map((part) => 'cache_control' in part));
  });

  it('is the only thing the switch changes: the history and the request text come through as they were', () => {
    const history = [
      { role: 'user' as const, text: 'hello' },
      { role: 'assistant' as const, text: 'hi' },
    ];
    const off = buildPrompt(editRequest(PLAIN_ASK, { history })).messages;
    const on = buildPrompt(editRequest(PLAIN_ASK, { history, freeCode: true })).messages;

    expect(on.slice(0, -1)).toEqual(off.slice(0, -1));
    expect(on.at(-1)?.content.replace(`# Free code mode\n${FREE_CODE_CARD}\n\n`, '')).toBe(
      off.at(-1)?.content,
    );
  });
});

describe('asksForFreeCode', () => {
  const rows: readonly { readonly text: string; readonly expected: boolean }[] = [
    // The refusal that started this: a custom PixiJS scene with moving characters.
    { text: 'ابغى مشهد PixiJS مخصص فيه شخصيات تتحرك', expected: true },
    { text: 'make a custom PixiJS scene with moving characters in the hero', expected: true },
    { text: 'أضف مشهد بيكسي في الهيرو', expected: true },
    { text: 'add a WebGL shader background', expected: true },
    { text: 'write some JavaScript that counts up the numbers', expected: true },
    { text: 'اكتب لي كود جافاسكربت يعد الأرقام', expected: true },
    { text: 'اكتب سكربت مخصص للعداد', expected: true },
    { text: 'use custom code for the hero animation', expected: true },
    { text: 'build me a small game inside the page', expected: true },
    { text: 'create a snake game', expected: true },
    { text: 'اعمل لي لعبة تفاعلية في الصفحة', expected: true },
    { text: 'ابي لعبة بسيطة داخل الموقع', expected: true },
    { text: 'animated characters walking across the footer', expected: true },
    { text: 'شخصيات متحركة تمشي في أسفل الصفحة', expected: true },
    { text: 'a 3D scene of the product that I can rotate', expected: true },
    { text: 'مشهد ثلاثي الأبعاد للمنتج', expected: true },
    { text: 'do it programmatically with a canvas game loop', expected: true },
    // Design and ordinary edits that only share a word with code.
    { text: 'make the hero title bigger', expected: false },
    { text: 'خلي عنوان الهيرو أكبر', expected: false },
    { text: 'use a script font for the headings', expected: false },
    { text: 'change the canvas background to cream', expected: false },
    { text: 'show the snippets in code blocks', expected: false },
    { text: 'build a landing page for a game store', expected: false },
    { text: 'create a game studio website', expected: false },
    { text: 'موقع لمتجر ألعاب فيديو', expected: false },
    { text: 'portfolio for a software programmer', expected: false },
    { text: 'موقع لمبرمج مستقل', expected: false },
    { text: 'add a particles scene behind the hero', expected: false },
    { text: 'أضف مشهد متحرك خلف الهيرو', expected: false },
    { text: 'add a gallery with 6 photos', expected: false },
    { text: 'make the buttons rounded', expected: false },
    { text: '', expected: false },
  ];

  it.each(rows)('reads "$text" as $expected', ({ text, expected }) => {
    expect(asksForFreeCode(text)).toBe(expected);
  });

  it('pins at least 30 rows, both ways', () => {
    expect(rows.length).toBeGreaterThanOrEqual(30);
    expect(rows.filter(({ expected }) => expected).length).toBeGreaterThanOrEqual(15);
    expect(rows.filter(({ expected }) => !expected).length).toBeGreaterThanOrEqual(10);
  });
});

describe('the handler', () => {
  function recording() {
    const seen: { params: { messages?: { content: unknown }[]; system?: unknown } }[] = [];
    const client = {
      messages: {
        stream: (params: { messages?: { content: unknown }[]; system?: unknown }) => {
          seen.push({ params });
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ rationale: 'ok', commands: [{ command: 'insertNode', args: {} }] }),
                  },
                ],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    return { client, seen };
  }

  function post(body: unknown): Request {
    return new Request('http://localhost/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function lastContent(params: { messages?: { content: unknown }[] } | undefined): string {
    const content = params?.messages?.at(-1)?.content;
    return typeof content === 'string' ? content : JSON.stringify(content);
  }

  it('hands the card to the model when the body says freeCode: true, and the same system segments as without', async () => {
    const { client, seen } = recording();
    const handle = createHandler({ client });

    expect((await handle(post(editRequest(PLAIN_ASK, { freeCode: true })))).status).toBe(200);
    expect((await handle(post(editRequest(PLAIN_ASK)))).status).toBe(200);

    expect(lastContent(seen[0]?.params)).toContain(FREE_CODE_CARD);
    expect(lastContent(seen[1]?.params)).not.toContain(FREE_CODE_CARD);
    expect(seen[0]?.params.system).toEqual(seen[1]?.params.system);
  });

  it('hands the off-hint, not the card, to a code request while the switch is off', async () => {
    const { client, seen } = recording();
    const handle = createHandler({ client });

    await handle(post(editRequest(CODE_ASK)));

    expect(lastContent(seen[0]?.params)).toContain(FREE_CODE_OFF_HINT);
    expect(lastContent(seen[0]?.params)).not.toContain(FREE_CODE_CARD);
  });

  it.each(['true', 1, 'yes', null, {}, []])(
    'refuses freeCode %j, which is not a boolean, with a 400 and no model call',
    async (freeCode) => {
      const { client, seen } = recording();
      const handle = createHandler({ client });

      const response = await handle(post(editRequest(PLAIN_ASK, { freeCode } as never)));

      expect(response.status).toBe(400);
      expect(((await response.json()) as { error: string }).error).toContain('freeCode');
      expect(seen).toHaveLength(0);
    },
  );

  it('accepts an explicit false', async () => {
    const { client, seen } = recording();
    const handle = createHandler({ client });

    expect((await handle(post(editRequest(PLAIN_ASK, { freeCode: false })))).status).toBe(200);
    expect(lastContent(seen[0]?.params)).not.toContain('# Free code mode');
  });
});
