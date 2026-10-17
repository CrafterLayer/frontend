import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiPagePlanDraftEvent, AiProposePagePlanOptions, AssembledAiContext } from '../types';
import { planAiPage, proposeValidatedPagePlan, type PagePlanStepNote } from './plan-page';
import { incidentOptions } from './run-agent.incident-fixtures';
import type { AiPagePlanEvent } from './types';

function pendingPlan() {
  let resolve!: (answer: { pagePlan: Record<string, unknown> }) => void;
  const promise = new Promise<{ pagePlan: Record<string, unknown> }>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the complete planning-step lifetime', () => {
  it.each(['proposal', 'repair'] as const)(
    'settles Stop during hanging %s and suppresses late channels',
    async (phase) => {
      const pending = pendingPlan(),
        controller = new AbortController();
      const events: AiPagePlanEvent[] = [];
      let live: AiProposePagePlanOptions | undefined;
      let calls = 0;
      const base = incidentOptions();
      const provider = {
        ...base.provider,
        proposePagePlan: (
          _request: string,
          _context: AssembledAiContext,
          input?: AiProposePagePlanOptions,
        ) => {
          calls += 1;
          live = input;
          return phase === 'repair' && calls === 1
            ? Promise.resolve({ pagePlan: {} })
            : pending.promise;
        },
      };
      const result = planAiPage('Plan a page', {
        ...base,
        provider,
        signal: controller.signal,
        timeoutMs: 1_000,
        onEvent: (event) => events.push(event),
      }).catch((cause: unknown) => cause);
      await vi.advanceTimersByTimeAsync(0);
      controller.abort(new Error('Stopped'));
      await vi.advanceTimersByTimeAsync(0);
      expect(await result).toMatchObject({ name: 'AbortError', message: 'Stopped' });
      expect(calls).toBe(phase === 'proposal' ? 1 : 2);
      expect(live?.signal?.aborted).toBe(true);
      const count = events.length;
      live?.onProgress?.('Late plan');
      live?.onUsage?.({
        inputTokens: 1,
        outputTokens: 10,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      live?.onDraft?.({ kind: 'start' });
      pending.resolve({ pagePlan: {} });
      await vi.advanceTimersByTimeAsync(0);
      expect(events).toHaveLength(count);
      expect(base.kernel.transactions()).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('returns a timeout failure for a non-cooperative public Plan call', async () => {
    const pending = pendingPlan(),
      events: AiPagePlanEvent[] = [];
    const base = incidentOptions();
    const result = planAiPage('Plan a page', {
      ...base,
      timeoutMs: 60,
      provider: { ...base.provider, proposePagePlan: () => pending.promise },
      onEvent: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(60);
    expect(await result).toMatchObject({ error: { source: 'run', code: 'timeout' } });
    expect(events.at(-1)?.type).toBe('page-plan.failed');
    pending.resolve({ pagePlan: {} });
    await vi.advanceTimersByTimeAsync(0);
    expect(events.filter(({ type }) => type === 'page-plan.failed')).toHaveLength(1);
    expect(base.kernel.transactions()).toHaveLength(0);
  });

  it('suppresses late planning drafts after the total budget expires', async () => {
    const pending = pendingPlan();
    const notes: PagePlanStepNote[] = [],
      drafts: AiPagePlanDraftEvent[] = [];
    let live: AiProposePagePlanOptions | undefined;
    const base = incidentOptions();
    const provider = {
      ...base.provider,
      proposePagePlan: (
        _request: string,
        _context: AssembledAiContext,
        input?: AiProposePagePlanOptions,
      ) => {
        live = input;
        return pending.promise;
      },
    };
    const result = proposeValidatedPagePlan(
      {
        runId: 'plan-draft',
        kernel: base.kernel,
        provider,
        request: 'Plan a page',
        timeoutMs: 60,
        onDraft: (draft) => drafts.push(draft),
      },
      (note) => notes.push(note),
    );
    await vi.advanceTimersByTimeAsync(0);
    live?.onDraft?.({ kind: 'start' });
    expect(drafts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60);
    expect(await result).toMatchObject({ error: { code: 'timeout' } });
    const count = notes.length;
    live?.onDraft?.({ kind: 'text', text: 'Late world' });
    live?.onProgress?.('Late plan');
    live?.onUsage?.({ inputTokens: 1, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 });
    pending.resolve({ pagePlan: {} });
    await vi.advanceTimersByTimeAsync(0);
    expect(drafts).toHaveLength(1);
    expect(notes).toHaveLength(count);
  });

  it('uses the remaining budget for repair instead of starting another budget', async () => {
    const pending = pendingPlan();
    const events: AiPagePlanEvent[] = [];
    let calls = 0,
      signal: AbortSignal | undefined;
    const base = incidentOptions();
    const result = planAiPage('Plan a page', {
      ...base,
      onEvent: (event) => events.push(event),
      timeoutMs: 60,
      provider: {
        ...base.provider,
        proposePagePlan: (_request, _context, live) => {
          calls += 1;
          signal = live?.signal;
          return calls === 1
            ? new Promise((resolve) => {
                setTimeout(() => {
                  resolve({ pagePlan: {} });
                }, 40);
              })
            : pending.promise;
        },
      },
    });
    await vi.advanceTimersByTimeAsync(59);
    expect(calls).toBe(2);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ error: { source: 'run', code: 'timeout' } });
    expect(signal?.aborted).toBe(true);
    pending.resolve({ pagePlan: {} });
    await vi.advanceTimersByTimeAsync(0);
  });

  it('honors an explicit larger planning budget', async () => {
    const pending = pendingPlan();
    const events: AiPagePlanEvent[] = [];
    let signal: AbortSignal | undefined;
    const base = incidentOptions();
    const result = planAiPage('Create an interactive story', {
      ...base,
      onEvent: (event) => events.push(event),
      timeoutMs: 420_000,
      provider: {
        ...base.provider,
        proposePagePlan: (_request, _context, live) => {
          signal = live?.signal;
          return pending.promise;
        },
      },
    });
    await vi.advanceTimersByTimeAsync(419_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ error: { code: 'timeout' } });
    pending.resolve({ pagePlan: {} });
    await vi.advanceTimersByTimeAsync(0);
  });

  it('reports timeout when synchronous work crosses the budget before the timer runs', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const events: AiPagePlanEvent[] = [];
    const base = incidentOptions();
    const result = await planAiPage('Plan a page', {
      ...base,
      timeoutMs: 60,
      onEvent: (event) => events.push(event),
      provider: {
        ...base.provider,
        proposePagePlan: () => {
          now.mockReturnValue(61);
          return Promise.resolve({ pagePlan: {} });
        },
      },
    });
    expect(result).toMatchObject({ error: { source: 'run', code: 'timeout' } });
    expect(events.at(-1)).toMatchObject({ type: 'page-plan.failed', error: { code: 'timeout' } });
    expect(base.kernel.transactions()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
