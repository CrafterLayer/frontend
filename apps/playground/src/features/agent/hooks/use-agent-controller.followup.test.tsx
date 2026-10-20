import { act, renderHook, waitFor } from '@testing-library/react';
import type { AiPlan, AiPlanProvider, AssembledAiContext, BuilderKernel } from '@craftkit/builder';
import { createSiteBuilder, siteFromDocument } from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it, vi } from 'vitest';

import {
  createEditKernel,
  createPlanKernel,
  memoryStorage,
  planningProvider,
} from '../testing/scripted-engine';
import { useAgentController, type UseAgentControllerOptions } from './use-agent-controller';
import { marketingLanding, playgroundExtensions } from '../../preview/create-playground-kernel';

// This jsdom suite verifies controller ownership/application, not iframe rendering.
vi.mock('./agent-controller/scene-probe-options', () => ({ sceneProbeOptions: () => ({}) }));

const SOURCE = 'const s = await ck.scene({ libs: ["mural"] }); const actors = ["fox"];';

function sceneKernel(labels = ['Sea Mural', 'Space Mural']): BuilderKernel {
  const kernel = createPlanKernel([...labels, 'Footer']);
  for (let index = 0; index < labels.length; index += 1)
    kernel.dispatch('setProp', { id: `mine-${String(index)}`, key: 'js', value: SOURCE });
  return kernel;
}

function sceneSite() {
  const base = marketingLanding();
  const root = base.nodes[base.rootId];
  const scene = sceneKernel(['Ocean']).getDocument().nodes['mine-0'];
  if (root === undefined || scene === undefined) throw new Error('Expected fixture nodes.');
  const site = siteFromDocument({
    ...base,
    nodes: {
      [base.rootId]: { ...root, slots: { default: ['mine-0'] } },
      'mine-0': scene,
    },
  });
  const home = site.pages[0];
  if (home === undefined) throw new Error('Expected a home page.');
  const kernel = createSiteBuilder({
    site: {
      ...site,
      pages: [...site.pages, { ...home, id: 'another-page', address: '/another-page' }],
    },
    extensions: playgroundExtensions('landing'),
    ports: { clock: fixedClock(), ids: seededIds('followup-site') },
  });
  return { first: kernel.page(home.id), other: kernel.page('another-page') };
}

function mount(kernel: BuilderKernel) {
  const contexts: AssembledAiContext[] = [];
  const propose = vi.fn((_request: string, context: AssembledAiContext): Promise<AiPlan> => {
    contexts.push(context);
    const id = context.selection.ids[0];
    if (id === undefined) throw new Error('Fixture requires one owned target.');
    return Promise.resolve({
      version: 1,
      rationale: 'Extend the existing mural.',
      commands: [
        {
          command: 'setProp',
          args: {
            id,
            key: 'css',
            value: `:scope{background-color:${contexts.length === 1 ? '#112233' : '#223344'}}`,
          },
        },
        ...(_request.includes('add a scene')
          ? [
              {
                command: 'setProp',
                args: { id, key: 'js', value: `${SOURCE}\nconst nextScene = "Moonlit clearing";` },
              },
            ]
          : []),
      ],
    });
  });
  const provider: AiPlanProvider = { propose };
  const options: UseAgentControllerOptions = {
    kernel,
    provider,
    locale: 'en',
    enhancer: null,
    storage: memoryStorage(),
    freeCode: true,
  };
  const hook = renderHook((props: UseAgentControllerOptions) => useAgentController(props), {
    initialProps: options,
  });
  const send = async (text: string) => {
    act(() => {
      hook.result.current.setDraft(text);
      hook.result.current.send();
    });
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    });
  };
  return { ...hook, send, contexts, propose, options };
}

