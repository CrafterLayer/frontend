import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { proposePagePlan, proposePlan } from './claude';
import { createOpenRouterClient, type OpenRouterFetch } from './openrouter-client';
import { PAGE_PLAN_ANSWER_SCHEMA, PAGE_PLAN_EXAMPLE } from './plan-shape';
import { PAGE_PLAN_CONTRACT_MARK } from './prompt';

/**
 * `proposePlan` against a faked backend: what it ASKS for, and what it makes
 * of an answer. The handler tests cover the wire around it; these cover the
 * two things only this file decides — the request's own parameters, and the
 * one judged salvage every backend's answer goes through.
 */

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rationale: { type: 'string' },
    commands: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { command: { type: 'string' }, args: {}, title: { type: 'string' } },
      },
    },
    followUp: { type: 'string' },
  },
};

const REQUEST = {
  version: 1,
  request: 'Fill the drinks section',
  context: {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
    commands: [
      {
        name: 'setProp',
        argsSchema: {
          type: 'object',
          additionalProperties: false,
          properties: { id: { type: 'string' }, key: { type: 'string' }, value: {} },
        },
      },
    ],
    outputContract: { version: 1, schema: SCHEMA },
  },
} as unknown as AiPlanWireRequest;

const PLAN = {
  rationale: 'Fill the drinks section.',
  commands: [
    { command: 'setProp', args: { id: 'pg-1', key: 'title', value: 'Drinks' }, title: 'First' },
    {
      command: 'setProp',
      args: {
        id: 'pg-2',
        key: 'tree',
        value: {
          kind: 'root',
          children: [
            {
              kind: 'element',
              tag: 'section',
              children: [
                {
                  kind: 'element',
                  tag: 'ul',
                  children: [
                    { kind: 'element', tag: 'li', children: [{ kind: 'text', text: 'Espresso' }] },
                  ],
                },
              ],
            },
          ],
        },
      },
      title: 'Second',
    },
  ],
};

interface Recorded {
  readonly params: Record<string, unknown>;
  readonly options: { readonly headers?: Record<string, string> } | undefined;
}

/** A client that records what `proposePlan` asked for and answers with `PLAN`. */
function recordingClient(): { client: Anthropic; seen: Recorded[] } {
  const seen: Recorded[] = [];
  const client = {
    messages: {
      stream: (params: Record<string, unknown>, options?: Recorded['options']) => {
        seen.push({ params, options });
        return {
          on: () => undefined,
          finalMessage: () =>
            Promise.resolve({
              stop_reason: 'end_turn',
              stop_details: null,
              content: [{ type: 'text', text: JSON.stringify(PLAN) }],
              usage: { input_tokens: 1, output_tokens: 1 },
            }),
        };
      },
    },
  } as unknown as Anthropic;
  return { client, seen };
}

describe('proposePlan request', () => {
  /*
    The section writer's budget used to travel only as a private header, which
    the OpenRouter and CLI shims read and the real Messages API ignores — so on
    the default `sdk` backend, CRAFTKIT_AI_SECTION_EFFORT=low changed nothing.
  */
  it('asks the Messages API for the call budget as output_config.effort', async () => {
    const { client, seen } = recordingClient();

    const outcome = await proposePlan(REQUEST, { client, effort: 'low' });

    expect(outcome.kind).toBe('plan');
    expect(seen[0]?.params['output_config']).toEqual({
      format: { type: 'json_schema', schema: SCHEMA },
      effort: 'low',
    });
    // Still on the header too, for the CLI shim that reads nothing else.
    expect(seen[0]?.options?.headers).toEqual({ 'x-craftkit-internal-reasoning-effort': 'low' });
  });

  it("leaves the budget to the backend's default when the call names none", async () => {
    const { client, seen } = recordingClient();

    await proposePlan(REQUEST, { client });

    expect(seen[0]?.params['output_config']).toEqual({
      format: { type: 'json_schema', schema: SCHEMA },
    });
    expect(seen[0]?.options?.headers).toBeUndefined();
  });
});

