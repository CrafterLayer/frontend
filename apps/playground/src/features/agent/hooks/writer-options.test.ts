/**
 * Every page build's writers (smarter live workers, 2026-10-12): a pool of the person's worker
 * count — the site's own when the page is one of a site's — and a provider that reports to it,
 * so a rate limit halves the writers and answers grow them back.
 */
import { describe, expect, it } from 'vitest';

import { createAiWriterPool, type AiPlan, type AiPlanProvider } from '@craftkit/builder';

import { writerOptions } from './agent-controller/writer-options';

const PLAN = { rationale: 'ok', commands: [] } as unknown as AiPlan;

function provider(answer: () => Promise<AiPlan>): AiPlanProvider {
  return { propose: answer } as unknown as AiPlanProvider;
}

function busy(): Error {
  return Object.assign(new Error('Too many requests'), { status: 429 });
}

describe('writerOptions', () => {
  it('gives a page built alone its own pool of the worker count', () => {
    const options = writerOptions(
      provider(() => Promise.resolve(PLAN)),
      3,
    );
    expect(options.writerPool?.ceiling).toBe(3);
  });

  it('keeps a site page on the site’s one pool', () => {
    const shared = createAiWriterPool(6);
    expect(
      writerOptions(
        provider(() => Promise.resolve(PLAN)),
        6,
        shared,
      ).writerPool,
    ).toBe(shared);
  });

  it('halves the writers when the provider says "too many"', async () => {
    const options = writerOptions(
      provider(() => Promise.reject(busy())),
      6,
    );
    await expect(options.provider?.propose('x', {} as never)).rejects.toThrow('Too many');
    expect(options.writerPool?.limit).toBe(3);
  });
});
