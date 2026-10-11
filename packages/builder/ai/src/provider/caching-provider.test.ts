import { describe, expect, it } from 'vitest';

import type {
  AiPagePlanDraftEvent,
  AiPagePlanProposal,
  AiPlan,
  AiPlanProvider,
  AiPromptEnhanceInput,
  AiPromptEnhancement,
  AssembledAiContext,
} from '../types';
import { createCachingAiPlanProvider } from './caching-provider';

function context(rootId = 'root'): AssembledAiContext {
  return {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    templates: [],
    document: { schemaVersion: 1, surface: 'landing', dir: 'ltr', rootId, nodes: [] },
    selection: { ids: [] },
    commands: [],
    outputContract: { version: 1, schema: { type: 'object' } },
    omissions: [],
  };
}

const plan: AiPlan = {
  rationale: 'Insert a hero.',
  commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
};

it('does not replay measured billing on a cached plan', async () => {
  const received: unknown[] = [];
  const provider = createCachingAiPlanProvider({
    propose: (_request, _context, live) => {
      live?.onUsage?.({
        inputTokens: 7,
        outputTokens: 3,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      });
      return Promise.resolve(plan);
    },
  });
  const onUsage = (usage: unknown) => {
    received.push(usage);
  };
  await provider.propose('ask', context(), { onUsage });
  await provider.propose('ask', context(), { onUsage });
  expect(received).toEqual([
    { inputTokens: 7, outputTokens: 3, cacheReadTokens: null, cacheWriteTokens: null },
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0,
      cached: true,
    },
  ]);
});

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
      {
        ...base,
        fragments: [
          {
            source: 'craftkit.session-memory',
            kind: 'data',
            trust: 'reviewed',
            title: 'Memory',
            body: 'Remember blue.',
            tokens: 4,
          },
        ],
      },
      { ...base, totalTokens: 7 },
      {
        ...base,
        blocks: [
          {
            type: 'hero',
            description: 'Hero',
            propsSchema: {},
            propertyIntents: {
              tabs: { design: ['tone'] },
              kinds: { 'color-role': ['tone'] },
            },
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
          ids: ['hero1'],
        },
      },
      {
        ...base,
        commands: [{ name: 'setProp', argsSchema: { type: 'object' } }],
      },
      {
        ...base,
        outputContract: {
          version: 1,
          schema: { type: 'object', required: ['rationale', 'commands'] },
        },
      },
      {
        ...base,
        omissions: [{ source: 'commands', reason: 'policy-filtered', omittedCount: 1 }],
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

  it('uses canonical JSON identity instead of caller object insertion order', async () => {
    const inner = countingProvider();
    const cached = createCachingAiPlanProvider(inner.provider);
    const first = context();
    const second = context();
    first.document = {
      ...first.document,
      nodes: [{ id: 'hero', type: 'hero', props: { tone: 'bold', heading: 'Hello' }, slots: {} }],
    };
    second.document = {
      ...second.document,
      nodes: [{ id: 'hero', type: 'hero', props: { heading: 'Hello', tone: 'bold' }, slots: {} }],
    };

    await cached.propose('same ask', first);
    await cached.propose('same ask', second);

    expect(inner.calls()).toBe(1);
  });

  it('never caches repair — a rejected plan must reach the model again', async () => {
    const inner = countingProvider();
    const cached = createCachingAiPlanProvider(inner.provider);

    await cached.repair?.('add a hero', context(), plan, []);
    await cached.repair?.('add a hero', context(), plan, []);

    expect(inner.calls()).toBe(2);
  });

  it('checks cancellation before repair delegation and after a delayed repair resolves', async () => {
    let repairCalls = 0;
    let release: ((value: AiPlan) => void) | undefined;
    let delayRepair = false;
    const cached = createCachingAiPlanProvider({
      propose: () => Promise.resolve(plan),
      repair: () => {
        repairCalls += 1;
        if (!delayRepair) return Promise.resolve(plan);
        return new Promise<AiPlan>((resolve) => {
          release = resolve;
        });
      },
    });
    const repair = cached.repair?.bind(cached);
    expect(repair).toBeDefined();
    if (repair === undefined) throw new Error('Caching provider must preserve inner repair.');

    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await expect(
      repair('add a hero', context(), plan, [], { signal: alreadyAborted.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(repairCalls).toBe(0);

    delayRepair = true;
    const midFlight = new AbortController();
    const pending = repair('add a hero', context(), plan, [], { signal: midFlight.signal });
    expect(repairCalls).toBe(1);
    midFlight.abort();
    release?.(plan);

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
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

/*
  The optional capabilities (2026-09-28). The playground wraps its remote
  provider in this decorator, and a decorator that forwarded only propose and
  repair made the page-plan build unreachable there (engine wave-2 verifier).
*/
describe('createCachingAiPlanProvider — page plans and rewrites', () => {
  const pagePlan: AiPagePlanProposal = { pagePlan: { title: 'Roastery' }, rationale: 'Warm.' };
  const rewrite: AiPromptEnhancement = {
    enhanced: 'Build a landing page for a specialty café in Amman.',
    understood: 'A café landing page.',
    changes: ['Fixed spelling'],
    questions: [],
    language: 'en',
  };
  const draft: AiPromptEnhanceInput = {
    text: 'bild page cafe amman',
    locale: 'en',
    intent: { kind: 'build-page', confidence: 0.8 },
    page: { empty: true, sections: [] },
    selection: null,
    answers: [],
  };

  function capable() {
    const calls = { pagePlan: 0, enhance: 0 };
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(plan),
      proposePagePlan: () => {
        calls.pagePlan += 1;
        return Promise.resolve(pagePlan);
      },
      enhancePrompt: () => {
        calls.enhance += 1;
        return Promise.resolve(rewrite);
      },
    };
    return { provider, calls };
  }

  it('offers neither capability when the inner provider has neither — absence is the fallback signal', () => {
    const cached = createCachingAiPlanProvider({ propose: () => Promise.resolve(plan) });

    expect(Object.hasOwn(cached, 'proposePagePlan')).toBe(false);
    expect(Object.hasOwn(cached, 'enhancePrompt')).toBe(false);
  });

  it('answers a repeated page-plan ask from memory, keyed apart from plans and by history', async () => {
    const inner = capable();
    const cached = createCachingAiPlanProvider(inner.provider);

    await expect(cached.proposePagePlan?.('Build my page', context())).resolves.toEqual(pagePlan);
    await cached.proposePagePlan?.('Build my page', context());
    expect(inner.calls.pagePlan).toBe(1);

    await cached.proposePagePlan?.('Build my page', context(), {
      history: [{ role: 'user', text: 'I run a roastery' }],
    });
    await cached.proposePagePlan?.('Build my other page', context());
    expect(inner.calls.pagePlan).toBe(3);
  });

  it('never answers a repair with the first answer, and forgets the refused first answer', async () => {
    const inner = capable();
    const cached = createCachingAiPlanProvider(inner.provider);
    const attempt = {
      pagePlan: { title: 'Roastery' },
      issues: [{ path: 'tokens', message: 'Write tokens…' }],
    };

    await cached.proposePagePlan?.('Build my page', context());
    await cached.proposePagePlan?.('Build my page', context(), { attempt });
    expect(inner.calls.pagePlan).toBe(2);

    // The repair proved the first answer was refused: the same ask reaches the model afresh.
    await cached.proposePagePlan?.('Build my page', context());
    expect(inner.calls.pagePlan).toBe(3);
  });

  it('checks cancellation before a page-plan hit and after the inner call resolves', async () => {
    const inner = capable();
    const cached = createCachingAiPlanProvider(inner.provider);
    await cached.proposePagePlan?.('Build my page', context());

    await expect(
      cached.proposePagePlan?.('Build my page', context(), { signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    let release: ((value: AiPagePlanProposal) => void) | undefined;
    const slow = createCachingAiPlanProvider({
      propose: () => Promise.resolve(plan),
      proposePagePlan: () =>
        new Promise<AiPagePlanProposal>((resolve) => {
          release = resolve;
        }),
    });
    const controller = new AbortController();
    const pending = slow.proposePagePlan?.('Build my page', context(), {
      signal: controller.signal,
    });
    controller.abort();
    release?.(pagePlan);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('passes the draft observer through on a miss, keeps it out of the key, and emits no drafts on a hit', async () => {
    const seenLive: unknown[] = [];
    const cached = createCachingAiPlanProvider({
      propose: () => Promise.resolve(plan),
      proposePagePlan: (_request, _context, live) => {
        seenLive.push(live);
        live?.onDraft?.({ kind: 'start' });
        live?.onDraft?.({ kind: 'text', text: '{"version":1' });
        return Promise.resolve(pagePlan);
      },
    });
    const firstDrafts: AiPagePlanDraftEvent[] = [];
    const first = {
      onDraft: (event: AiPagePlanDraftEvent) => {
        firstDrafts.push(event);
      },
    };

    await expect(cached.proposePagePlan?.('Build my page', context(), first)).resolves.toEqual(
      pagePlan,
    );
    // The very same options object reached the inner provider, observer included.
    expect(seenLive).toEqual([first]);
    expect(seenLive[0]).toBe(first);
    expect(firstDrafts).toEqual([{ kind: 'start' }, { kind: 'text', text: '{"version":1' }]);

    // A different observer is the same question: a hit, and the hit streams nothing.
    const hitDrafts: AiPagePlanDraftEvent[] = [];
    await expect(
      cached.proposePagePlan?.('Build my page', context(), {
        onDraft: (event) => {
          hitDrafts.push(event);
        },
      }),
    ).resolves.toEqual(pagePlan);
    expect(seenLive).toHaveLength(1);
    expect(hitDrafts).toEqual([]);
  });

  it('answers the exact same draft from memory, and asks again when anything in it differs', async () => {
    const inner = capable();
    const cached = createCachingAiPlanProvider(inner.provider);

    await expect(cached.enhancePrompt?.(draft)).resolves.toEqual(rewrite);
    await cached.enhancePrompt?.({ ...draft });
    expect(inner.calls.enhance).toBe(1);

    await cached.enhancePrompt?.({ ...draft, answers: [{ question: 'City?', answer: 'Amman' }] });
    await cached.enhancePrompt?.({ ...draft, locale: 'ar' });
    expect(inner.calls.enhance).toBe(3);
  });

  it('does not cache a failed rewrite', async () => {
    let calls = 0;
    const cached = createCachingAiPlanProvider({
      propose: () => Promise.resolve(plan),
      enhancePrompt: () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error('busy')) : Promise.resolve(rewrite);
      },
    });

    await expect(cached.enhancePrompt?.(draft)).rejects.toThrow('busy');
    await expect(cached.enhancePrompt?.(draft)).resolves.toEqual(rewrite);
    expect(calls).toBe(2);
  });
});
