/**
 * A build and the person's switches (2026-10-14): a built-in skill switched off reaches neither
 * the scaffold (by a match) nor any section writer (by name or by the section lane), and a page
 * plan does not name it. An explicit pick still wins, and the engine's required skills stay.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider, AssembledAiContext } from '../types';
import { planAiPage, runAiBuild } from './index';
import type { PlanAiPageOptions, RunAiBuildOptions } from './types';

const NullRender: BlockRenderComponent = () => null;

const BLOCKS: TrustedExtensionManifest = {
  tier: 1,
  name: 'build-excluded-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({
            title: z.string().default(''),
            lang: z.string().max(12).default(''),
            pageCss: customCss(20_000),
          }),
          slots: { default: { allow: ['customCode'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region.',
          props: z.object({
            label: z.string().default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: customCss(8_000),
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function kernel(): BuilderKernel {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } } },
  };
  return createBuilder({
    document,
    extensions: [BLOCKS],
    ports: { clock: fixedClock(1), ids: seededIds('build') },
  });
}

function region(text: string): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [{ kind: 'element', tag: 'h2', text, children: [] }],
      },
    ],
  };
}

const TITLES = ['Hero', 'Features', 'Pricing', 'Footer'] as const;
const DIRECTION =
  'SaaS analytics for operators. Palette slate-950, sky-400. Faces Inter and Inter. Signature a hairline grid. 1 Hero · 2 Features · 3 Pricing · 4 Footer.';

const SCAFFOLD: AiPlan = {
  rationale: DIRECTION,
  commands: TITLES.map((title) => ({
    command: 'insertNode',
    args: { type: 'customCode', parentId: 'root', props: { label: title, tree: region(title) } },
  })),
};

interface Call {
  readonly context: AssembledAiContext;
}

function skillsOf(call: Call | undefined): string[] {
  return (call?.context.fragments ?? [])
    .filter((fragment) => fragment.kind === 'instruction')
    .map((fragment) => fragment.source);
}

const REQUEST =
  'Create a landing page for a SaaS analytics tool with pricing, testimonials and FAQ';

async function build(extra: Partial<RunAiBuildOptions> = {}) {
  const calls: Call[] = [];
  const provider: AiPlanProvider = {
    propose(_request, context) {
      calls.push({ context });
      const id = context.selection.ids[0];
      if (id === undefined) return Promise.resolve(SCAFFOLD);
      return Promise.resolve({
        rationale: 'ok',
        commands: [{ command: 'setProp', args: { id, key: 'tree', value: region('x') } }],
      });
    },
  };
  const result = await runAiBuild({
    runId: 'excluded',
    clock: fixedClock(1000),
    kernel: kernel(),
    provider,
    request: REQUEST,
    validationPorts: { clock: fixedClock(1), ids: seededIds('excluded') },
    skillRegistry: createCraftkitAiSkillRegistry(),
    composition: { catalogMode: 'none' },
    ...extra,
  });
  return { result, scaffold: calls[0], writers: calls.slice(1) };
}

// A whole build per test; the budget only bounds a hang.
vi.setConfig({ testTimeout: 20_000 });

describe('runAiBuild — the person’s switches', () => {
  it('without switches, the scaffold matches page composition and writers get copy and conversion', async () => {
    const { scaffold, writers } = await build();
    expect(skillsOf(scaffold)).toContain('craftkit.page-composition');
    const named = new Set(writers.flatMap(skillsOf));
    expect(named).toContain('craftkit.copywriting');
    expect(named).toContain('craftkit.conversion-recipes');
  });

  it('leaves a switched-off skill out of the scaffold and every writer', async () => {
    const off = [
      'craftkit.page-composition',
      'craftkit.copywriting',
      'craftkit.conversion-recipes',
    ];
    const { result, scaffold, writers } = await build({ excludedSkillIds: off });
    expect(result.applied).toBe(TITLES.length);
    for (const call of [scaffold, ...writers]) {
      for (const id of off) expect(skillsOf(call)).not.toContain(id);
    }
  });

  it('keeps the engine-required skills even when the host excludes them', async () => {
    const { scaffold, writers } = await build({
      excludedSkillIds: ['craftkit.build-scaffold', 'craftkit.build-fill', 'craftkit.craft-manual'],
    });
    expect(skillsOf(scaffold)).toContain('craftkit.build-scaffold');
    for (const call of writers) {
      expect(skillsOf(call)).toContain('craftkit.build-fill');
      expect(skillsOf(call)).toContain('craftkit.craft-manual');
    }
  });

  it('lets an explicit pick win over a switch', async () => {
    const { writers } = await build({
      excludedSkillIds: ['craftkit.copywriting'],
      selectedSkillIds: ['craftkit.copywriting'],
      hostSkillIds: ['craftkit.copywriting'],
    });
    for (const call of writers) expect(skillsOf(call)).toContain('craftkit.copywriting');
  });
});

/** The planner's skills, from a provider that records its context and then declines. */
async function planSkills(extra: Partial<PlanAiPageOptions>) {
  const contexts: AssembledAiContext[] = [];
  const provider: AiPlanProvider = {
    propose: () => Promise.reject(new Error('a page plan never asks for commands')),
    proposePagePlan: (_request, context) => {
      contexts.push(context);
      return Promise.reject(new Error('declined'));
    },
  };
  await planAiPage('Build a sales report page with charts for my café', {
    runId: 'plan-excluded',
    clock: fixedClock(5),
    kernel: kernel(),
    provider,
    skillRegistry: createCraftkitAiSkillRegistry(),
    target: 'new-page',
    ...extra,
  });
  return (contexts[0]?.skills ?? []).map(({ id }) => id);
}

describe('planAiPage — the person’s switches', () => {
  it('names the copy and report skills while they are on', async () => {
    const skills = await planSkills({});
    expect(skills).toContain('craftkit.copywriting');
    expect(skills).toContain('craftkit.data-viz');
  });

  it('never names a switched-off skill, and keeps the direction deck', async () => {
    const skills = await planSkills({
      excludedSkillIds: ['craftkit.copywriting', 'craftkit.data-viz', 'craftkit.direction-deck'],
    });
    expect(skills).not.toContain('craftkit.copywriting');
    expect(skills).not.toContain('craftkit.data-viz');
    expect(skills).toContain('craftkit.direction-deck');
  });

  it('keeps a skill the host named because the person picked it', async () => {
    const skills = await planSkills({
      excludedSkillIds: ['craftkit.data-viz'],
      selectedSkillIds: ['craftkit.data-viz'],
      hostSkillIds: ['craftkit.data-viz'],
    });
    expect(skills).toContain('craftkit.data-viz');
  });
});
