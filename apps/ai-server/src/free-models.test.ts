import { describe, expect, it } from 'vitest';

import { createFreeModelCatalog, freeModelsOf } from './free-models';
import type { OpenRouterFetch } from './openrouter-client';

interface Entry {
  id: string;
  name?: string;
  created?: number;
  context_length?: number;
  pricing?: { prompt: string; completion: string };
  architecture?: { input_modalities: string[]; output_modalities: string[] };
  supported_parameters?: string[];
  top_provider?: { max_completion_tokens?: number };
}

function entry(overrides: Entry): Entry {
  return {
    name: `${overrides.id} (free)`,
    created: 100,
    context_length: 262_144,
    pricing: { prompt: '0', completion: '0' },
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
    supported_parameters: ['reasoning'],
    top_provider: { max_completion_tokens: 65_536 },
    ...overrides,
  };
}

describe('freeModelsOf', () => {
  it('keeps only free text models that can hold a page plan, strict decoders first, newest next', () => {
    const { models } = freeModelsOf({
      data: [
        entry({ id: 'old/plain:free', created: 10 }),
        entry({ id: 'new/plain:free', created: 50 }),
        entry({ id: 'old/strict:free', created: 5, supported_parameters: ['structured_outputs'] }),
        // A paid slug that happens to carry the suffix is still refused by its price.
        entry({ id: 'paid/oops:free', pricing: { prompt: '0.000001', completion: '0' } }),
        // Not a `:free` slug at all.
        entry({ id: 'vendor/model' }),
        // Too small to hold a plan: window, then output ceiling.
        entry({ id: 'tiny/window:free', context_length: 65_536 }),
        entry({ id: 'tiny/output:free', top_provider: { max_completion_tokens: 8_192 } }),
        // Free and listed, and not writers.
        entry({ id: 'nvidia/content-safety:free' }),
        entry({
          id: 'image/maker:free',
          architecture: { input_modalities: ['text'], output_modalities: ['image'] },
        }),
      ],
    });

    expect(models.map((model) => model.id)).toEqual([
      'old/strict:free',
      'new/plain:free',
      'old/plain:free',
    ]);
    expect(models[0]).toMatchObject({ name: 'old/strict:free', structuredOutputs: true });
  });

  it('reads nothing from a body that is not a listing', () => {
    expect(freeModelsOf(null).models).toEqual([]);
    expect(freeModelsOf({ data: 'no' }).models).toEqual([]);
    expect(freeModelsOf({ data: [null, 3, { id: 7 }] }).models).toEqual([]);
  });

  it('hands the output ceiling of each model on, so a live one is clamped like a configured one', () => {
    const { facts } = freeModelsOf({ data: [entry({ id: 'a/b:free' })] });

    expect(facts.get('a/b:free')).toMatchObject({ listed: true, maxOutputTokens: 65_536 });
  });
});

describe('createFreeModelCatalog', () => {
  function listing(ids: readonly string[]): Response {
    return Response.json({ data: ids.map((id) => entry({ id })) });
  }

  it('asks OpenRouter once per TTL, however many pickers ask', async () => {
    let calls = 0;
    let clock = 1_000;
    const fetchImpl: OpenRouterFetch = () => {
      calls += 1;
      return Promise.resolve(listing(['a/b:free']));
    };
    const catalog = createFreeModelCatalog({ fetch: fetchImpl, ttlMs: 60_000, now: () => clock });

    await Promise.all([catalog.list(), catalog.list(), catalog.has('a/b:free')]);
    clock += 59_000;
    await catalog.list();
    expect(calls).toBe(1);
    clock += 2_000;
    await catalog.list();
    expect(calls).toBe(2);
  });

  it('notices a model that appeared and one that was withdrawn, and tells the log', async () => {
    let clock = 1_000;
    let ids = ['a/one:free', 'a/two:free'];
    const lines: string[] = [];
    const catalog = createFreeModelCatalog({
      fetch: () => Promise.resolve(listing(ids)),
      ttlMs: 1_000,
      now: () => clock,
      onLog: (line) => lines.push(line),
    });

    expect(await catalog.has('a/two:free')).toBe(true);
    ids = ['a/one:free', 'a/three:free'];
    clock += 2_000;

    expect(await catalog.has('a/two:free')).toBe(false);
    expect(await catalog.has('a/three:free')).toBe(true);
    expect(lines.at(-1)).toContain('+1, -1');
  });

  it('keeps the last good answer when a refresh fails, and says why', async () => {
    let clock = 1_000;
    let fail = false;
    const catalog = createFreeModelCatalog({
      fetch: () =>
        fail
          ? Promise.resolve(new Response('no', { status: 503 }))
          : Promise.resolve(listing(['a/b:free'])),
      ttlMs: 1_000,
      now: () => clock,
    });
    await catalog.list();
    fail = true;
    clock += 2_000;

    const after = await catalog.list();

    expect(after.models.map((model) => model.id)).toEqual(['a/b:free']);
    expect(after.error).toBe('OpenRouter answered 503');
  });

  it('never rejects, and answers empty when it has never been able to read the listing', async () => {
    const catalog = createFreeModelCatalog({
      fetch: () => Promise.reject(new Error('offline')),
    });

    expect(await catalog.list()).toMatchObject({ models: [], fetchedAt: 0, error: 'offline' });
    expect(await catalog.has('a/b:free')).toBe(false);
  });

  it('feeds each refresh’s facts to the OpenRouter client', async () => {
    const seen: string[] = [];
    const catalog = createFreeModelCatalog({
      fetch: () => Promise.resolve(listing(['a/b:free'])),
      onFacts: (facts) => seen.push(...facts.keys()),
    });

    await catalog.list();

    expect(seen).toEqual(['a/b:free']);
  });
});
