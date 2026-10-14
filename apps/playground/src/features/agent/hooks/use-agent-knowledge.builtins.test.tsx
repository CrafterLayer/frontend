/**
 * Built-in skills switched off (2026-10-14), end to end: the switch is kept per viewer, the
 * host's skill ids leave it out, every run carries it as `excludedSkillIds`, an edit never
 * activates it by its words, and a `/skill` pick still uses it.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AiPlanProvider, AssembledAiContext, BuilderKernel } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import { BUILT_IN_SKILLS_KEY } from '../model/builtin-skills';
import { createFakeCheckpoints, seededStorage } from '../testing/knowledge-fixtures';
import { createEditKernel, memoryStorage } from '../testing/scripted-engine';

import { batchAgentOptions } from './batch-agent-options';
import { useAgentController } from './use-agent-controller';
import { useAgentKnowledge } from './use-agent-knowledge';

const WAIT = { timeout: 20_000 } as const;
const DATA_VIZ = 'craftkit.data-viz';
const REPORT = 'Build a monthly sales report page with charts';

describe('useAgentKnowledge — built-in switches', () => {
  it('lists every built-in on, then leaves a switched-off one out of the host’s ids', () => {
    const { result } = renderHook(() => useAgentKnowledge({ storage: seededStorage() }));
    const switches = result.current.view.skills.builtInSwitches;
    expect(switches.length).toBeGreaterThan(20);
    expect(switches.every(({ enabled }) => enabled)).toBe(true);
    expect(result.current.controllerOptions.excludedSkillIds).toBeUndefined();
    expect(result.current.controllerOptions.hostSkillIdsFor?.(REPORT)).toContain(DATA_VIZ);

    act(() => {
      result.current.view.skills.setBuiltInEnabled(DATA_VIZ, false);
    });
    expect(result.current.controllerOptions.excludedSkillIds).toEqual([DATA_VIZ]);
    expect(result.current.controllerOptions.hostSkillIdsFor?.(REPORT)).not.toContain(DATA_VIZ);
    // A `/skill` pick still names it.
    expect(result.current.controllerOptions.hostSkillIdsFor?.(`/data-viz ${REPORT}`)).toContain(
      DATA_VIZ,
    );
  });

  it('keeps the choice per viewer, and Reset brings every built-in back', () => {
    const storage = seededStorage();
    const first = renderHook(() => useAgentKnowledge({ storage }));
    act(() => {
      first.result.current.view.skills.setBuiltInEnabled(DATA_VIZ, false);
    });
    first.unmount();
    expect(storage.getItem(BUILT_IN_SKILLS_KEY)).toBe(JSON.stringify([DATA_VIZ]));

    const second = renderHook(() => useAgentKnowledge({ storage, locale: 'ar' }));
    const row = second.result.current.view.skills.builtInSwitches.find(({ id }) => id === DATA_VIZ);
    expect(row).toMatchObject({ enabled: false, name: 'المخططات والجداول' });
    act(() => {
      second.result.current.view.skills.resetBuiltIns();
    });
    expect(second.result.current.controllerOptions.excludedSkillIds).toBeUndefined();
    expect(storage.getItem(BUILT_IN_SKILLS_KEY)).toBe('[]');
  });

  it('hands a background job the same exclusions', () => {
    const { result } = renderHook(() => useAgentKnowledge({ storage: seededStorage() }));
    act(() => {
      result.current.view.skills.setBuiltInEnabled(DATA_VIZ, false);
    });
    const job = batchAgentOptions(result.current.controllerOptions, REPORT);
    expect(job.excludedSkillIds).toEqual([DATA_VIZ]);
    expect(job.hostSkillIds).not.toContain(DATA_VIZ);
  });

  it('never lets an "Always on" built-in be switched off', () => {
    const { result } = renderHook(() => useAgentKnowledge({ storage: seededStorage() }));
    act(() => {
      result.current.view.skills.setBuiltInEnabled('craftkit.build-fill', false);
    });
    expect(result.current.controllerOptions.excludedSkillIds).toBeUndefined();
  });
});

/** A provider that edits the hero's heading and keeps every context it was sent. */
function capturingProvider() {
  const contexts: AssembledAiContext[] = [];
  const provider: AiPlanProvider = {
    propose(_request, context) {
      contexts.push(context);
      return Promise.resolve({
        rationale: 'Edit the heading.',
        commands: [
          { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'Sales' } },
        ],
      });
    },
  };
  return { provider, contexts };
}

function useLive(kernel: BuilderKernel, provider: AiPlanProvider) {
  const knowledge = useAgentKnowledge({
    storage: seededStorage(),
    checkpoints: createFakeCheckpoints([]),
  });
  const controller = useAgentController({
    kernel,
    locale: 'en',
    storage: memoryStorage(),
    enhancer: null,
    provider,
    ...knowledge.controllerOptions,
  });
  return { knowledge, controller };
}

function activated(context: AssembledAiContext | undefined): string[] {
  return (context?.skills ?? []).map(({ id }) => id);
}

describe('an edit and the person’s switches', () => {
  it('does not wake a switched-off skill by its words; a /skill pick still does', async () => {
    const { provider, contexts } = capturingProvider();
    const kernel = createEditKernel();
    kernel.setSelection(['selected-hero']);
    const { result } = renderHook(() => useLive(kernel, provider));
    const send = async (text: string, count: number) => {
      act(() => {
        result.current.controller.setDraft(text);
      });
      act(() => {
        result.current.controller.send();
      });
      await waitFor(() => {
        expect(contexts).toHaveLength(count);
      }, WAIT);
      await waitFor(() => {
        expect(result.current.controller.state.run).toBeNull();
      }, WAIT);
    };
    const words = 'Add a chart of our monthly sales and a table of the numbers to this hero';

    await send(words, 1);
    expect(activated(contexts[0])).toContain(DATA_VIZ);

    act(() => {
      result.current.knowledge.view.skills.setBuiltInEnabled(DATA_VIZ, false);
    });
    await send(words, 2);
    expect(activated(contexts[1])).not.toContain(DATA_VIZ);

    await send(`/data-viz ${words}`, 3);
    expect(contexts[2]?.skills).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: DATA_VIZ, reason: 'explicit' })]),
    );
  }, 60_000);
});