describe('creative edits keep the authored artifact', () => {
  it('continues the scene landed by an initial page build without a selection', async () => {
    const kernel = createPlanKernel();
    const base = planningProvider();
    const contexts: AssembledAiContext[] = [];
    const sceneJs =
      "const s=await ck.scene({libs:['fx']});const fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion});if(!s.editor&&!s.reducedMotion)s.tick(t=>fx.update(t.dt));s.dispose(()=>fx.dispose());";
    const provider: AiPlanProvider = {
      ...base,
      propose: async (request, context, options) => {
        if (request.includes('Make it calmer')) {
          contexts.push(context);
          const id = context.selection.ids[0];
          if (id === undefined) throw new Error('Expected the built scene target.');
          return {
            rationale: 'Refine the generated scene.',
            commands: [
              { command: 'setProp', args: { id, key: 'css', value: ':scope{background:#223344}' } },
            ],
          };
        }
        const plan = await base.propose(request, context, options);
        const id = context.selection.ids[0];
        if (!request.includes('ROLE: HERO') || id === undefined) return plan;
        return {
          ...plan,
          commands: [
            ...plan.commands,
            { command: 'setProp', args: { id, key: 'js', value: sceneJs } },
          ],
        };
      },
    };
    const storage = memoryStorage();
    const hook = renderHook(() =>
      useAgentController({
        kernel,
        provider,
        locale: 'en',
        enhancer: null,
        storage,
        freeCode: true,
      }),
    );
    act(() => {
      hook.result.current.setDraft('Build a coffee website with a mural');
      hook.result.current.send();
    });
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    });
    const build = hook.result.current.state.turns.find((turn) => turn.kind === 'build');
    if (build?.kind !== 'build') throw new Error('Expected the initial build.');
    const scene = Object.values(kernel.getDocument().nodes).find(
      (node) => node.props['js'] === sceneJs,
    );
    if (scene === undefined) throw new Error('Expected a scene actually landed by the writer.');
    expect(build.view.rows.find((row) => row.key === scene.id)?.state).toBe('landed');
    const before = kernel.getDocument();
    act(() => {
      hook.result.current.setDraft('Make it calmer');
      hook.result.current.send();
    });
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    });
    expect(contexts[0]?.selection.ids).toEqual([scene.id]);
    expect(kernel.getDocument().nodes[scene.id]?.props['css']).toContain('#223344');
    expect(kernel.getDocument().nodes[scene.id]?.props['js']).toBe(sceneJs);
    for (const [id, node] of Object.entries(before.nodes))
      if (id !== scene.id) expect(kernel.getDocument().nodes[id]).toEqual(node);
    hook.unmount();
  });

  it('captures the target after deselection, updates the same node, preserves siblings and undoes once', async () => {
    const kernel = sceneKernel();
    kernel.setSelection(['mine-0']);
    const hook = mount(kernel);
    await hook.send('Make this mural darker');
    expect(hook.contexts).toHaveLength(1);
    const before = kernel.getDocument();
    act(() => {
      kernel.setSelection([]);
    });
    await hook.send('add a scene to it');
    expect(hook.contexts).toHaveLength(2);
    expect(hook.contexts[1]?.selection.ids).toEqual(['mine-0']);
    expect(kernel.getDocument().nodes['root']?.slots).toEqual(before.nodes['root']?.slots);
    expect(kernel.getDocument().nodes['mine-1']).toEqual(before.nodes['mine-1']);
    expect(kernel.getDocument().nodes['mine-2']).toEqual(before.nodes['mine-2']);
    expect(kernel.getDocument().nodes['mine-0']?.props['js']).toContain(SOURCE);
    expect(kernel.getDocument().nodes['mine-0']?.props['js']).toContain('Moonlit clearing');
    expect(kernel.getDocument().nodes['mine-0']?.props['css']).toContain('#223344');
    const turn = hook.result.current.state.turns.findLast((entry) => entry.kind === 'edit');
    if (turn?.kind !== 'edit') throw new Error('Expected the applied edit.');
    act(() => {
      hook.result.current.undoEdit(turn.view.turnId);
    });
    expect(kernel.getDocument()).toEqual(before);
    hook.unmount();
  });

  it('asks for a target with multiple murals even when no enhancer exists', async () => {
    const kernel = sceneKernel();
    const before = kernel.getDocument();
    const hook = mount(kernel);
    await hook.send('خليها ليلية');
    expect(hook.propose).not.toHaveBeenCalled();
    expect(kernel.getDocument()).toBe(before);
    const answer = hook.result.current.state.turns.at(-1);
    if (answer?.kind !== 'answer') throw new Error('Expected a target question.');
    expect(answer.view.text).toContain('Which existing item');
    hook.unmount();
  });

  it('keeps explicit selection over the previous successful target', async () => {
    const kernel = sceneKernel();
    kernel.setSelection(['mine-0']);
    const hook = mount(kernel);
    await hook.send('Make this mural darker');
    act(() => {
      kernel.setSelection(['mine-1']);
    });
    await hook.send('Make it brighter');
    expect(hook.contexts[1]?.selection.ids).toEqual(['mine-1']);
    hook.unmount();
  });

  it('does not widen a Retry after its inferred artifact was removed', async () => {
    const kernel = sceneKernel(['Sea Mural']);
    const hook = mount(kernel);
    await hook.send('Make this mural darker');
    const turn = hook.result.current.state.turns.findLast((entry) => entry.kind === 'edit');
    if (turn?.kind !== 'edit') throw new Error('Expected the applied edit.');
    act(() => {
      kernel.dispatch('removeNode', { id: 'mine-0' });
    });
    const before = kernel.getDocument();
    act(() => {
      hook.result.current.tryAgain(turn.view.turnId);
    });
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    });
    expect(hook.propose).toHaveBeenCalledOnce();
    expect(kernel.getDocument()).toBe(before);
    expect(hook.result.current.state.turns.at(-1)).toMatchObject({
      kind: 'answer',
      view: { text: 'The target is gone. Pick another one.' },
    });
    hook.unmount();
  });

  it('does not borrow a prior page target after changing pages', async () => {
    const kernel = sceneKernel(['Sea Mural']);
    kernel.setSelection(['mine-0']);
    const hook = mount(kernel);
    await hook.send('Make this mural darker');
    const next = createPlanKernel(['Footer']);
    hook.rerender({ ...hook.options, kernel: next });
    const before = next.getDocument();
    await hook.send('add a scene to it');
    expect(hook.propose).toHaveBeenCalledOnce();
    expect(next.getDocument()).toBe(before);
    hook.unmount();
  });

  it('does not Retry on a different page that reuses the old target node id', async () => {
    const kernel = sceneKernel(['Sea Mural']);
    const hook = mount(kernel);
    await hook.send('Make this mural darker');
    const turn = hook.result.current.state.turns.findLast((entry) => entry.kind === 'edit');
    if (turn?.kind !== 'edit') throw new Error('Expected the applied edit.');
    const next = createPlanKernel(['Other content']);
    hook.rerender({ ...hook.options, kernel: next });
    const before = next.getDocument();
    act(() => {
      hook.result.current.tryAgain(turn.view.turnId);
    });
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    });
    expect(hook.propose).toHaveBeenCalledOnce();
    expect(next.getDocument()).toBe(before);
    expect(hook.result.current.state.turns.at(-1)).toMatchObject({
      kind: 'answer',
      view: { text: 'The target is gone. Pick another one.' },
    });
    hook.unmount();
  });

  it.each(['followup', 'retry'] as const)(
    'keeps %s on its captured site page despite shared transactions and colliding node ids',
    async (action) => {
      const { first, other } = sceneSite();
      const hook = mount(first);
      await hook.send('Make this mural darker');
      const turn = hook.result.current.state.turns.findLast((entry) => entry.kind === 'edit');
      if (turn?.kind !== 'edit') throw new Error('Expected the applied edit.');
      expect(first.transactions()).toEqual(other.transactions());
      expect(other.getDocument().nodes['mine-0']?.props['js']).toBe(SOURCE);
      hook.rerender({ ...hook.options, kernel: other });
      const before = other.getDocument();
      if (action === 'followup') await hook.send('Make it calmer');
      else
        act(() => {
          hook.result.current.tryAgain(turn.view.turnId);
        });
      await waitFor(() => {
        expect(hook.result.current.state.run).toBeNull();
      });
      expect(hook.propose).toHaveBeenCalledOnce();
      expect(other.getDocument()).toBe(before);
      expect(hook.result.current.state.turns.at(-1)).toMatchObject({
        kind: 'answer',
        view: { text: 'The target is gone. Pick another one.' },
      });
      hook.unmount();
    },
  );

  it('does not restore targeted Retry authority from a persisted error with matching node ids', async () => {
    const { first, other } = sceneSite();
    first.setSelection(['mine-0']);
    const hook = mount(first);
    hook.rerender({
      ...hook.options,
      provider: { propose: () => Promise.reject(new Error('The writer stopped.')) },
    });
    await hook.send('Make this mural darker');
    expect(hook.result.current.state.turns.at(-1)?.kind).toBe('error');
    hook.unmount();
    const before = other.getDocument();
    const restored = renderHook(() => useAgentController({ ...hook.options, kernel: other }));
    const error = restored.result.current.state.turns.find((turn) => turn.kind === 'error');
    if (error?.kind !== 'error') throw new Error('Expected the saved failure.');
    act(() => {
      restored.result.current.tryAgain(error.view.turnId);
    });
    expect(hook.propose).not.toHaveBeenCalled();
    expect(other.getDocument()).toBe(before);
    expect(restored.result.current.state.turns.at(-1)).toMatchObject({
      kind: 'answer',
      view: { text: 'The target is gone. Pick another one.' },
    });
    restored.unmount();
  });

  it.each(['apply', 'togglePreview'] as const)(
    'does not %s an Ask proposal on a foreign page with identical scene source',
    async (action) => {
      const { first, other } = sceneSite();
      const hook = mount(first);
      act(() => {
        hook.result.current.setMode('ask');
      });
      await hook.send('Make this mural darker');
      const proposal = hook.result.current.state.turns.find((turn) => turn.kind === 'proposal');
      if (proposal?.kind !== 'proposal') throw new Error('Expected an Ask proposal.');
      const before = other.getDocument();
      const onPreview = vi.fn();
      hook.rerender({ ...hook.options, kernel: other, onPreview });
      act(() => {
        hook.result.current[action](proposal.view.turnId);
      });
      expect(other.getDocument()).toBe(before);
      expect(first.transactions()).toHaveLength(0);
      expect(onPreview).not.toHaveBeenCalled();
      expect(hook.result.current.state.turns.at(-1)).toMatchObject({
        kind: 'answer',
        view: { text: 'The target is gone. Pick another one.' },
      });
      hook.unmount();
    },
  );

  it('still creates an explicitly requested new page after a successful mural edit', async () => {
    const kernel = sceneKernel(['Sea Mural']);
    const hook = mount(kernel);
    await hook.send('Make this mural darker');
    const before = kernel.getDocument();
    const addPage = vi.fn(() => Promise.resolve({ kernel: createPlanKernel() }));
    const proposePagePlan = vi.fn(() => new Promise<never>(() => undefined));
    hook.rerender({
      ...hook.options,
      provider: { propose: hook.propose, proposePagePlan },
      addPage,
    });
    act(() => {
      hook.result.current.setDraft('Create a new page with a space mural');
      hook.result.current.send();
    });
    await waitFor(() => {
      expect(proposePagePlan).toHaveBeenCalledOnce();
    });
    expect(addPage).toHaveBeenCalledOnce();
    expect(kernel.getDocument()).toBe(before);
    act(() => {
      hook.result.current.stop();
    });
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    });
    hook.unmount();
  });

  it('continues an ordinary selected section after deselection', async () => {
    const kernel = createEditKernel();
    kernel.setSelection(['selected-hero']);
    const contexts: AssembledAiContext[] = [];
    const provider: AiPlanProvider = {
      propose: (_request, context) => {
        contexts.push(context);
        const id = context.selection.ids[0];
        if (id === undefined) throw new Error('Expected the existing section.');
        return Promise.resolve({
          version: 1,
          rationale: 'Refine the existing heading.',
          commands: [
            {
              command: 'setProp',
              args: {
                id,
                key: 'heading',
                value: contexts.length === 1 ? 'A quieter welcome' : 'Welcome',
              },
            },
          ],
        });
      },
    };
    const storage = memoryStorage();
    const hook = renderHook(() =>
      useAgentController({ kernel, provider, locale: 'en', enhancer: null, storage }),
    );
    act(() => {
      hook.result.current.setDraft('Rewrite this heading');
      hook.result.current.send();
    });
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    });
    act(() => {
      kernel.setSelection([]);
    });
    act(() => {
      hook.result.current.setDraft('make it calmer');
      hook.result.current.send();
    });
    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
    });
    expect(contexts).toHaveLength(2);
    expect(contexts[1]?.selection.ids).toEqual(['selected-hero']);
    expect(kernel.getDocument().nodes['selected-hero']?.props['heading']).toBe('Welcome');
    hook.unmount();
  });
});
