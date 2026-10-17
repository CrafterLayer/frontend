import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiBuildOwnEvent, AssembledAiContext } from '@craftkit/builder';

import {
  createEditKernel,
  createPlanKernel,
  coffeePlan,
  memoryStorage,
  PLAN_TITLES,
} from '../testing/scripted-engine';
import { useAgentController } from './use-agent-controller';
import { useAgentKnowledge } from './use-agent-knowledge';
import { SAMPLE_SKILLS, seededStorage } from '../testing/knowledge-fixtures';

describe('creative request and edit lifetime regressions', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['rename', 'collision'] as const)(
    'replans with the captured prior brief after a skill %s and keeps only current explicit choices',
    async (change) => {
      const sample = SAMPLE_SKILLS[0];
      if (sample === undefined) throw new Error('Expected a sample user skill.');
      const chosen = {
        ...sample,
        name: 'Brand voice',
        mode: 'auto' as const,
        keywords: ['unrelated'],
      };
      const kernel = createPlanKernel();
      const requests: string[] = [];
      const contexts: AssembledAiContext[] = [];
      const provider = {
        propose: () => Promise.reject(new Error('This fixture only plans.')),
        proposePagePlan: (request: string, context: AssembledAiContext) => {
          requests.push(request);
          contexts.push(context);
          return Promise.resolve({ pagePlan: coffeePlan(), rationale: 'Plan the page.' });
        },
      };
      const knowledgeStorage = seededStorage([chosen], []);
      const hook = renderHook(() => {
        const knowledge = useAgentKnowledge({ storage: knowledgeStorage });
        const controller = useAgentController({
          kernel,
          locale: 'en',
          provider,
          enhancer: null,
          storage: memoryStorage(),
          ...knowledge.controllerOptions,
        });
        return { knowledge, controller };
      });
      act(() => {
        hook.result.current.controller.setMode('plan');
        hook.result.current.controller.setDraft('/brand-voice Build a one page website for a cafe');
        hook.result.current.controller.send();
      });
      await waitFor(
        () => {
          expect(
            hook.result.current.controller.state.turns.some(
              (turn) => turn.kind === 'page-plan' && turn.view.status === 'ready',
            ),
          ).toBe(true);
        },
        { timeout: 20_000 },
      );
      expect(contexts[0]?.skills).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: chosen.id, reason: 'explicit' })]),
      );
      act(() => {
        hook.result.current.knowledge.view.skills.update(chosen.id, {
          ...chosen,
          name: 'Renamed voice',
        });
      });
      if (change === 'collision')
        act(() => {
          hook.result.current.knowledge.view.skills.add({ ...chosen, name: 'Brand voice' });
        });
      const collisionId = hook.result.current.knowledge.view.skills.skills.find(
        (skill) => skill.id !== chosen.id,
      )?.id;
      act(() => {
        hook.result.current.controller.setDraft('/copywriting Add a comparison section');
        hook.result.current.controller.send();
      });
      await waitFor(
        () => {
          expect(requests).toHaveLength(2);
          expect(hook.result.current.controller.state.run).toBeNull();
        },
        { timeout: 20_000 },
      );
      expect(requests[1]).toContain(
        'Build a one page website for a cafe\nAdd a comparison section',
      );
      expect(requests[1]).not.toContain('/brand-voice');
      expect(requests[1]).not.toContain('/copywriting');
      const explicit =
        contexts[1]?.skills?.filter((skill) => skill.reason === 'explicit').map(({ id }) => id) ??
        [];
      expect(explicit).toContain('craftkit.copywriting');
      expect(explicit).not.toContain(chosen.id);
      if (collisionId !== undefined) expect(explicit).not.toContain(collisionId);
      expect(
        hook.result.current.controller.state.turns.some(
          (turn) =>
            turn.kind === 'user' && turn.view.text === '/copywriting Add a comparison section',
        ),
      ).toBe(true);
      hook.unmount();
    },
    30_000,
  );

  it('keeps a planned page request choice when Build follows a skill rename', async () => {
    const sample = SAMPLE_SKILLS[0];
    if (sample === undefined) throw new Error('Expected a sample user skill.');
    const chosen = {
      ...sample,
      name: 'Brand voice',
      mode: 'auto' as const,
      keywords: ['unrelated'],
    };
    const kernel = createPlanKernel();
    const contexts: AssembledAiContext[] = [];
    const propose = vi.fn((_request: string, context: AssembledAiContext) => {
      contexts.push(context);
      return new Promise<never>(() => undefined);
    });
    const provider = {
      propose,
      proposePagePlan: () =>
        Promise.resolve({ pagePlan: coffeePlan(), rationale: 'Plan the page.' }),
    };
    const knowledgeStorage = seededStorage([chosen], []);
    const hook = renderHook(() => {
      const knowledge = useAgentKnowledge({ storage: knowledgeStorage });
      const controller = useAgentController({
        kernel,
        locale: 'en',
        provider,
        enhancer: null,
        storage: memoryStorage(),
        ...knowledge.controllerOptions,
      });
      return { knowledge, controller };
    });
    act(() => {
      hook.result.current.controller.setMode('plan');
      hook.result.current.controller.setDraft('/brand-voice Build a one page website for a cafe');
      hook.result.current.controller.send();
    });
    await waitFor(
      () => {
        expect(
          hook.result.current.controller.state.turns.some(
            (turn) => turn.kind === 'page-plan' && turn.view.status === 'ready',
          ),
        ).toBe(true);
      },
      { timeout: 20_000 },
    );
    const plan = hook.result.current.controller.state.turns.find(
      (turn) => turn.kind === 'page-plan',
    );
    if (plan?.kind !== 'page-plan') throw new Error('Expected the planned page.');
    act(() => {
      hook.result.current.knowledge.view.skills.update(chosen.id, {
        ...chosen,
        name: 'Renamed voice',
      });
    });
    act(() => {
      hook.result.current.knowledge.view.skills.add({ ...chosen, name: 'Brand voice' });
    });
    act(() => {
      hook.result.current.controller.build(plan.view.turnId);
    });
    await waitFor(
      () => {
        expect(propose).toHaveBeenCalled();
      },
      { timeout: 20_000 },
    );
    expect(contexts[0]?.skills).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: chosen.id, reason: 'explicit' })]),
    );
    expect(propose.mock.calls[0]?.[0]).not.toContain('/brand-voice');
    act(() => {
      hook.result.current.controller.stop();
    });
    await waitFor(
      () => {
        expect(hook.result.current.controller.state.run).toBeNull();
      },
      {
        timeout: 20_000,
      },
    );
    hook.unmount();
  }, 30_000);

  it.each(['', '/copywriting ', '/pixi-scroll-murals ', '/page-copy '])(
    'builds an Arabic mural with %s on an empty root without changing its route',
    async (prefix) => {
      const kernel = createPlanKernel();
      const plan = coffeePlan();
      const proposePagePlan = vi.fn((_request: string) =>
        Promise.resolve({
          pagePlan: plan,
          rationale: 'Plan the requested scene.',
        }),
      );
      const propose = vi.fn((_request: string) => new Promise<never>(() => undefined));
      const storage = memoryStorage();
      const sampleSkill = SAMPLE_SKILLS[0];
      if (sampleSkill === undefined) throw new Error('Expected a sample user skill.');
      const knowledgeStorage = seededStorage(
        [{ ...sampleSkill, name: 'Page copy', keywords: ['unrelated'] }],
        [],
      );
      const events: AiBuildOwnEvent[] = [];
      const hook = renderHook(() => {
        const knowledge = useAgentKnowledge({ storage: knowledgeStorage });
        return useAgentController({
          kernel,
          locale: 'ar',
          provider: { propose, proposePagePlan },
          enhancer: null,
          storage,
          freeCode: true,
          ...knowledge.controllerOptions,
          onBuildEvent: (event) => events.push(event),
        });
      });
      act(() => {
        hook.result.current.setDraft(
          `${prefix}سوي الي جدارية لشخص يعيش في مدينة خيالية وقصة مشي وبدي تضيف صور وشخصيات وخلي الجو كأنه الليل في الجدارية`,
        );
        hook.result.current.send();
      });
      await waitFor(
        () => {
          expect(propose).toHaveBeenCalled();
        },
        { timeout: 20_000 },
      );
      expect(proposePagePlan).toHaveBeenCalledOnce();
      expect(proposePagePlan.mock.calls[0]?.[0]).not.toContain('/copywriting');
      expect(proposePagePlan.mock.calls[0]?.[0]).not.toContain('/pixi-scroll-murals');
      expect(proposePagePlan.mock.calls[0]?.[0]).not.toContain('/page-copy');
      expect(propose.mock.calls[0]?.[0]).not.toContain('/copywriting');
      expect(propose.mock.calls[0]?.[0]).not.toContain('/pixi-scroll-murals');
      expect(propose.mock.calls[0]?.[0]).not.toContain('/page-copy');
      expect(hook.result.current.state.run?.activity).toBe('build');
      expect(hook.result.current.state.turns.some((turn) => turn.kind === 'build')).toBe(true);
      expect(hook.result.current.state.turns.some((turn) => turn.kind === 'edit')).toBe(false);
      const sent = hook.result.current.state.turns.find((turn) => turn.kind === 'user');
      expect(sent?.kind === 'user' && sent.view.text.startsWith(prefix)).toBe(true);
      expect(kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(
        PLAN_TITLES.length,
      );
      expect(events.some((event) => event.type === 'build.planned')).toBe(true);
      act(() => {
        hook.result.current.stop();
      });
      await waitFor(
        () => {
          expect(hook.result.current.state.run).toBeNull();
        },
        { timeout: 20_000 },
      );
      hook.unmount();
    },
    30_000,
  );

  it.each([
    ['high' as const, undefined, 420_000],
    ['xhigh' as const, undefined, 420_000],
    ['max' as const, 50_000, 50_000],
  ])(
    'retains deliberately deep %s capacity while honoring an explicit host ceiling',
    async (effort, timeoutMs, ceiling) => {
      vi.useFakeTimers();
      const kernel = createEditKernel();
      const original = kernel.getDocument();
      const propose = vi.fn(() => new Promise<never>(() => undefined));
      const hook = renderHook(() =>
        useAgentController({
          kernel,
          locale: 'en',
          provider: { propose },
          enhancer: null,
          storage: memoryStorage(),
          effort,
          ...(timeoutMs === undefined ? {} : { timeoutMs }),
        }),
      );
      await act(async () => {
        hook.result.current.setDraft('Give this hero a warmer greeting');
        hook.result.current.send();
        await Promise.resolve();
      });
      expect(propose).toHaveBeenCalledOnce();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ceiling - 1);
      });
      expect(hook.result.current.state.run).not.toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(hook.result.current.state.run).toBeNull();
      expect(hook.result.current.state.turns.some((turn) => turn.kind === 'error')).toBe(true);
      expect(kernel.getDocument()).toBe(original);
      hook.unmount();
    },
  );
});
