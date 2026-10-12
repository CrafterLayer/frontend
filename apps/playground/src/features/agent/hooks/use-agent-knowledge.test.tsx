/**
 * The Agent's knowledge (2026-10-12), end to end through the controller: the person's skills
 * reach the engine (an auto skill by its words, an always-on one every time), the project
 * memory rides every run as a reviewed data fragment, a checkpoint is kept before an edit, and
 * "Restore the page to before this request" takes the page back through it.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AiPlanProvider, AssembledAiContext, BuilderKernel } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import type { AgentCheckpointPort } from '../model/checkpoints';
import type { AgentStorage } from '../model/migrate-sessions';
import {
  createFakeCheckpoints,
  SAMPLE_CHECKPOINTS,
  SAMPLE_NOTES,
  SAMPLE_SKILLS,
  seededStorage,
} from '../testing/knowledge-fixtures';
import { createEditKernel, memoryStorage } from '../testing/scripted-engine';

import { useAgentController } from './use-agent-controller';
import { useAgentKnowledge, useReleasePinsAfterRun } from './use-agent-knowledge';

const WAIT = { timeout: 20_000 } as const;

/** The panel's own composition (LiveAgentPanel): knowledge first, then the controller. */
function useLiveController(props: {
  readonly kernel: BuilderKernel;
  readonly provider: AiPlanProvider;
  readonly knowledgeStorage: AgentStorage;
  readonly checkpoints: AgentCheckpointPort;
}) {
  const knowledge = useAgentKnowledge({
    storage: props.knowledgeStorage,
    checkpoints: props.checkpoints,
  });
  const controller = useAgentController({
    kernel: props.kernel,
    locale: 'en',
    storage: memoryStorage(),
    enhancer: null,
    provider: props.provider,
    ...knowledge.controllerOptions,
  });
  useReleasePinsAfterRun(controller.state.run !== null, knowledge.view);
  return { knowledge, controller };
}

/** A provider that edits the hero's heading and keeps every context it was sent. */
function capturingProvider(value: string) {
  const contexts: AssembledAiContext[] = [];
  const provider: AiPlanProvider = {
    propose(_request, context) {
      contexts.push(context);
      return Promise.resolve({
        rationale: 'Edit the heading.',
        commands: [{ command: 'setProp', args: { id: 'selected-hero', key: 'heading', value } }],
      });
    },
  };
  return { provider, contexts };
}

