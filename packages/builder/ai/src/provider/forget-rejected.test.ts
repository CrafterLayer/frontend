import { describe, expect, it } from 'vitest';

import { createCachingAiPlanProvider } from './caching-provider';
import type { AiPlan, AiPlanProvider, AssembledAiContext } from '../types';

const CONTEXT = { blocks: [], document: { nodes: [] } } as unknown as AssembledAiContext;

function plan(rationale: string): AiPlan {
  return { rationale, commands: [{ command: 'setProp', args: { id: 'a', key: 'b', value: 'c' } }] };
}

/**
 * A cache that stores every answer turns ONE rejected plan into a permanent
 * one: the person retries, the same dead plan returns in milliseconds, and the
 * model is never asked again. The provider cannot tell good from bad — the door
 * is on the far side of this boundary — so the caller says so.
 */
describe('a cached plan that failed the door', () => {
  it('is served again until it is forgotten, and then the model is asked afresh', async () => {
    let calls = 0;
    const inner: AiPlanProvider = {
      propose: () => {
        calls += 1;
        return Promise.resolve(plan(`answer ${String(calls)}`));
      },
    };
    const provider = createCachingAiPlanProvider(inner);

    expect((await provider.propose('same ask', CONTEXT)).rationale).toBe('answer 1');
    // The cache is doing its job: an identical ask costs nothing.
    expect((await provider.propose('same ask', CONTEXT)).rationale).toBe('answer 1');
    expect(calls).toBe(1);

    provider.forget?.('same ask', CONTEXT);

    expect((await provider.propose('same ask', CONTEXT)).rationale).toBe('answer 2');
    expect(calls).toBe(2);
  });

  it('forgets only the ask it was told about', async () => {
    let calls = 0;
    const inner: AiPlanProvider = {
      propose: (request) => {
        calls += 1;
        return Promise.resolve(plan(request));
      },
    };
    const provider = createCachingAiPlanProvider(inner);

    await provider.propose('first', CONTEXT);
    await provider.propose('second', CONTEXT);
    expect(calls).toBe(2);

    provider.forget?.('first', CONTEXT);

    await provider.propose('second', CONTEXT);
    expect(calls).toBe(2);
    await provider.propose('first', CONTEXT);
    expect(calls).toBe(3);
  });

  it('is harmless on a provider that never cached it', () => {
    const provider = createCachingAiPlanProvider({ propose: () => Promise.resolve(plan('x')) });

    expect(() => provider.forget?.('never asked', CONTEXT)).not.toThrow();
  });
});