describe('proposePlan answer', () => {
  /*
    Measured through the real OpenRouter shim: the last `}` of the second
    command's tree dropped. Repaired without a judge, `title` lands inside
    `args` and the strict argument schema refuses the plan; repaired with the
    request's shape judge, it comes back exactly as meant.
  */
  it("repairs an OpenRouter answer with the plan's shape judge and logs the model's own words", async () => {
    const good = JSON.stringify(PLAN);
    const end = good.indexOf(',"title":"Second"');
    const written = `${good.slice(0, end - 1)}${good.slice(end)}`;
    expect(() => JSON.parse(written) as unknown).toThrow();
    const frame = {
      choices: [{ index: 0, delta: { content: written }, finish_reason: 'stop' }],
    };
    const fetch = vi.fn<OpenRouterFetch>(() =>
      Promise.resolve(
        new Response(`data: ${JSON.stringify(frame)}\n\ndata: [DONE]\n\n`, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    );
    const answers: string[] = [];

    const outcome = await proposePlan(REQUEST, {
      client: createOpenRouterClient({ apiKey: 'k', model: 'vendor/model', fetch }),
      onAnswer: (text) => {
        answers.push(text);
      },
    });

    expect(answers).toEqual([written]);
    expect(outcome).toMatchObject({ kind: 'plan', plan: PLAN });
  });
});

describe('proposePagePlan', () => {
  const PAGE_PLAN_REQUEST = {
    ...REQUEST,
    request: 'Build a page for my roastery',
    task: 'page-plan',
  } as unknown as AiPlanWireRequest;
  const ANSWER = { rationale: PAGE_PLAN_EXAMPLE.rationale, pagePlan: PAGE_PLAN_EXAMPLE.pagePlan };

  function answeringClient(text: string): { client: Anthropic; seen: Recorded[] } {
    const seen: Recorded[] = [];
    const client = {
      messages: {
        stream: (params: Record<string, unknown>, options?: Recorded['options']) => {
          seen.push({ params, options });
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [{ type: 'text', text }],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    return { client, seen };
  }

  /*
    The request's own outputContract is the COMMANDS plan's schema — the
    client assembles one context for both tasks. Decoding a page plan into it
    would force `commands` into the answer, so the page plan brings its own.
  */
  it("decodes into the page-plan answer schema, never the context's plan contract", async () => {
    const { client, seen } = answeringClient(JSON.stringify(ANSWER));

    const outcome = await proposePagePlan(PAGE_PLAN_REQUEST, { client });

    expect(outcome).toMatchObject({ kind: 'page-plan', ...ANSWER });
    expect(seen[0]?.params['output_config']).toEqual({
      format: { type: 'json_schema', schema: PAGE_PLAN_ANSWER_SCHEMA },
    });
    expect(seen[0]?.params['thinking']).toEqual({ type: 'adaptive', display: 'summarized' });
    const system = seen[0]?.params['system'] as { text: string }[];
    expect(system[0]?.text).toContain(PAGE_PLAN_CONTRACT_MARK);
  });

  it('salvages a dropped closer before reading the page plan, and logs what the model wrote', async () => {
    const good = JSON.stringify(ANSWER);
    const cut = good.indexOf('},{"key":"menu"');
    const written = `${good.slice(0, cut)}${good.slice(cut + 1)}`;
    const answers: string[] = [];
    const { client } = answeringClient(written);

    const outcome = await proposePagePlan(PAGE_PLAN_REQUEST, {
      client,
      onAnswer: (text) => {
        answers.push(text);
      },
    });

    expect(answers).toEqual([written]);
    expect(outcome).toMatchObject({ kind: 'page-plan', ...ANSWER });
  });

  it('reads a non-JSON answer as invalid output that names the page plan', async () => {
    const { client } = answeringClient('I would design a warm café page.');

    const outcome = await proposePagePlan(PAGE_PLAN_REQUEST, { client });

    expect(outcome.kind).toBe('invalid-output');
    expect(outcome.kind === 'invalid-output' ? outcome.message : '').toMatch(/page plan/u);
  });
});
