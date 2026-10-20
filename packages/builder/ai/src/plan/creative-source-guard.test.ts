import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { incidentOptions, SCENE, SCENE_JS } from '../agent/run-agent.incident-fixtures';
import { runAiAgent } from '../agent/run-agent';
import { assembleAiContext } from '../context';
import { scenePreset } from '../scene-presets/catalog';
import { expandAgentTools } from '../tools/agent/expand';
import { metaOf } from '../tools/agent/builtin/scene-preset-region';
import type { AiPlan, AssembledAiContext } from '../types';
import { applyAiPlan } from './apply-plan';
import { parseTreeMarkup } from './tree-markup';
import { AiValidatedProposalError, createAiValidatedProposal } from './validated-proposal';

function fixture() {
  const options = incidentOptions();
  const kernel = options.kernel;
  kernel.dispatchGroup(SCENE.commands, { author: 'user' });
  kernel.dispatchGroup(SCENE.commands, { author: 'user' });
  const ids = Object.keys(kernel.getDocument().nodes).filter((id) => id !== 'root');
  const id = ids[0];
  const sibling = ids[1];
  if (id === undefined || sibling === undefined) throw new Error('missing fixture regions');
  return { options, kernel, id, sibling };
}

function write(kernel: BuilderKernel, id: string, key: string, value: unknown) {
  kernel.dispatchGroup([{ command: 'setProp', args: { id, key, value } }], { author: 'user' });
}

function proposal(
  kernel: BuilderKernel,
  plan: AiPlan,
  context: AssembledAiContext = assembleAiContext(kernel.context),
) {
  return createAiValidatedProposal({
    plan,
    context,
    policy: {
      allowedCommands: [...kernel.context.registry.commandNames()],
      maxCommands: 20,
      maxOperations: 40,
    },
  });
}

const ports = () => ({ clock: fixedClock(20), ids: seededIds('source-guard') });
const revisedJs = `${SCENE_JS}\nconst addedStars=3;`;

function edit(id: string, key = 'js', value: unknown = revisedJs): AiPlan {
  return {
    rationale: 'Extend the existing scene.',
    commands: [{ command: 'setProp', args: { id, key, value } }],
  };
}

