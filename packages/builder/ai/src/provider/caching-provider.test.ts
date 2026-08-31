import { describe, expect, it } from 'vitest';

import type { AiPlan, AiPlanProvider, AssembledAiContext } from '../types';
import { createCachingAiPlanProvider } from './caching-provider';

function context(rootId = 'root'): AssembledAiContext {
  return {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'landing', dir: 'ltr', rootId, nodes: [] },
    selection: { ids: [], nodes: [] },
  };
}

const plan: AiPlan = {
  rationale: 'Insert a hero.',
  commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
};

function countingProvider(): { provider: AiPlanProvider; calls: () => number } {
  let calls = 0;
  return {
    provider: {
      propose: () => {
        calls += 1;
        return Promise.resolve(plan);
      },
      repair: () => {
        calls += 1;
        return Promise.resolve(plan);
      },
    },
    calls: () => calls,
  };
}

describe('createCachingAiPlanProvider', () => {
  it('answers a repeated ask on the same document from the cache', async () => {
    const inner = countingProvider();
    const cached = createCachingAiPlanProvider(inner.provider);

    const first = await cached.propose('add a hero', context());
    const second = await cached.propose('add a hero', context());

    expect(first).toEqual(plan);
    expect(second).toEqual(plan);
    expect(inner.calls()).toBe(1);
  });

  it('misses when the request, the document, or the conversation differs', async () => {
    const inner = countingProvider();
    const cached = createCachingAiPlanProvider(inner.provider);

    await cached.propose('add a hero', context());
    await cached.propose('add a footer', context());
    await cached.propose('add a hero', context('other-root'));
    await cached.propose('add a hero', context(), {
      history: [{ role: 'user', text: 'make it blue' }],
    });

    expect(inner.calls()).toBe(4);
  });

  it('never caches repair — a rejected plan must reach the model again', async () => {
    const inner = countingProvider();
    const cached = createCachingAiPlanProvider(inner.provider);

    await cached.repair?.('add a hero', context(), plan, []);
    await cached.repair?.('add a hero', context(), plan, []);

    expect(inner.calls()).toBe(2);
  });

  it('evicts the oldest entry once past capacity', async () => {
    const inner = countingProvider();
    const cached = createCachingAiPlanProvider(inner.provider, { capacity: 2 });

    await cached.propose('one', context());
    await cached.propose('two', context());
    await cached.propose('three', context()); // evicts "one"
    await cached.propose('one', context()); // miss again

    expect(inner.calls()).toBe(4);
  });
});
