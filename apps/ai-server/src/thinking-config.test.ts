/**
 * "Thinking off" per model (2026-10-12). Claude Opus 5.5 and Claude Sonnet 5.5 refuse
 * `thinking: {type: 'disabled'}` with a 400, which failed every build and every «Improve» on
 * `api:claude-opus-5-5` / `api:claude-sonnet-5-5`. Ours to prove: those models get no thinking
 * field at effort `low`; Opus 5 and Haiku 5.5 keep `disabled` with effort held to `high`;
 * every other model, the CLI's slugs and OpenRouter's are untouched; thinking that is on is
 * never rewritten; and the plan request really sends the rewritten form.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { createCacheGate } from './cache-gate';
import { proposePlan } from './claude';
import { createRoutingClient } from './routing-client';
import { withModelThinking } from './thinking-config';

const OFF = { type: 'disabled' } as const;

describe('withModelThinking', () => {
  it.each(['api:claude-opus-5-5', 'claude-sonnet-5-5', 'api:claude-fable-5-1'])(
    'sends %s no thinking field, at effort low',
    (model) => {
      const sent = withModelThinking({ model, thinking: OFF, output_config: { effort: 'high' } });
      expect(sent).toEqual({ model, output_config: { effort: 'low' } });
    },
  );

  it('keeps disabled on Opus 5 and Haiku 5.5, holding effort to high', () => {
    expect(
      withModelThinking({
        model: 'claude-opus-5',
        thinking: OFF,
        output_config: { effort: 'max' },
      }),
    ).toEqual({ model: 'claude-opus-5', thinking: OFF, output_config: { effort: 'high' } });
    const haiku = {
      model: 'api:claude-haiku-5-5',
      thinking: OFF,
      output_config: { effort: 'low' },
    };
    expect(withModelThinking(haiku)).toBe(haiku);
  });

  it.each(['cli:claude-opus-5-5', 'anthropic/claude-opus-4.5', 'claude-opus-4-8', 'cli:haiku'])(
    'leaves %s as it was',
    (model) => {
      const params = { model, thinking: OFF };
      expect(withModelThinking(params)).toBe(params);
    },
  );

  it('never rewrites thinking that is on', () => {
    const params = { model: 'claude-opus-5-5', thinking: { type: 'adaptive' } };
    expect(withModelThinking(params)).toBe(params);
  });

  it.each(['api:claude-sonnet-4-6', 'api:claude-opus-4-5'])(
    'retains supported modern effort on %s',
    (model) => {
      const params = { model, thinking: OFF, output_config: { effort: 'low' } };
      expect(withModelThinking(params)).toBe(params);
    },
  );

  it.each([
    'api:claude-haiku-4-5',
    'claude-sonnet-4-5-20250929',
    'api:claude-opus-4-1',
    'api:claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
  ])('omits unsupported API effort on %s while preserving the schema and thinking', (model) => {
    const format = { type: 'json_schema', schema: { type: 'object' } };
    expect(
      withModelThinking({
        model,
        max_tokens: 8_192,
        thinking: OFF,
        output_config: { format, effort: 'low' },
      }),
    ).toEqual({
      model,
      max_tokens: 8_192,
      thinking: OFF,
      output_config: { format },
    });
  });
});

const REQUEST = {
  version: 1,
  request: 'Fill the drinks section',
  context: {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
    commands: [],
    outputContract: { version: 1, schema: { type: 'object' } },
  },
} as unknown as AiPlanWireRequest;

describe('the plan request', () => {
  it('sends a thinking-off call to Opus 5.5 in the form it accepts', async () => {
    const sent: Record<string, unknown>[] = [];
    const client = {
      messages: {
        stream: (params: Record<string, unknown>) => {
          sent.push(params);
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [{ type: 'text', text: '{"commands":[]}' }],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    await proposePlan(REQUEST, {
      client,
      model: 'api:claude-opus-5-5',
      thinkingOff: true,
      effort: 'medium',
      cacheGate: createCacheGate(),
    });
    expect(sent[0]).not.toHaveProperty('thinking');
    expect(sent[0]?.['output_config']).toMatchObject({ effort: 'low' });
  });

  it.each([
    'claude-haiku-4-5',
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
  ])('routes legacy %s initialization with valid thinking, cap and no effort', async (model) => {
    const sent: Record<string, unknown>[] = [];
    const api = {
      messages: {
        stream: (params: Record<string, unknown>) => {
          sent.push(params);
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                content: [{ type: 'text', text: '{"commands":[]}' }],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    const client = createRoutingClient({
      openrouter: api,
      api,
      cli: () => {
        throw new Error('Unexpected CLI call.');
      },
    });
    await proposePlan(REQUEST, {
      client,
      model: `api:${model}`,
      thinkingOff: true,
      effort: 'low',
      maxTokens: 8_192,
      cacheGate: createCacheGate(),
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ model, max_tokens: 8_192, thinking: OFF });
    expect(sent[0]?.['output_config']).toBeUndefined();
    expect(JSON.stringify(sent[0]?.['system'])).toContain('Required output format');
  });
});
