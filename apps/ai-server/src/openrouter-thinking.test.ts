import { describe, expect, it, vi } from 'vitest';

import {
  createOpenRouterClient,
  openRouterFactsOf,
  type OpenRouterModelFacts,
} from './openrouter-client';

const INIT = 'Fill this mural\nSCENE INITIALIZATION v1: aurora-curtains';

async function requestedReasoning(
  model: string,
  mandatory?: boolean,
  overrides: Readonly<Record<string, unknown>> = {},
): Promise<unknown> {
  const fetch = vi.fn((_input: string, _options: RequestInit) =>
    Promise.resolve(
      new Response(
        'data: {"choices":[{"delta":{"content":"{}"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      ),
    ),
  );
  const facts = openRouterFactsOf({
    supported_parameters: ['reasoning'],
    ...(mandatory === undefined ? {} : { reasoning: { mandatory } }),
  });
  await createOpenRouterClient({
    apiKey: 'test',
    model,
    fetch,
    models: new Map<string, OpenRouterModelFacts>([[model, facts]]),
  })
    .messages.stream({
      max_tokens: 8_192,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: INIT }],
      ...overrides,
    } as never)
    .finalMessage();
  const body = fetch.mock.calls[0]?.[1].body;
  if (typeof body !== 'string') throw new Error('Expected a JSON request body.');
  return (JSON.parse(body) as Record<string, unknown>)['reasoning'];
}

describe('OpenRouter reasoning for tested scene initialization', () => {
  it.each(['anthropic/claude-sonnet-4.5', 'anthropic/claude-opus-5', 'anthropic/claude-haiku-5-5'])(
    'disables for the supported Claude line %s',
    async (model) => {
      expect(await requestedReasoning(model)).toEqual({ enabled: false });
    },
  );

  it.each(['anthropic/claude-sonnet-5-5', 'anthropic/claude-opus-5-5', 'anthropic/claude-fable-5'])(
    'keeps compatible low reasoning for mandatory Claude %s',
    async (model) => {
      expect(await requestedReasoning(model, false)).toEqual({ effort: 'low' });
    },
  );

  it('uses provider-declared optional reasoning, while mandatory/unknown stays at low', async () => {
    expect(await requestedReasoning('vendor/model', false)).toEqual({ enabled: false });
    expect(await requestedReasoning('vendor/model', true)).toEqual({ effort: 'low' });
    expect(await requestedReasoning('vendor/model')).toEqual({ effort: 'low' });
    expect(await requestedReasoning('anthropic/claude-opus-5', true)).toEqual({ effort: 'low' });
    expect(await requestedReasoning('anthropic/claude-future-model')).toEqual({ effort: 'low' });
  });

  it.each([
    { messages: [{ role: 'user', content: 'READY SCENES: choose a scene or write your own' }] },
    { output_config: { effort: 'high' } },
    { thinking: { type: 'adaptive' } },
  ])('retains general/deep/bespoke reasoning mapping: %o', async (overrides) => {
    const expected = 'output_config' in overrides ? 'high' : 'low';
    expect(await requestedReasoning('anthropic/claude-opus-5', false, overrides)).toEqual({
      effort: expected,
    });
  });

  it('retains provider mandatory facts only when they are actual booleans', () => {
    expect(openRouterFactsOf({ reasoning: { mandatory: false } }).reasoningMandatory).toBe(false);
    expect(
      openRouterFactsOf({ reasoning: { mandatory: 'false' } }).reasoningMandatory,
    ).toBeUndefined();
  });
});
