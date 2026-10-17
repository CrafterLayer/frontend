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
import type { PromptEnhancer } from '../model/enhance';
import { SESSIONS_KEY, type PersistedAgentState } from '../model/turns';
import {
  createFakeCheckpoints,
  SAMPLE_CHECKPOINTS,
  SAMPLE_NOTES,
  SAMPLE_SKILLS,
  seededStorage,
} from '../testing/knowledge-fixtures';
import {
  createBuildKernel,
  createEditKernel,
  memoryStorage,
  scriptedEnhancer,
} from '../testing/scripted-engine';

import { useAgentController } from './use-agent-controller';
import { useAgentKnowledge } from './use-agent-knowledge';

const WAIT = { timeout: 20_000 } as const;

/** The panel's own composition (LiveAgentPanel): knowledge first, then the controller. */
function useLiveController(props: {
  readonly kernel: BuilderKernel;
  readonly provider: AiPlanProvider;
  readonly knowledgeStorage: AgentStorage;
  readonly checkpoints: AgentCheckpointPort;
  readonly enhancer?: PromptEnhancer | null;
  readonly agentStorage?: AgentStorage;
}) {
  const knowledge = useAgentKnowledge({
    storage: props.knowledgeStorage,
    checkpoints: props.checkpoints,
  });
  const controller = useAgentController({
    kernel: props.kernel,
    locale: 'en',
    storage: props.agentStorage ?? memoryStorage(),
    enhancer: props.enhancer ?? null,
    provider: props.provider,
    ...knowledge.controllerOptions,
  });
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
  it.each(['captured', 'legacy'] as const)(
    'retries %s saved requests after reload without changing their skill identity',
    async (version) => {
      const sample = SAMPLE_SKILLS[0];
      if (sample === undefined) throw new Error('Expected a sample user skill.');
      const chosen = {
        ...sample,
        mode: 'auto' as const,
        keywords: ['unrelated'],
        name: 'Brand voice',
      };
      const knowledgeStorage = seededStorage([chosen], []);
      const agentStorage = memoryStorage();
      const kernel = createEditKernel();
      kernel.setSelection(['selected-hero']);
      const contexts: AssembledAiContext[] = [];
      const requests: string[] = [];
      const provider: AiPlanProvider = {
        propose(request, context) {
          requests.push(request);
          contexts.push(context);
          return contexts.length === 1
            ? Promise.reject(new Error('Scripted provider failure.'))
            : Promise.resolve({
                rationale: 'Update the hero.',
                commands: [
                  {
                    command: 'setProp',
                    args: { id: 'selected-hero', key: 'heading', value: 'A warmer greeting' },
                  },
                ],
              });
        },
      };
      const props = {
        kernel,
        provider,
        knowledgeStorage,
        agentStorage,
        checkpoints: createFakeCheckpoints([]),
      };
      const first = renderHook(() => useLiveController(props));
      act(() => {
        first.result.current.controller.setDraft('/brand-voice Give this hero a warmer greeting');
        first.result.current.controller.send();
      });
      await waitFor(() => {
        expect(
          first.result.current.controller.state.turns.some((turn) => turn.kind === 'error'),
        ).toBe(true);
      }, WAIT);
      await waitFor(() => {
        expect(first.result.current.controller.state.run).toBeNull();
      }, WAIT);
      const failed = first.result.current.controller.state.turns.find(
        (turn) => turn.kind === 'error',
      );
      if (failed?.kind !== 'error') throw new Error('Expected the failed run record.');
      if (version === 'captured') {
        act(() => {
          first.result.current.knowledge.view.skills.update(chosen.id, {
            ...chosen,
            name: 'Renamed voice',
          });
        });
        act(() => {
          first.result.current.knowledge.view.skills.add({ ...chosen, name: 'Brand voice' });
        });
      }
      first.unmount();
      if (version === 'legacy') {
        const saved = JSON.parse(agentStorage.getItem(SESSIONS_KEY) ?? '{}') as PersistedAgentState;
        agentStorage.setItem(
          SESSIONS_KEY,
          JSON.stringify({
            ...saved,
            sessions: saved.sessions.map((session) => ({
              ...session,
              turns: session.turns.map((turn) => {
                if (turn.kind !== 'user') return turn;
                const { skillSnapshot: _snapshot, ...legacy } = turn;
                void _snapshot;
                return legacy;
              }),
            })),
          }),
        );
      }
      const second = renderHook(() => useLiveController(props));
      act(() => {
        second.result.current.controller.tryAgain(failed.view.turnId);
      });
      await waitFor(() => {
        expect(contexts).toHaveLength(2);
      }, WAIT);
      await waitFor(() => {
        expect(second.result.current.controller.state.run).toBeNull();
      }, WAIT);
      const explicit =
        contexts[1]?.skills?.filter((skill) => skill.reason === 'explicit').map(({ id }) => id) ??
        [];
      expect(explicit).toEqual([chosen.id]);
      expect(requests[1]).toBe('Give this hero a warmer greeting');
      expect(
        second.result.current.controller.state.turns.filter((turn) => turn.kind === 'user'),
      ).toHaveLength(1);
      second.unmount();
    },
    30_000,
  );

  it('keeps inline choices through Improve and Restore while the enhancer reads only the brief', async () => {
    const kernel = createEditKernel();
    const provider = capturingProvider('A warmer greeting');
    const enhancer = scriptedEnhancer(() => ({ enhanced: 'Give this hero a warmer greeting' }));
    const { result } = renderHook(() =>
      useLiveController({
        kernel,
        provider: provider.provider,
        enhancer,
        knowledgeStorage: seededStorage([], []),
        checkpoints: createFakeCheckpoints([]),
      }),
    );
    act(() => {
      result.current.controller.setDraft('/copywriting Make the hero friendlier');
    });
    act(() => {
      result.current.controller.enhanceDraft();
    });
    await waitFor(() => {
      expect(result.current.controller.state.enhancement.status).toBe('enhanced');
    }, WAIT);
    expect(result.current.controller.state.draft).toBe(
      '/copywriting Give this hero a warmer greeting',
    );
    expect(enhancer.calls[0]?.text).toBe('Make the hero friendlier');
    act(() => {
      result.current.controller.restoreDraft();
    });
    expect(result.current.controller.state.draft).toBe('/copywriting Make the hero friendlier');
    act(() => {
      result.current.controller.enhanceDraft();
    });
    await waitFor(() => {
      expect(result.current.controller.state.enhancement.status).toBe('enhanced');
    }, WAIT);
    act(() => {
      result.current.controller.send();
    });
    await waitFor(() => {
      expect(provider.contexts).toHaveLength(1);
    }, WAIT);
    await waitFor(() => {
      expect(result.current.controller.state.run).toBeNull();
    }, WAIT);
    expect(provider.contexts[0]?.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'craftkit.copywriting', reason: 'explicit' }),
      ]),
    );
  }, 30_000);

  it.each(['answer', 'as-written'] as const)(
    'keeps captured choices through Clarify %s and sends semantic provider text',
    async (action) => {
      const kernel = createBuildKernel();
      const requests: string[] = [];
      const contexts: AssembledAiContext[] = [];
      const provider: AiPlanProvider = {
        propose(request, context) {
          requests.push(request);
          contexts.push(context);
          return Promise.resolve({ rationale: 'Suggest the next steps.', commands: [] });
        },
      };
      const enhancer = scriptedEnhancer((input) =>
        input.answers === undefined
          ? { questions: [{ id: 'tone', text: 'Which tone?', choices: ['Warm'] }] }
          : { enhanced: 'Give the page a warm tone' },
      );
      const { result } = renderHook(() =>
        useLiveController({
          kernel,
          provider,
          enhancer,
          knowledgeStorage: seededStorage([], []),
          checkpoints: createFakeCheckpoints([]),
        }),
      );
      act(() => {
        result.current.controller.setMode('plan');
        result.current.controller.setDraft('/copywriting make it blue');
        result.current.controller.send();
      });
      await waitFor(() => {
        expect(result.current.controller.state.clarify?.status).toBe('asking');
      }, WAIT);
      expect(enhancer.calls[0]?.text).toBe('make it blue');
      act(() => {
        if (action === 'answer') result.current.controller.answerClarify('tone', 'Warm');
        else result.current.controller.sendAsWritten();
      });
      await waitFor(() => {
        expect(contexts).toHaveLength(1);
      }, WAIT);
      await waitFor(() => {
        expect(result.current.controller.state.run).toBeNull();
      }, WAIT);
      expect(contexts[0]?.skills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'craftkit.copywriting', reason: 'explicit' }),
        ]),
      );
      expect(requests[0]).not.toContain('/copywriting');
      if (action === 'answer') expect(requests[0]).toContain('Give the page a warm tone');
      expect(
        result.current.controller.state.turns.some(
          (turn) => turn.kind === 'user' && turn.view.text.startsWith('/copywriting '),
        ),
      ).toBe(true);
    },
    30_000,
  );

  it.each(['rename', 'disabled', 'deleted'] as const)(
    'keeps queued IDs and the brief stable through %s and a new name collision',
    async (change) => {
      const sample = SAMPLE_SKILLS[0];
      if (sample === undefined) throw new Error('Expected a sample user skill.');
      const chosen = {
        ...sample,
        mode: 'auto' as const,
        keywords: ['unrelated'],
        name: 'Brand voice',
      };
      const kernel = createEditKernel();
      kernel.setSelection(['selected-hero']);
      const contexts: AssembledAiContext[] = [];
      const requests: string[] = [];
      let finishFirst: (() => void) | undefined;
      const gate = new Promise<void>((resolve) => {
        finishFirst = resolve;
      });
      const enhancer = scriptedEnhancer(() => ({
        enhanced: 'Give this hero an improved greeting',
      }));
      const provider: AiPlanProvider = {
        async propose(request, context) {
          requests.push(request);
          contexts.push(context);
          if (contexts.length === 1) await gate;
          return {
            rationale: 'Update the hero.',
            commands: [
              {
                command: 'setProp',
                args: {
                  id: 'selected-hero',
                  key: 'heading',
                  value: `Greeting ${String(contexts.length)}`,
                },
              },
            ],
          };
        },
      };
      const { result } = renderHook(() =>
        useLiveController({
          kernel,
          provider,
          enhancer,
          knowledgeStorage: seededStorage([chosen], []),
          checkpoints: createFakeCheckpoints([]),
        }),
      );
      act(() => {
        result.current.controller.setDraft('Give this hero a warmer greeting');
      });
      act(() => {
        result.current.controller.send();
      });
      await waitFor(() => {
        expect(contexts).toHaveLength(1);
      }, WAIT);
      act(() => {
        result.current.controller.setDraft('/brand-voice Give this hero another greeting');
      });
      act(() => {
        result.current.controller.send();
      });
      act(() => {
        expect(
          result.current.knowledge.view.skills.update(chosen.id, {
            ...chosen,
            name: 'Renamed voice',
          }),
        ).toMatchObject({ ok: true });
      });
      act(() => {
        expect(
          result.current.knowledge.view.skills.add({ ...chosen, name: 'Brand voice' }),
        ).toMatchObject({ ok: true });
      });
      const collisionId = result.current.knowledge.view.skills.skills.find(
        (skill) => skill.id !== chosen.id,
      )?.id;
      if (change !== 'rename')
        act(() => {
          if (change === 'disabled')
            result.current.knowledge.view.skills.setEnabled(chosen.id, false);
          else result.current.knowledge.view.skills.remove(chosen.id);
        });
      act(() => {
        result.current.controller.enhanceDraft();
      });
      await waitFor(() => {
        expect(result.current.controller.state.enhancement.status).toBe('enhanced');
      }, WAIT);
      expect(enhancer.calls.at(-1)?.text).toBe('Give this hero another greeting');
      expect(result.current.controller.state.draft).toBe(
        '/brand-voice Give this hero an improved greeting',
      );
      act(() => {
        result.current.controller.restoreDraft();
      });
      expect(result.current.controller.state.draft).toBe(
        '/brand-voice Give this hero another greeting',
      );
      // Editing only the queued body must also retain the captured choice, rather than rebinding its old name.
      act(() => {
        result.current.controller.setDraft('/brand-voice Give this hero another greeting now');
      });
      act(() => {
        finishFirst?.();
      });
      await waitFor(() => {
        expect(contexts).toHaveLength(2);
      }, WAIT);
      await waitFor(() => {
        expect(result.current.controller.state.run).toBeNull();
      }, WAIT);
      const explicit =
        contexts[1]?.skills?.filter((skill) => skill.reason === 'explicit').map(({ id }) => id) ??
        [];
      expect(explicit.includes(chosen.id)).toBe(change === 'rename');
      expect(explicit).not.toContain(collisionId);
      expect(requests[1]).toBe('Give this hero another greeting now');
      expect(
        result.current.controller.state.turns.some(
          (turn) => turn.kind === 'user' && turn.view.text.startsWith('/brand-voice'),
        ),
      ).toBe(true);
    },
    30_000,
  );

  it('builds the registry from the enabled skills and names them for a request', async () => {
    const checkpoints = createFakeCheckpoints();
    const { result } = renderHook(() =>
      useAgentKnowledge({ storage: seededStorage(SAMPLE_SKILLS, SAMPLE_NOTES), checkpoints }),
    );
    const { controllerOptions, view } = result.current;
    expect(controllerOptions.skillRegistry?.get('user.skill-1')?.name).toBe('Brand voice');
    // A skill that is off is not in the registry at all.
    expect(controllerOptions.skillRegistry?.get('user.skill-3')).toBeUndefined();
    // The person's two, and the default copy skill the same words turn on.
    expect([...(controllerOptions.hostSkillIdsFor?.('Rewrite the headline') ?? [])].sort()).toEqual(
      ['craftkit.natural-copy', 'user.skill-1', 'user.skill-2'],
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
        'craftkit.natural-copy',
      ]),
    );
    expect(result.current.view.skills.defaults[0]?.name).toBe('ذكاء التصميم Pro Max');
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

  it('sends inline skills as this request’s own without leaking into the next prompt', async () => {
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
    expect(
      result.current.knowledge.controllerOptions.selectedSkillIdsFor?.(
        '/copywriting Make this warmer',
      ),
    ).toEqual(['craftkit.copywriting']);

    act(() => {
      result.current.controller.setDraft(
        '/copywriting Make the hero feel warmer and more personal',
      );
    });
    act(() => {
      result.current.controller.send();
    });
    await waitFor(() => {
      expect(result.current.controller.state.run).toBeNull();
    }, WAIT);
    expect((contexts[0]?.skills ?? []).map(({ id }) => id)).toContain('craftkit.copywriting');
    expect(
      result.current.knowledge.controllerOptions.selectedSkillIdsFor?.('Another request'),
    ).toEqual([]);
  }, 30_000);

  it('accepts four enabled inline choices and ignores a disabled skill', () => {
    const { result } = renderHook(() => useAgentKnowledge({ storage: null }));
    expect(
      result.current.controllerOptions.selectedSkillIdsFor?.(
        '/copywriting /arabic-rtl /accessibility-review /pixi-v8-core',
      ),
    ).toHaveLength(4);
    act(() => {
      result.current.view.skills.setDefaultEnabled('craftkit.natural-copy', false);
    });
    expect(result.current.controllerOptions.selectedSkillIdsFor?.('/natural-copy')).toEqual([]);
  });

  it('offers the enabled Pixi companions automatically for an Arabic creative brief', () => {
    const { result } = renderHook(() => useAgentKnowledge({ storage: null }));
    const selected =
      result.current.controllerOptions.hostSkillIdsFor?.('سوي جدارية تفاعلية لقصة ليلية وشخصيات') ??
      [];
    expect(selected).toContain('craftkit.pixi-director');
    expect(selected).toContain('craftkit.pixi-v8-core');
  });

  it('keeps the queued prompt’s explicit skills after the preceding request finishes', async () => {
    const kernel = createEditKernel();
    kernel.setSelection(['selected-hero']);
    const contexts: AssembledAiContext[] = [];
    let finishFirst: (() => void) | undefined;
    const first = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const provider: AiPlanProvider = {
      async propose(_request, context) {
        contexts.push(context);
        if (contexts.length === 1) await first;
        return {
          rationale: 'Update the hero.',
          commands: [
            {
              command: 'setProp',
              args: {
                id: 'selected-hero',
                key: 'heading',
                value: `Welcome ${String(contexts.length)}`,
              },
            },
          ],
        };
      },
    };
    const { result } = renderHook(() =>
      useLiveController({
        kernel,
        provider,
        knowledgeStorage: seededStorage([], []),
        checkpoints: createFakeCheckpoints([]),
      }),
    );
    act(() => {
      result.current.controller.setDraft('/copywriting Improve this hero');
    });
    act(() => {
      result.current.controller.send();
    });
    await waitFor(() => {
      expect(contexts).toHaveLength(1);
    }, WAIT);
    act(() => {
      result.current.controller.setDraft('/arabic-rtl Improve this hero');
    });
    act(() => {
      result.current.controller.send();
    });
    expect(result.current.controller.state.queue?.text).toContain('/arabic-rtl');
    act(() => {
      finishFirst?.();
    });
    await waitFor(() => {
      expect(contexts).toHaveLength(2);
    }, WAIT);
    await waitFor(() => {
      expect(result.current.controller.state.run).toBeNull();
    }, WAIT);
    expect(contexts[0]?.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'craftkit.copywriting', reason: 'explicit' }),
      ]),
    );
    expect(contexts[1]?.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'craftkit.arabic-rtl', reason: 'explicit' }),
      ]),
    );
    expect(contexts[1]?.skills).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'craftkit.copywriting', reason: 'explicit' }),
      ]),
    );
  }, 30_000);
});
