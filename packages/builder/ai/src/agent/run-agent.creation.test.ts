import { describe, expect, it, vi } from 'vitest';

import { emptyCustomCodeTree } from '@craftkit/builder-schema';

import { AiPlanRejectedError } from '../plan/validate-plan';
import type { AiPlan, AiPlanValidationIssue } from '../types';
import { runAiAgent } from './run-agent';
import { incidentOptions, METADATA, MURAL_REQUEST, SCENE } from './run-agent.incident-fixtures';
import type { AiAgentEvent } from './types';

describe('scene creation produces content before success', () => {
  it('repairs a valid metadata-only answer once into the requested scene', async () => {
    const issues: AiPlanValidationIssue[][] = [];
    const repair = vi.fn((_request, _context, _plan, refused: readonly AiPlanValidationIssue[]) => {
      issues.push([...refused]);
      return Promise.resolve(SCENE);
    });
    const options = incidentOptions({
      request: MURAL_REQUEST,
      provider: { propose: () => Promise.resolve(METADATA), repair },
    });
    const result = await runAiAgent(options);
    expect(result.status).toBe('applied');
    expect(repair).toHaveBeenCalledTimes(1);
    expect(
      issues
        .flat()
        .map(({ message }) => message)
        .join(' '),
    ).toMatch(/scene.*content|content.*scene/iu);
    expect(options.kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(1);
    expect(options.kernel.transactions()).toHaveLength(1);
  });

  it.each([
    ['valid', 'incident', MURAL_REQUEST],
    ['salvaged', 'incident', MURAL_REQUEST],
    ['valid', 'user/session/create', MURAL_REQUEST],
    [
      'valid',
      'arabic-mural',
      'سوي الي جدارية قصصية افقية فيها بلدات صغيرة، وبدي تضيف قطار يتنقل بين الفصول، وخلي النصوص عربية',
    ],
  ] as const)(
    'refuses %s metadata-only creation for %s without applying or announcing success',
    async (kind, runId, request) => {
      const events: AiAgentEvent[] = [];
      const plan: AiPlan =
        kind === 'valid'
          ? METADATA
          : {
              ...METADATA,
              commands: [
                ...METADATA.commands,
                {
                  command: 'setProp',
                  args: { id: 'never-created-scene', key: 'tree', value: emptyCustomCodeTree() },
                },
              ],
            };
      const repair = vi.fn(() => Promise.resolve(plan));
      const options = incidentOptions({
        runId,
        request,
        provider: { propose: () => Promise.resolve(plan), repair },
        onEvent: (event) => events.push(event),
      });
      await expect(runAiAgent(options)).rejects.toBeInstanceOf(AiPlanRejectedError);
      expect(repair).toHaveBeenCalledTimes(1);
      expect(options.kernel.transactions()).toHaveLength(0);
      expect(options.kernel.getDocument().dir).toBe('ltr');
      expect(events.map(({ type }) => type)).not.toContain('run.completed');
      expect(events.map(({ type }) => type)).not.toContain('plan.salvaged');
      expect(events.at(-1)?.type).toBe('run.failed');
    },
  );

  it('refuses an empty inserted region even when its label promises a scene', async () => {
    const empty: AiPlan = {
      ...SCENE,
      commands: [
        {
          command: 'insertNode',
          args: {
            parentId: 'root',
            slot: 'default',
            type: 'customCode',
            props: { label: 'A complete winter mural', tree: emptyCustomCodeTree(), css: '' },
          },
        },
      ],
    };
    const options = incidentOptions({
      request: MURAL_REQUEST,
      provider: { propose: () => Promise.resolve(empty), repair: () => Promise.resolve(empty) },
    });
    await expect(runAiAgent(options)).rejects.toBeInstanceOf(AiPlanRejectedError);
    expect(options.kernel.transactions()).toHaveLength(0);
  });

  it('keeps a real scene when salvage drops an unrelated invalid command', async () => {
    const plan: AiPlan = {
      ...SCENE,
      commands: [
        ...SCENE.commands,
        { command: 'setProp', args: { id: 'ghost', key: 'label', value: 'No' } },
      ],
    };
    const events: AiAgentEvent[] = [];
    const options = incidentOptions({
      request: MURAL_REQUEST,
      provider: { propose: () => Promise.resolve(plan), repair: () => Promise.resolve(plan) },
      onEvent: (event) => events.push(event),
    });
    expect((await runAiAgent(options)).status).toBe('applied');
    expect(events.find(({ type }) => type === 'plan.salvaged')).toMatchObject({ kept: 1 });
    expect(options.kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(1);
  });

  it.each([
    'const s=await ck.scene();',
    '// const s=await ck.scene(); s.app.stage.addChild(new s.PIXI.Graphics());',
    'const s=await ck.scene();new s.PIXI.Graphics();',
    'const s=await ck.scene();s.app.stage.addChild(new s.PIXI.Graphics());',
    'const s=await ck.scene();const g=new s.PIXI.Graphics().rect(0,0,100,100).fill(0xff0000);',
    'const s=await ck.scene();const g=new s.PIXI.Graphics().rect(0,0,100,100);s.world.addChild(g);',
    'const s=await ck.scene();const c=new s.PIXI.Container();c.addChild(new s.PIXI.Graphics().circle(10,10,10).fill(0xff0000));',
  ])('refuses a host with an empty or comment-only program: %s', async (js) => {
    const plan: AiPlan = {
      ...SCENE,
      commands: [
        {
          command: 'insertNode',
          args: {
            parentId: 'root',
            slot: 'default',
            type: 'customCode',
            props: {
              label: 'Winter',
              tree: { kind: 'root', children: [{ kind: 'element', tag: 'section', children: [] }] },
              css: '.winter{min-height:400px}',
              js,
            },
          },
        },
      ],
    };
    const options = incidentOptions({
      request: MURAL_REQUEST,
      provider: { propose: () => Promise.resolve(plan) },
    });
    await expect(runAiAgent(options)).rejects.toBeInstanceOf(AiPlanRejectedError);
    expect(options.kernel.transactions()).toHaveLength(0);
  });

  it('refuses a plan that removes the scene it created before completion', async () => {
    const options = incidentOptions();
    options.kernel.dispatch('insertNode', {
      parentId: 'root',
      slot: 'default',
      type: 'customCode',
      props: { label: 'Placeholder', tree: emptyCustomCodeTree() },
    });
    const id = options.kernel.getDocument().nodes['root']?.slots?.['default']?.[0];
    const plan: AiPlan = {
      ...SCENE,
      commands: [
        {
          command: 'setProp',
          args: {
            id,
            key: 'js',
            value: 'const s=await ck.scene();s.app.stage.addChild(new s.PIXI.Graphics());',
          },
        },
        { command: 'removeNode', args: { id } },
      ],
    };
    const before = options.kernel.transactions().length;
    await expect(
      runAiAgent({
        ...options,
        request: MURAL_REQUEST,
        provider: { propose: () => Promise.resolve(plan) },
      }),
    ).rejects.toBeInstanceOf(AiPlanRejectedError);
    expect(options.kernel.transactions()).toHaveLength(before);
  });

  it.each([
    'Set the page language to Arabic and its direction to RTL',
    'لا تسوي جدارية، غير اللغة فقط',
  ])('preserves ordinary metadata edits: %s', async (request) => {
    const repair = vi.fn(() => Promise.resolve(METADATA));
    const options = incidentOptions({
      request,
      provider: { propose: () => Promise.resolve(METADATA), repair },
    });
    expect((await runAiAgent(options)).status).toBe('applied');
    expect(options.kernel.getDocument().dir).toBe('rtl');
    expect(repair).not.toHaveBeenCalled();
  });

  it('accepts a tested full story kit in the ordinary edit lane', async () => {
    const options = incidentOptions({
      request: 'Create an interactive scroll story about a winter journey',
      provider: {
        propose: () =>
          Promise.resolve({
            rationale: 'Place a complete story kit.',
            commands: [
              {
                command: 'tool',
                args: { name: 'scene.preset', input: { preset: 'scroll-story' } },
              },
            ],
          }),
      },
    });
    expect((await runAiAgent(options)).status).toBe('applied');
    const document = options.kernel.getDocument();
    const region = document.nodes[document.nodes['root']?.slots?.['default']?.[0] ?? ''];
    expect(region?.props['js']).toEqual(expect.stringContaining('ck.scene'));
    const content: unknown = expect.arrayContaining([expect.anything()]);
    expect(region?.props['tree']).toMatchObject({
      kind: 'root',
      children: content,
    });
  });
});
