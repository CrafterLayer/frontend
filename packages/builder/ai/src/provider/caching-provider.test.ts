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

  it('keys every context field, including fragments, catalogs, selection details, and skills', async () => {
    const inner = countingProvider();
    const cached = createCachingAiPlanProvider(inner.provider);
    const base = context();
    const variants: AssembledAiContext[] = [
      { ...base, fragments: [{ title: 'Memory', body: 'Remember blue.', tokens: 4 }] },
      { ...base, totalTokens: 7 },
      {
        ...base,
        blocks: [
          {
            type: 'hero',
            description: 'Hero',
            propsSchema: {},
            examples: [],
            slots: [],
          },
        ],
      },
      {
        ...base,
        templates: [
          {
            id: 'landing',
            name: 'Landing',
            rootType: 'section',
            nodeCount: 3,
            blockTypes: ['hero'],
          },
        ],
      },
      {
        ...base,
        selection: {
          ids: [],
          nodes: [{ id: 'hero1', type: 'hero', props: { heading: 'Selected' }, slots: {} }],
        },
      },
      {
        ...base,
        skillCatalog: [
          {
            schemaVersion: 1,
            id: 'skill.design',
            name: 'Design',
            description: 'Design skill',
            version: '1.0.0',
            tags: [],
            source: 'host',
            trust: 'reviewed',
            activation: { mode: 'explicit' },
            priority: 0,
            dependencies: [],
            conflicts: [],
            referencePaths: [],
            contentFingerprint: 'skill-v1-12345678',
          },
        ],
      },
      {
        ...base,
        skills: [
          {
            id: 'skill.design',
            version: '1.0.0',
            contentFingerprint: 'skill-v1-12345678',
            reason: 'explicit',
          },
        ],
      },
    ];

    await cached.propose('same ask', base);
    for (const variant of variants) await cached.propose('same ask', variant);

    expect(inner.calls()).toBe(variants.length + 1);
  });

  it('checks cancellation before a cache hit and after an inner provider resolves', async () => {
    const inner = countingProvider();
    const cached = createCachingAiPlanProvider(inner.provider);
    await cached.propose('warm', context());

    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await expect(
      cached.propose('warm', context(), { signal: alreadyAborted.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(inner.calls()).toBe(1);

    let release: ((value: AiPlan) => void) | undefined;
    const delayed = createCachingAiPlanProvider({
      propose: () =>
        new Promise<AiPlan>((resolve) => {
          release = resolve;
        }),
    });
    const midFlight = new AbortController();
    const pending = delayed.propose('slow', context(), { signal: midFlight.signal });
    midFlight.abort();
    release?.(plan);

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
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

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid capacity %s', (capacity) => {
    expect(() => createCachingAiPlanProvider(countingProvider().provider, { capacity })).toThrow(
      /capacity/i,
    );
  });
});
