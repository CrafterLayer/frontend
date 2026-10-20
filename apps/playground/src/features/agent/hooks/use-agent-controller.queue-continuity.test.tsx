import { act, renderHook, waitFor } from '@testing-library/react';
import type { AiPlan, AiPlanProvider, AssembledAiContext, BuilderKernel } from '@craftkit/builder';
import { describe, expect, it, vi } from 'vitest';

import {
  createPlanKernel,
  deferred,
  memoryStorage,
  planningProvider,
} from '../testing/scripted-engine';
import type { AgentController } from '../model/view-types';
import type { EnhanceResult } from '../model/enhance';
import { useAgentController, type UseAgentControllerOptions } from './use-agent-controller';

// Real controller/kernel application; iframe rendering has its own browser suite.
vi.mock('./agent-controller/scene-probe-options', () => ({ sceneProbeOptions: () => ({}) }));

const SOURCE = 'const s=await ck.scene({libs:["mural"]});';

function sceneKernel() {
  const kernel = createPlanKernel(['Ocean Mural', 'Space Mural']);
  for (const id of ['mine-0', 'mine-1'])
    kernel.dispatch('setProp', { id, key: 'js', value: SOURCE });
  return kernel;
}

function edit(id: string, value: string): AiPlan {
  return {
    rationale: 'Edit the existing artifact.',
    commands: [{ command: 'setProp', args: { id, key: 'css', value } }],
  };
}

function selected(context: AssembledAiContext): string {
  const id = context.selection.ids[0];
  if (id === undefined) throw new Error('Expected a grounded target.');
  return id;
}

function mount(kernel: BuilderKernel, provider: AiPlanProvider) {
  const options: UseAgentControllerOptions = {
    kernel,
    provider,
    locale: 'en',
    enhancer: null,
    storage: memoryStorage(),
    freeCode: true,
  };
  const hook = renderHook((props) => useAgentController(props), { initialProps: options });
  return { ...hook, options };
}

interface ControllerHook {
  readonly result: { readonly current: AgentController };
}

function send(hook: ControllerHook, text: string) {
  act(() => {
    hook.result.current.setDraft(text);
    hook.result.current.send();
  });
}

async function idle(hook: ControllerHook) {
  await waitFor(() => {
    expect(hook.result.current.state.run).toBeNull();
  });
}

