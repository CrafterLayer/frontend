/**
 * The person's own skills in a build (2026-10-12): a page plan names its skills rather than
 * matching them, so a host skill reaches it only through `hostSkillIds` — offered first among
 * the optional skills, never made mandatory.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { AiPlanProvider, AssembledAiContext } from '../types';
import { createCraftkitAiSkillRegistry, type AiSkillDefinitionV1 } from '../skills';
import { stepSkills, withHostSkills } from './host-skills';
import { planAiPage } from './plan-page';

const NullRender: BlockRenderComponent = () => null;

function kernel(): BuilderKernel {
  const manifest: TrustedExtensionManifest = {
    tier: 1,
    name: 'host-skills-fixture',
    version: '0.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'The page root.',
            props: z.object({ title: z.string().max(120).default('') }),
            slots: { default: { allow: ['page'] } },
            examples: [],
          }),
          render: NullRender,
        },
      ],
    },
  };
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } } },
  };
  return createBuilder({
    document,
    extensions: [manifest],
    ports: { clock: fixedClock(1), ids: seededIds('host') },
  });
}

const BRAND_VOICE: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'user.skill-1',
  name: 'Brand voice',
  description: 'Every line of copy',
  version: '1.0.0',
  instructions: 'Write short, warm sentences. Never use exclamation marks.',
  source: 'host',
  trust: 'reviewed',
  activation: { mode: 'auto', keywords: ['brand voice'] },
};

/** A provider that records the planner's context, then declines (the plan itself is not under test). */
function recordingPlanner() {
  const contexts: AssembledAiContext[] = [];
  const provider: AiPlanProvider = {
    propose: () => Promise.reject(new Error('a page plan never asks for commands')),
    proposePagePlan: (_request, context) => {
      contexts.push(context);
      return Promise.reject(new Error('declined'));
    },
  };
  return { provider, contexts };
}

async function planSkills(hostSkillIds?: readonly string[]): Promise<readonly string[]> {
  const { provider, contexts } = recordingPlanner();
  await planAiPage('Build a landing page for my café', {
    runId: 'plan-host',
    clock: fixedClock(5),
    kernel: kernel(),
    provider,
    skillRegistry: createCraftkitAiSkillRegistry([BRAND_VOICE]),
    target: 'new-page',
    ...(hostSkillIds === undefined ? {} : { hostSkillIds }),
  });
  return (contexts[0]?.skills ?? []).map(({ id }) => id);
}

describe('withHostSkills', () => {
  it('offers the host skills first, without duplicates or a required id', () => {
    expect(
      withHostSkills({ hostSkillIds: ['user.a', 'x.b'] }, ['x.b', 'x.c'], ['user.req']),
    ).toEqual(['user.a', 'x.b', 'x.c']);
    expect(withHostSkills({ hostSkillIds: ['x.req', 'user.a'] }, ['x.c'], ['x.req'])).toEqual([
      'user.a',
      'x.c',
    ]);
  });

  it('leaves the optional list as it is without host skills', () => {
    const optional = ['x.c'];
    expect(withHostSkills({}, optional)).toBe(optional);
    expect(withHostSkills({ hostSkillIds: [] }, optional)).toBe(optional);
  });
});

describe('stepSkills', () => {
  it('passes the registry and the host ids only when they are set', () => {
    const registry = createCraftkitAiSkillRegistry();
    expect(stepSkills({})).toEqual({});
    expect(stepSkills({ skillRegistry: registry })).toEqual({ skillRegistry: registry });
    expect(stepSkills({ hostSkillIds: ['user.a'] })).toEqual({ hostSkillIds: ['user.a'] });
  });
});

describe('a page plan and the person’s skills', () => {
  it('does not match a host skill on the request’s words by itself', async () => {
    expect(await planSkills()).not.toContain('user.skill-1');
  });

  it('carries a host skill the host named for this request', async () => {
    const skills = await planSkills(['user.skill-1']);
    expect(skills).toContain('user.skill-1');
    // The plan's own named skills still ride along.
    expect(skills).toContain('craftkit.copywriting');
  });
});
