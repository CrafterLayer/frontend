import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider } from '../types';
import { runAiBuild } from './run-build';

const page = defineBlockSchema({
  type: 'page',
  description: 'The page root.',
  props: z.object({}),
  slots: { default: { allow: ['section'], max: 12 } },
  examples: [],
});

const section = defineBlockSchema({
  type: 'section',
  description: 'A page region.',
  props: z.object({ label: z.string().default(''), body: z.string().default('') }),
  examples: [],
});

const Null: BlockRenderComponent = () => null;

const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'run-build.plan-only',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: page, render: Null },
      { schema: section, render: Null },
    ],
  },
};

function kernelWithPage() {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: { root: { id: 'root', type: 'page', props: {}, slots: { default: [] } } },
    },
    extensions: [vocabulary],
    ports: { clock: fixedClock(0), ids: seededIds('plan-only') },
  });
}

const scaffoldPlan: AiPlan = {
  rationale: 'A landing page: a hero, then pricing, then answers.',
  commands: [
    {
      command: 'insertNode',
      args: { type: 'section', parentId: 'root', props: { label: 'Hero' } },
    },
    {
      command: 'insertNode',
      args: { type: 'section', parentId: 'root', props: { label: 'Pricing' } },
    },
    { command: 'insertNode', args: { type: 'section', parentId: 'root', props: { label: 'FAQ' } } },
  ],
};

function providerOf(plan: AiPlan) {
  const propose = vi.fn<AiPlanProvider['propose']>().mockResolvedValue(plan);
  return { propose, provider: { propose } satisfies AiPlanProvider };
}

const ports = { clock: fixedClock(0), ids: seededIds('validate') };

async function planOnly(plan: AiPlan = scaffoldPlan) {
  const kernel = kernelWithPage();
  const { propose, provider } = providerOf(plan);
  const before = structuredClone(kernel.getDocument());
  const result = await runAiBuild({
    runId: 'run-plan',
    clock: fixedClock(0),
    kernel,
    provider,
    request: 'build me a landing page',
    validationPorts: ports,
    skillRegistry: createCraftkitAiSkillRegistry(),
    apply: 'never',
  });
  return { kernel, result, propose, before };
}

describe('runAiBuild with apply: never', () => {
  it('writes NOTHING — not the skeleton, not a section', async () => {
    const { kernel, before } = await planOnly();
    expect(kernel.getDocument()).toEqual(before);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('reports the sections the skeleton WOULD create, in the order it wrote them', async () => {
    const { result } = await planOnly();
    expect(result.outcome).toBe('planned');
    expect(result.plannedTasks).toEqual([
      { title: 'Hero' },
      { title: 'Pricing' },
      { title: 'FAQ' },
    ]);
  });

  it('gives those sections no id, because no node exists to name', async () => {
    const { result } = await planOnly();
    for (const task of result.plannedTasks ?? []) {
      expect('id' in task).toBe(false);
    }
  });

  it('fills nothing, so the model is asked exactly once', async () => {
    const { propose, result } = await planOnly();
    expect(propose).toHaveBeenCalledOnce();
    expect(result.tasks).toEqual([]);
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('carries the skeleton’s direction, which a real build would obey', async () => {
    const { result } = await planOnly();
    expect(result.direction).toBe('A landing page: a hero, then pricing, then answers.');
  });

  it('never falls back to an ordinary run — it was told not to work', async () => {
    const thin: AiPlan = {
      rationale: 'One region.',
      commands: [
        {
          command: 'insertNode',
          args: { type: 'section', parentId: 'root', props: { label: 'Only' } },
        },
      ],
    };
    const { propose, result } = await planOnly(thin);
    expect(result.outcome).toBe('planned');
    expect(result.plannedTasks).toEqual([{ title: 'Only' }]);
    expect(propose).toHaveBeenCalledOnce();
  });

  it('reports a skeleton with no labelled sections as a plan of none', async () => {
    const unlabelled: AiPlan = {
      rationale: 'Nothing nameable.',
      commands: [{ command: 'insertNode', args: { type: 'section', parentId: 'root', props: {} } }],
    };
    const { result } = await planOnly(unlabelled);
    expect(result.outcome).toBe('planned');
    expect(result.plannedTasks).toEqual([]);
  });

  it('keeps writing when apply is omitted — the default is unchanged', async () => {
    const kernel = kernelWithPage();
    const { provider } = providerOf(scaffoldPlan);
    const result = await runAiBuild({
      runId: 'run-auto',
      clock: fixedClock(0),
      kernel,
      provider,
      request: 'build me a landing page',
      validationPorts: ports,
      skillRegistry: createCraftkitAiSkillRegistry(),
    });
    expect(result.outcome).not.toBe('planned');
    expect(kernel.transactions().length).toBeGreaterThan(0);
  });

  /*
    THE TWO READERS MUST AGREE.

    An applied build reads titles from the created node's `props.label`; a
    planned build reads them from the insertNode ARGS, which have never been
    applied. If those two ever disagreed, a page would plan four sections and
    build zero — the plan a person approved would not be the page they got.
  */
  it('reads a title from the same place the applied build does', async () => {
    const { result } = await planOnly();
    const planned = (result.plannedTasks ?? []).map((task) => task.title);

    const kernel = kernelWithPage();
    const { provider } = providerOf(scaffoldPlan);
    const built = await runAiBuild({
      runId: 'run-parity',
      clock: fixedClock(0),
      kernel,
      provider,
      request: 'build me a landing page',
      validationPorts: { clock: fixedClock(0), ids: seededIds('parity') },
      skillRegistry: createCraftkitAiSkillRegistry(),
      onPlanned: () => 'stop',
    });

    expect(planned).toEqual(built.tasks.map((task) => task.title));
  });

  it('plans no section whose title is somewhere other than props.label', async () => {
    /*
      The honest failure mode, pinned. A model that writes the section name into
      a heading prop instead of `label` plans nothing — and an applied build of
      the same plan would find nothing either, which is why the two agree.
    */
    const elsewhere: AiPlan = {
      rationale: 'Titles in the wrong prop.',
      commands: [
        {
          command: 'insertNode',
          args: { type: 'section', parentId: 'root', props: { body: 'Hero' } },
        },
      ],
    };
    const { result } = await planOnly(elsewhere);
    expect(result.plannedTasks).toEqual([]);
  });
});