describe('queued follow-up ownership', () => {
  it('continues the actual single-region fallback instead of an unrelated existing mural', async () => {
    const kernel = createPlanKernel(['Old mural']);
    kernel.dispatch('setProp', { id: 'mine-0', key: 'js', value: SOURCE });
    const old = kernel.getDocument().nodes['mine-0'];
    const hold = deferred<undefined>();
    let calls = 0;
    let created: string | undefined;
    const targets: string[] = [];
    const requests: string[] = [];
    const hook = mount(kernel, {
      propose: async (_request, context) => {
        requests.push(_request.slice(-1800));
        calls += 1;
        if (calls === 1)
          return {
            rationale: 'A single mural section.',
            commands: [
              {
                command: 'insertNode',
                args: {
                  type: 'customCode',
                  parentId: 'root',
                  props: { label: 'Fresh mural', tree: { kind: 'root', children: [] } },
                },
              },
            ],
          };
        if (calls === 2) {
          created = Object.values(kernel.getDocument().nodes).find(
            (node) => node.props['label'] === 'Fresh mural',
          )?.id;
          if (created === undefined) throw new Error('Expected actual scaffold node.');
          await hold.promise;
          return {
            rationale: 'Complete the single mural.',
            commands: [
              { command: 'setProp', args: { id: created, key: 'js', value: SOURCE } },
              {
                command: 'setProp',
                args: {
                  id: created,
                  key: 'tree',
                  value: '<section><h1>Fresh mural</h1></section>',
                },
              },
            ],
          };
        }
        targets.push(selected(context));
        return edit(selected(context), ':scope{color:blue}');
      },
    });
    send(hook, 'Build a new page for a coffee shop');
    await waitFor(() => {
      expect(calls).toBe(2);
      expect(
        created,
        JSON.stringify({ requests, turns: hook.result.current.state.turns }),
      ).toBeDefined();
    });
    send(hook, 'Make it calmer');
    act(() => {
      hold.resolve(undefined);
    });
    await waitFor(() => {
      expect(targets).toHaveLength(1);
    });
    await idle(hook);
    expect(targets).toEqual([created]);
    expect(kernel.getDocument().nodes['mine-0']).toEqual(old);
    if (created === undefined) throw new Error('Expected created mural.');
    expect(kernel.getDocument().nodes[created]?.props['css']).toBe(':scope{color:blue}');
    hook.unmount();
  });

  it('uses the completed active edit, reads its latest source and undoes only the follow-up', async () => {
    const kernel = sceneKernel();
    const hold = deferred<undefined>();
    const seen: AssembledAiContext[] = [];
    const provider: AiPlanProvider = {
      propose: async (_request, context) => {
        seen.push(context);
        const index = seen.length;
        if (index === 2) await hold.promise;
        return edit(
          selected(context),
          `:scope{color:${index === 1 ? 'red' : index === 2 ? 'blue' : 'green'}}`,
        );
      },
    };
    const hook = mount(kernel, provider);
    act(() => {
      kernel.setSelection(['mine-0']);
    });
    send(hook, 'Make this mural darker');
    await idle(hook);
    act(() => {
      kernel.setSelection(['mine-1']);
    });
    send(hook, 'Make this mural lighter');
    await waitFor(() => {
      expect(seen).toHaveLength(2);
    });
    act(() => {
      kernel.setSelection([]);
    });
    send(hook, 'Make it calmer');
    expect(hook.result.current.state.queue).not.toBeNull();
    act(() => {
      hold.resolve(undefined);
    });
    await waitFor(() => {
      expect(seen).toHaveLength(3);
    });
    await idle(hook);
    expect(seen[2]?.selection.ids).toEqual(['mine-1']);
    expect(JSON.stringify(seen[2]?.document)).toContain(':scope{color:blue}');
    expect(kernel.getDocument().nodes['mine-0']?.props['css']).toBe(':scope{color:red}');
    expect(kernel.getDocument().nodes['mine-1']?.props['css']).toBe(':scope{color:green}');
    const last = hook.result.current.state.turns.findLast((turn) => turn.kind === 'edit');
    if (last?.kind !== 'edit') throw new Error('Expected an applied follow-up.');
    act(() => {
      hook.result.current.undoEdit(last.view.turnId);
    });
    expect(kernel.getDocument().nodes['mine-1']?.props['css']).toBe(':scope{color:blue}');
    hook.unmount();
  });

  it('keeps explicit selection ahead of the active predecessor', async () => {
    const kernel = sceneKernel();
    const hold = deferred<undefined>();
    const targets: string[] = [];
    const hook = mount(kernel, {
      propose: async (_request, context) => {
        targets.push(selected(context));
        if (targets.length === 1) await hold.promise;
        return edit(selected(context), ':scope{color:blue}');
      },
    });
    act(() => {
      kernel.setSelection(['mine-0']);
    });
    send(hook, 'Make this mural darker');
    await waitFor(() => {
      expect(targets).toHaveLength(1);
    });
    act(() => {
      kernel.setSelection(['mine-1']);
    });
    send(hook, 'Make this mural lighter');
    act(() => {
      hold.resolve(undefined);
    });
    await waitFor(() => {
      expect(targets).toHaveLength(2);
    });
    await idle(hook);
    expect(targets).toEqual(['mine-0', 'mine-1']);
    hook.unmount();
  });

  it('refuses another page with colliding IDs, then continues on the original page', async () => {
    const first = sceneKernel();
    const other = sceneKernel();
    const hold = deferred<undefined>();
    let calls = 0;
    const provider: AiPlanProvider = {
      propose: async (_request, context) => {
        calls += 1;
        if (calls === 1) await hold.promise;
        return edit(
          selected(context),
          `:scope{color:${calls === 1 ? 'red' : calls === 2 ? 'blue' : 'green'}}`,
        );
      },
    };
    const hook = mount(first, provider);
    act(() => {
      first.setSelection(['mine-0']);
    });
    send(hook, 'Make this mural darker');
    await waitFor(() => {
      expect(calls).toBe(1);
    });
    send(hook, 'Make this mural lighter');
    const before = other.getDocument();
    hook.rerender({ ...hook.options, kernel: other });
    act(() => {
      hold.resolve(undefined);
    });
    await idle(hook);
    await waitFor(() => {
      expect(hook.result.current.state.queue?.status).toBe('missing');
    });
    expect(calls).toBe(1);
    expect(other.getDocument()).toEqual(before);
    act(() => {
      hook.result.current.continueQueued();
    });
    expect(calls).toBe(1);
    hook.rerender(hook.options);
    act(() => {
      hook.result.current.continueQueued();
    });
    await waitFor(() => {
      expect(calls).toBe(2);
    });
    await idle(hook);
    expect(first.getDocument().nodes['mine-0']?.props['css']).toBe(':scope{color:blue}');
    expect(other.getDocument()).toEqual(before);
    hook.unmount();
  });

  it('posts the queued result into its original conversation after a history switch', async () => {
    const kernel = sceneKernel();
    const hold = deferred<undefined>();
    let calls = 0;
    const hook = mount(kernel, {
      propose: async (_request, context) => {
        calls += 1;
        if (calls === 2) await hold.promise;
        return edit(
          selected(context),
          `:scope{color:${calls === 1 ? 'red' : calls === 2 ? 'blue' : 'green'}}`,
        );
      },
    });
    act(() => {
      kernel.setSelection(['mine-0']);
    });
    send(hook, 'Make this mural darker');
    await idle(hook);
    const otherId = hook.result.current.state.sessions.find((s) => s.current)?.id;
    if (otherId === undefined) throw new Error('Expected initial conversation.');
    act(() => {
      hook.result.current.newConversation();
    });
    const originId = hook.result.current.state.sessions.find((s) => s.current)?.id;
    if (originId === undefined) throw new Error('Expected origin conversation.');
    expect(originId).not.toBe(otherId);
    act(() => {
      kernel.setSelection(['mine-0']);
    });
    send(hook, 'Make this mural darker');
    await waitFor(() => {
      expect(calls).toBe(2);
    });
    send(hook, 'Make this mural lighter');
    act(() => {
      hook.result.current.openConversation(otherId);
    });
    act(() => {
      hold.resolve(undefined);
    });
    await waitFor(() => {
      expect(calls).toBe(3);
    });
    await idle(hook);
    expect(
      hook.result.current.state.turns
        .filter((turn) => turn.kind === 'user')
        .map((turn) => turn.view.text),
    ).toEqual(['Make this mural darker']);
    act(() => {
      hook.result.current.openConversation(originId);
    });
    expect(hook.result.current.state.turns.filter((t) => t.kind === 'user')).toHaveLength(2);
    expect(hook.result.current.state.turns.filter((t) => t.kind === 'edit')).toHaveLength(2);
    hook.unmount();
  });

  it('does not revive an older successful target when its queued predecessor fails', async () => {
    const kernel = sceneKernel();
    const hold = deferred<undefined>();
    let calls = 0;
    const hook = mount(kernel, {
      propose: async (_request, context) => {
        calls += 1;
        if (calls === 2) {
          await hold.promise;
          throw new Error('Unavailable');
        }
        return edit(selected(context), ':scope{color:red}');
      },
    });
    act(() => {
      kernel.setSelection(['mine-0']);
    });
    send(hook, 'Make this mural darker');
    await idle(hook);
    act(() => {
      kernel.setSelection(['mine-1']);
    });
    send(hook, 'Make this mural lighter');
    await waitFor(() => {
      expect(calls).toBe(2);
    });
    act(() => {
      kernel.setSelection([]);
    });
    send(hook, 'Make it calmer');
    act(() => {
      hold.resolve(undefined);
    });
    await idle(hook);
    await waitFor(() => {
      expect(hook.result.current.state.turns.at(-1)?.kind).toBe('answer');
    });
    expect(calls).toBe(2);
    expect(kernel.getDocument().nodes['mine-1']?.props['css']).toBeUndefined();
    expect(kernel.getDocument().nodes['mine-0']?.props['css']).toBe(':scope{color:red}');
    hook.unmount();
  });
});

