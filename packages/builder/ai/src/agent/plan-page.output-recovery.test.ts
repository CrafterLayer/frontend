import { describe, expect, it, vi } from 'vitest';

import { AiProviderError } from '../provider/errors';
import type { AiPagePlanAttempt, AiPlanProvider, AiProposePagePlanOptions } from '../types';
import { BUILDER_PLAN } from './page-plan/tidy.fixtures';
import { planAiPage } from './plan-page';
import { incidentOptions } from './run-agent.incident-fixtures';
import type { AiPagePlanEvent } from './types';

const INVALID_OUTPUT = new AiProviderError('The assistant answer was not valid JSON.', {
  code: 'invalid-output',
  retryable: true,
});

function planningOptions() {
  const { onEvent, ...base } = incidentOptions();
  void onEvent;
  return base;
}

describe('page-plan output recovery', () => {
  it('repairs malformed output once and preserves its failure as repair context', async () => {
    const base = planningOptions();
    const before = base.kernel.getDocument();
    const attempts: (AiPagePlanAttempt | undefined)[] = [];
    const events: AiPagePlanEvent[] = [];
    const provider: AiPlanProvider = {
      ...base.provider,
      proposePagePlan: (_request, _context, live) => {
        attempts.push(live?.attempt);
        return attempts.length === 1
          ? Promise.reject(INVALID_OUTPUT)
          : Promise.resolve({ pagePlan: { ...BUILDER_PLAN } });
      },
    };
    const result = await planAiPage('Plan a page', {
      ...base,
      provider,
      onEvent: (event) => events.push(event),
    });

    expect(result).toMatchObject({ attempts: 2, plan: { title: BUILDER_PLAN.title } });
    expect(attempts).toEqual([
      undefined,
      { pagePlan: {}, issues: [{ path: '', message: INVALID_OUTPUT.message }] },
    ]);
    expect(events.map(({ type }) => type)).toEqual([
      'page-plan.started',
      'page-plan.proposing',
      'page-plan.repairing',
      'page-plan.proposing',
      'page-plan.ready',
    ]);
    expect(base.kernel.getDocument()).toBe(before);
    expect(base.kernel.transactions()).toHaveLength(0);
  });

  it('does not grant a third call when the parse correction fails validation', async () => {
    const base = planningOptions();
    const proposePagePlan = vi
      .fn()
      .mockRejectedValueOnce(INVALID_OUTPUT)
      .mockResolvedValue({ pagePlan: {} });
    const result = await planAiPage('Plan a page', {
      ...base,
      provider: { ...base.provider, proposePagePlan },
    });
    expect(result).toMatchObject({ error: { source: 'plan', code: 'plan-rejected' } });
    expect(proposePagePlan).toHaveBeenCalledTimes(2);
  });

  it('reports a failed correction as retryable output failure, without another call', async () => {
    const base = planningOptions();
    const events: AiPagePlanEvent[] = [];
    const proposePagePlan = vi.fn(() => Promise.reject(INVALID_OUTPUT));
    const result = await planAiPage('Plan a page', {
      ...base,
      provider: { ...base.provider, proposePagePlan },
      onEvent: (event) => events.push(event),
    });
    expect(result).toMatchObject({
      error: { source: 'provider', code: 'invalid-output', retryable: true },
    });
    expect(proposePagePlan).toHaveBeenCalledTimes(2);
    expect(events.at(-1)?.type).toBe('page-plan.failed');
  });

  it('charges parse recovery to the original total planning budget', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    try {
      const base = planningOptions();
      const proposePagePlan = vi.fn(
        () =>
          new Promise<never>((_resolve, reject) => {
            if (proposePagePlan.mock.calls.length === 1)
              setTimeout(() => {
                reject(INVALID_OUTPUT);
              }, 40);
          }),
      );
      const result = planAiPage('Plan a page', {
        ...base,
        provider: { ...base.provider, proposePagePlan },
        timeoutMs: 60,
      });
      await vi.advanceTimersByTimeAsync(59);
      expect(proposePagePlan).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(await result).toMatchObject({ error: { source: 'run', code: 'timeout' } });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    { code: 'refusal', retryable: false },
    { code: 'invalid-output', retryable: false },
    { code: 'network', retryable: true },
  ] as const)('does not retry $code with retryable=$retryable', async (details) => {
    const base = planningOptions();
    const proposePagePlan = vi.fn(() => Promise.reject(new AiProviderError('Failed.', details)));
    const result = await planAiPage('Plan a page', {
      ...base,
      provider: { ...base.provider, proposePagePlan },
    });
    expect(result).toMatchObject({ error: { source: 'provider', code: details.code } });
    expect(proposePagePlan).toHaveBeenCalledOnce();
  });

  it('keeps Stop distinct from failure while the parse correction is pending', async () => {
    const base = planningOptions();
    const controller = new AbortController();
    let correction: AiProposePagePlanOptions | undefined;
    const proposePagePlan = vi.fn<NonNullable<AiPlanProvider['proposePagePlan']>>(
      (_request, _context, live?: AiProposePagePlanOptions) => {
        if (live?.attempt === undefined) return Promise.reject(INVALID_OUTPUT);
        correction = live;
        return new Promise<never>(() => undefined);
      },
    );
    const result = planAiPage('Plan a page', {
      ...base,
      provider: { ...base.provider, proposePagePlan },
      signal: controller.signal,
    }).catch((cause: unknown) => cause);
    await vi.waitFor(() => {
      expect(correction).toBeDefined();
    });
    controller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(correction?.signal?.aborted).toBe(true);
    expect(proposePagePlan).toHaveBeenCalledTimes(2);
  });
});