describe('useAgentKnowledge', () => {
  it('builds the registry from the enabled skills and names them for a request', async () => {
    const checkpoints = createFakeCheckpoints();
    const { result } = renderHook(() =>
      useAgentKnowledge({ storage: seededStorage(SAMPLE_SKILLS, SAMPLE_NOTES), checkpoints }),
    );
    const { controllerOptions, view } = result.current;
    expect(controllerOptions.skillRegistry?.get('user.skill-1')?.name).toBe('Brand voice');
    // A skill that is off is not in the registry at all.
    expect(controllerOptions.skillRegistry?.get('user.skill-3')).toBeUndefined();
    expect([...(controllerOptions.hostSkillIdsFor?.('Rewrite the headline') ?? [])].sort()).toEqual(
      ['user.skill-1', 'user.skill-2'],
    );
    expect(controllerOptions.extraContextProviders).toHaveLength(1);
    expect(view.skills.builtIns.length).toBeGreaterThan(10);
    expect(view.skills.exportMarkdown('user.skill-1')).toContain('name: Brand voice');
    expect(view.skills.exportMarkdown('user.skill-404')).toBeUndefined();
    await waitFor(() => {
      expect(result.current.view.checkpoints?.items).toEqual(SAMPLE_CHECKPOINTS);
    });

    act(() => {
      result.current.view.memory.clear();
    });
    expect(result.current.controllerOptions.extraContextProviders).toEqual([]);
  });

  it('starts every person on the default skills, with no checkpoints tab without a page keeper', () => {
    const { result } = renderHook(() => useAgentKnowledge({ storage: null }));
    const registry = result.current.controllerOptions.skillRegistry;
    expect(registry?.get('craftkit.pro-max-design')).toBeDefined();
    expect(result.current.view.skills.defaults.every((skill) => skill.enabled)).toBe(true);
    expect(result.current.view.checkpoints).toBeUndefined();
    expect(result.current.controllerOptions.hostSkillIdsFor?.('anything')).toEqual([]);
  });

  it('keeps the built-in registry when every default is off and the person has none', () => {
    const { result } = renderHook(() => useAgentKnowledge({ storage: null }));
    act(() => {
      for (const skill of result.current.view.skills.defaults) {
        result.current.view.skills.setDefaultEnabled(skill.id, false);
      }
    });
    expect(result.current.controllerOptions.skillRegistry).toBeUndefined();
  });

  it('offers the defaults a request names to builds, and stops when one is switched off', () => {
    const { result } = renderHook(() => useAgentKnowledge({ storage: null, locale: 'ar' }));
    const ids = () =>
      result.current.controllerOptions.hostSkillIdsFor?.('صمم موقع هبوط لمقهى') ?? [];
    expect(ids()).toEqual(
      expect.arrayContaining([
        'craftkit.pro-max-design',
        'craftkit.pro-max-landing',
        'craftkit.arabic-copy',
      ]),
    );
    expect(result.current.view.skills.defaults[0]?.name).toBe('ذكاء التصميم (UI UX Pro Max)');
    act(() => {
      result.current.view.skills.setDefaultEnabled('craftkit.pro-max-design', false);
    });
    expect(ids()).not.toContain('craftkit.pro-max-design');
    expect(
      result.current.controllerOptions.skillRegistry?.get('craftkit.pro-max-design'),
    ).toBeUndefined();
  });

  it('sends the person’s skills and memory to the engine, and checkpoints the edit it restores', async () => {
    const kernel = createEditKernel();
    kernel.setSelection(['selected-hero']);
    const checkpoints = createFakeCheckpoints([]);
    const { provider, contexts } = capturingProvider('Clinic');
    const { result } = renderHook(() =>
      useLiveController({
        kernel,
        provider,
        knowledgeStorage: seededStorage(SAMPLE_SKILLS, SAMPLE_NOTES),
        checkpoints,
      }),
    );
    const c = () => result.current.controller;
    expect(c().capabilities.restore).toBe(true);

    act(() => {
      c().setDraft('Rewrite the headline so it sounds warmer and more welcoming');
    });
    act(() => {
      c().send();
    });
    await waitFor(() => {
      expect(c().state.run).toBeNull();
    }, WAIT);
    expect(kernel.getDocument().nodes['selected-hero']?.props['heading']).toBe('Clinic');

    const context = contexts[0];
    const skills = (context?.skills ?? []).map(({ id }) => id);
    expect(skills).toContain('user.skill-1');
    expect(skills).toContain('user.skill-2');
    expect(skills).not.toContain('user.skill-3');
    const memory = context?.fragments.find(({ source }) => source === 'host:project-memory');
    expect(memory?.body).toContain('The café is closed on Fridays.');

    // A checkpoint was kept before the edit, under the request's turn.
    const edit = c().state.turns.find((turn) => turn.kind === 'edit');
    const turnId = edit?.kind === 'edit' ? edit.view.turnId : '';
    expect(checkpoints.turns.has(turnId)).toBe(true);
    let outcome: string | undefined;
    await act(async () => {
      outcome = await c().restore(turnId);
    });
    expect(outcome).toBe('restored');
    expect(checkpoints.restored).toEqual([checkpoints.turns.get(turnId)]);
    // An unknown request has no checkpoint: Restore refuses rather than guess.
    await act(async () => {
      outcome = await c().restore('turn-unknown');
    });
    expect(outcome).toBe('conflict');
  }, 30_000);

  it('sends the skills the composer pinned as the request’s own, then lets them go', async () => {
    const kernel = createEditKernel();
    kernel.setSelection(['selected-hero']);
    const { provider, contexts } = capturingProvider('Welcome');
    const { result } = renderHook(() =>
      useLiveController({
        kernel,
        provider,
        knowledgeStorage: seededStorage([], []),
        checkpoints: createFakeCheckpoints([]),
      }),
    );
    const skills = () => result.current.knowledge.view.skills;
    act(() => {
      expect(skills().pin('craftkit.copywriting')).toBe(true);
      expect(skills().pin('user.skill-404')).toBe(false);
    });
    expect(skills().pinned).toEqual(['craftkit.copywriting']);
    expect(result.current.knowledge.controllerOptions.selectedSkillIds).toEqual([
      'craftkit.copywriting',
    ]);

    act(() => {
      result.current.controller.setDraft('Make the hero feel warmer and more personal');
    });
    act(() => {
      result.current.controller.send();
    });
    await waitFor(() => {
      expect(result.current.controller.state.run).toBeNull();
    }, WAIT);
    expect((contexts[0]?.skills ?? []).map(({ id }) => id)).toContain('craftkit.copywriting');
    // The pin held for one message.
    await waitFor(() => {
      expect(skills().pinned).toEqual([]);
    });
  }, 30_000);

  it('takes at most three pinned skills', () => {
    const { result } = renderHook(() => useAgentKnowledge({ storage: null }));
    const ids = result.current.view.skills.builtIns.slice(0, 4).map(({ id }) => id);
    for (const id of ids.slice(0, 3)) {
      act(() => {
        expect(result.current.view.skills.pin(id)).toBe(true);
      });
    }
    act(() => {
      expect(result.current.view.skills.pin(ids[3] ?? '')).toBe(false);
      result.current.view.skills.unpin(ids[0] ?? '');
    });
    expect(result.current.view.skills.pinned).toHaveLength(2);
  });
});