describe('page landing claims the run before asynchronous host work', () => {
  it('queues the next prompt immediately and applies it to the page actually built', async () => {
    const initial = createPlanKernel(['Existing footer']);
    const before = initial.getDocument();
    const fresh = createPlanKernel();
    const landing = deferred<{ kernel: BuilderKernel }>();
    const addPage = vi.fn(() => landing.promise);
    const base = planningProvider();
    const sceneJs =
      "const s=await ck.scene({libs:['fx']});const fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion});if(!s.editor&&!s.reducedMotion)s.tick(t=>fx.update(t.dt));s.dispose(()=>fx.dispose());";
    const contexts: AssembledAiContext[] = [];
    const provider: AiPlanProvider = {
      ...base,
      propose: async (request, context, options) => {
        if (request.includes('Make it calmer')) {
          contexts.push(context);
          return edit(selected(context), ':scope{background:#223344}');
        }
        const plan = await base.propose(request, context, options);
        const id = context.selection.ids[0];
        return request.includes('ROLE: HERO') && id !== undefined
          ? {
              ...plan,
              commands: [
                ...plan.commands,
                { command: 'setProp', args: { id, key: 'js', value: sceneJs } },
              ],
            }
          : plan;
      },
    };
    const options: UseAgentControllerOptions = {
      kernel: initial,
      provider,
      locale: 'en',
      enhancer: null,
      storage: memoryStorage(),
      freeCode: true,
      addPage,
    };
    const hook = renderHook((props) => useAgentController(props), { initialProps: options });
    send(hook, 'Build a new page for a coffee shop with a mural');
    expect(addPage).toHaveBeenCalledTimes(1);
    expect(hook.result.current.state.run).not.toBeNull();
    send(hook, 'Make it calmer');
    expect(hook.result.current.state.queue?.text).toBe('Make it calmer');
    hook.rerender({ ...options, kernel: fresh });
    act(() => {
      landing.resolve({ kernel: fresh });
    });
    await waitFor(() => {
      expect(
        contexts,
        JSON.stringify({
          turns: hook.result.current.state.turns,
          queue: hook.result.current.state.queue,
        }),
      ).toHaveLength(1);
    });
    await idle(hook);
    const id = contexts[0]?.selection.ids[0];
    if (id === undefined) throw new Error('Expected new mural ownership.');
    expect(fresh.getDocument().nodes[id]?.props['css']).toBe(':scope{background:#223344}');
    expect(initial.getDocument()).toEqual(before);
    hook.unmount();
  });

  it('Stop releases a pending host landing and never starts its late build', async () => {
    const kernel = createPlanKernel(['Existing footer']);
    const fresh = createPlanKernel();
    const landing = deferred<{ kernel: BuilderKernel }>();
    const addPage = vi.fn(() => landing.promise);
    const base = planningProvider();
    const propose = vi.fn((...args: Parameters<AiPlanProvider['propose']>) =>
      base.propose(...args),
    );
    const hook = renderHook(() =>
      useAgentController({
        kernel,
        provider: { ...base, propose },
        locale: 'en',
        enhancer: null,
        storage: memoryStorage(),
        addPage,
      }),
    );
    send(hook, 'Build a new page for a coffee shop');
    expect(addPage).toHaveBeenCalledTimes(1);
    expect(hook.result.current.state.run).not.toBeNull();
    send(hook, 'Make it calmer');
    act(() => {
      hook.result.current.stop();
    });
    await idle(hook);
    expect(hook.result.current.state.queue?.status).toBe('paused');
    await act(async () => {
      landing.resolve({ kernel: fresh });
      await landing.promise;
    });
    expect(propose).not.toHaveBeenCalled();
    expect(base.planCalls()).toBe(0);
    expect(Object.keys(fresh.getDocument().nodes)).toEqual(['root']);
    expect(hook.result.current.state.run).toBeNull();
    hook.unmount();
  });
});