describe('creative proposal source continuity', () => {
  it('rejects newer source after proposal preparation without adding a transaction', () => {
    const { kernel, id } = fixture();
    const prepared = proposal(kernel, edit(id));
    write(kernel, id, 'js', `${SCENE_JS}\nconst userAddedTree=true;`);
    const current = kernel.getDocument();
    const history = kernel.transactions().length;

    expect(() => applyAiPlan({ kernel, proposal: prepared, validationPorts: ports() })).toThrow(
      AiValidatedProposalError,
    );
    expect(() => applyAiPlan({ kernel, proposal: prepared, validationPorts: ports() })).toThrow(
      /newer changes were kept/u,
    );
    expect(kernel.getDocument()).toBe(current);
    expect(kernel.transactions()).toHaveLength(history);
  });

  it('protects a user edit made while the provider is generating from older source', async () => {
    const { options, kernel, id } = fixture();
    let answer!: (plan: AiPlan) => void;
    let gathered!: (context: AssembledAiContext) => void;
    const called = new Promise<AssembledAiContext>((resolve) => {
      gathered = resolve;
    });
    const result = new Promise<AiPlan>((resolve) => {
      answer = resolve;
    });
    const pending = runAiAgent({
      ...options,
      request: 'Make this mural calmer',
      selection: [id],
      directEdits: false,
      provider: {
        propose: (_request, context) => {
          gathered(context);
          return result;
        },
      },
    });
    const context = await called;
    expect(context.document.nodes.find((node) => node.id === id)?.props['js']).toBe(SCENE_JS);
    write(kernel, id, 'js', `${SCENE_JS}\nconst userAddedTree=true;`);
    const current = kernel.getDocument();
    answer(edit(id));

    await expect(pending).rejects.toMatchObject({ code: 'stale-source' });
    expect(kernel.getDocument()).toBe(current);
  });

  it('allows sibling and untouched-property edits and preserves them through undo', () => {
    const { kernel, id, sibling } = fixture();
    const prepared = proposal(kernel, edit(id));
    write(kernel, sibling, 'js', `${SCENE_JS}\nconst otherScene=true;`);
    write(kernel, id, 'css', '.winter-scene{min-height:520px}');
    const current = kernel.getDocument();

    const applied = applyAiPlan({ kernel, proposal: prepared, validationPorts: ports() });
    expect(applied.transactions).toHaveLength(1);
    expect(kernel.getDocument().nodes[id]?.props).toEqual({
      ...current.nodes[id]?.props,
      js: revisedJs,
    });
    expect(kernel.getDocument().nodes[sibling]).toEqual(current.nodes[sibling]);
    kernel.undo();
    expect(kernel.getDocument()).toEqual(current);
  });

  it('compares stored trees with context markup and refuses later tree changes', () => {
    const { kernel, id } = fixture();
    const tree = parseTreeMarkup('<section><h1>Extended story</h1></section>');
    const prepared = proposal(kernel, edit(id, 'tree', tree));
    applyAiPlan({ kernel, proposal: prepared, validationPorts: ports() });
    expect(kernel.getDocument().nodes[id]?.props['tree']).toEqual(tree);
    kernel.undo();
    write(kernel, id, 'tree', parseTreeMarkup('<section><h1>User story</h1></section>'));
    const current = kernel.getDocument();
    expect(() => applyAiPlan({ kernel, proposal: prepared, validationPorts: ports() })).toThrow(
      /changed after this edit/u,
    );
    expect(kernel.getDocument()).toBe(current);
  });

  it('guards the concrete settings writes expanded from a preset tool', () => {
    const { kernel, id } = fixture();
    const preset = scenePreset('flow-field-silk');
    if (preset === undefined) throw new Error('missing mural preset');
    write(kernel, id, 'js', preset.code);
    write(kernel, id, 'jsMeta', metaOf(preset));
    write(kernel, id, 'jsParams', { speed: 2 });
    const context = assembleAiContext(kernel.context);
    const expanded = expandAgentTools(
      {
        rationale: 'Change only density.',
        commands: [
          {
            command: 'tool',
            args: {
              name: 'scene.preset',
              input: { preset: preset.id, id, params: { density: 0.3 } },
            },
          },
        ],
      },
      kernel,
    );
    expect(expanded.issues).toEqual([]);
    const prepared = proposal(kernel, expanded.plan as AiPlan, context);
    expect(prepared.plan.commands).toMatchObject([
      { command: 'setProp', args: { key: 'jsParams' } },
    ]);
    write(kernel, id, 'jsParams', { speed: 2, seed: 77 });
    const current = kernel.getDocument();
    expect(() => applyAiPlan({ kernel, proposal: prepared, validationPorts: ports() })).toThrow(
      /changed after this edit/u,
    );
    expect(kernel.getDocument()).toBe(current);
  });

  it.each([
    { command: 'removeNode', args: {} },
    { command: 'applyPatches', args: {} },
  ])('guards existing scene source through $command', ({ command }) => {
    const { kernel, id } = fixture();
    const plan: AiPlan = {
      rationale: 'Update this scene.',
      commands: [
        {
          command,
          args:
            command === 'removeNode'
              ? { id }
              : {
                  patches: [
                    { op: 'replace', path: ['nodes', id, 'props', 'js'], value: revisedJs },
                  ],
                },
        },
      ],
    };
    const prepared = proposal(kernel, plan);
    write(kernel, id, 'js', `${SCENE_JS}\nconst manual=true;`);
    const current = kernel.getDocument();
    expect(() => applyAiPlan({ kernel, proposal: prepared, validationPorts: ports() })).toThrow(
      /changed after this edit/u,
    );
    expect(kernel.getDocument()).toBe(current);
  });

  it('allows a settings-only proposal to preserve code changed after it was prepared', () => {
    const { kernel, id } = fixture();
    const prepared = proposal(kernel, edit(id, 'jsParams', { speed: 0.5 }));
    const authored = `${SCENE_JS}\nconst manual=true;`;
    write(kernel, id, 'js', authored);
    applyAiPlan({ kernel, proposal: prepared, validationPorts: ports() });
    expect(kernel.getDocument().nodes[id]?.props['js']).toBe(authored);
    expect(kernel.getDocument().nodes[id]?.props['jsParams']).toEqual({ speed: 0.5 });
  });

  it('keeps explicit plan and policy compatibility behavior without inventing a source snapshot', () => {
    const { kernel, id } = fixture();
    write(kernel, id, 'js', `${SCENE_JS}\nconst manual=true;`);
    applyAiPlan({
      kernel,
      plan: edit(id),
      policy: { allowedCommands: ['setProp'], maxCommands: 2, maxOperations: 2 },
      validationPorts: ports(),
    });
    expect(kernel.getDocument().nodes[id]?.props['js']).toBe(revisedJs);
  });
});