describe('clarification retains the request page', () => {
  it('keeps the original conversation when another run starts during clarification', async () => {
    const kernel = createPlanKernel();
    const enhancement = deferred<EnhanceResult>();
    const running = deferred<undefined>();
    const enhance = vi.fn(() => enhancement.promise);
    let calls = 0;
    const options: UseAgentControllerOptions = {
      kernel,
      locale: 'en',
      storage: memoryStorage(),
      enhancer: { enhance },
      provider: {
        propose: async () => {
          calls += 1;
          if (calls === 2) await running.promise;
          return calls < 3
            ? { rationale: 'Open Theme to choose a font.', commands: [] }
            : {
                rationale: 'Update the current page.',
                commands: [
                  { command: 'setProp', args: { id: 'root', key: 'title', value: 'Blue' } },
                ],
              };
        },
      },
    };
    const hook = renderHook(() => useAgentController(options));
    send(hook, 'How do I change the font?');
    await idle(hook);
    const older = hook.result.current.state.sessions.find((session) => session.current)?.id;
    const answer = hook.result.current.state.turns.find((turn) => turn.kind === 'answer');
    if (older === undefined || answer?.kind !== 'answer') throw new Error('Expected older answer.');
    act(() => {
      hook.result.current.newConversation();
    });
    const origin = hook.result.current.state.sessions.find((session) => session.current)?.id;
    if (origin === undefined) throw new Error('Expected new conversation.');
    send(hook, 'make it blue');
    await waitFor(() => {
      expect(enhance).toHaveBeenCalledTimes(1);
    });
    act(() => {
      hook.result.current.openConversation(older);
      hook.result.current.tryAgain(answer.view.turnId);
    });
    await waitFor(() => {
      expect(calls).toBe(2);
    });
    act(() => {
      enhancement.resolve({
        enhanced: '',
        understood: 'Change colour',
        changes: [],
        questions: [],
      });
    });
    await waitFor(() => {
      expect(hook.result.current.state.queue?.text).toBe('make it blue');
    });
    act(() => {
      running.resolve(undefined);
    });
    await waitFor(() => {
      expect(calls).toBe(3);
    });
    await idle(hook);
    expect(hook.result.current.state.turns.filter((turn) => turn.kind === 'user')).toHaveLength(1);
    act(() => {
      hook.result.current.openConversation(origin);
    });
    expect(hook.result.current.state.turns.filter((turn) => turn.kind === 'edit')).toHaveLength(1);
    expect(kernel.getDocument().nodes['root']?.props['title']).toBe('Blue');
    hook.unmount();
  });

  it.each(['checking', 'answer', 'as-written'] as const)(
    'refuses page drift while %s',
    async (phase) => {
      const kernel = createPlanKernel();
      const other = createPlanKernel();
      const result = deferred<EnhanceResult>();
      const enhance = vi.fn(() => result.promise);
      const propose = vi.fn((): Promise<AiPlan> =>
        Promise.resolve({ rationale: 'No changes.', commands: [] }),
      );
      const options: UseAgentControllerOptions = {
        kernel,
        provider: { propose },
        enhancer: { enhance },
        locale: 'en',
        storage: memoryStorage(),
      };
      const hook = renderHook((props) => useAgentController(props), { initialProps: options });
      send(hook, 'make it blue');
      await waitFor(() => {
        expect(enhance).toHaveBeenCalledTimes(1);
      });
      if (phase === 'checking') hook.rerender({ ...options, kernel: other });
      act(() => {
        result.resolve({
          enhanced: '',
          understood: 'Change colour',
          changes: [],
          questions: [{ id: 'colour', text: 'Which colour?', choices: ['Blue', 'Green'] }],
        });
      });
      if (phase !== 'checking') {
        await waitFor(() => {
          expect(hook.result.current.state.clarify?.status).toBe('asking');
        });
        hook.rerender({ ...options, kernel: other });
        act(() => {
          if (phase === 'answer') hook.result.current.answerClarify('colour', 'Blue');
          else hook.result.current.sendAsWritten();
        });
      }
      await waitFor(() => {
        expect(hook.result.current.state.turns.at(-1)?.kind).toBe('answer');
      });
      expect(propose).not.toHaveBeenCalled();
      expect(enhance).toHaveBeenCalledTimes(1);
      expect(Object.keys(other.getDocument().nodes)).toEqual(['root']);
      hook.unmount();
    },
  );
});
