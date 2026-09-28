import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import * as root from '../../index';
import { createRemoteAiPlanProvider } from '../../provider/remote-provider';
import type { AiPlanWireRequest } from '../../provider/wire';
import { createScriptedAiPlanProvider } from '../../testing/scripted-provider';
import type { PagePlanCandidate } from '../../types';
import { planAiPage as realPlanAiPage } from '../plan-page';
import type { AiPagePlanEvent } from '../types';

/*
  Plan mode's public entry point. Until 2026-09-28 the package root exported
  a stub that rejected 'not implemented: planAiPage' while the real run sat in
  agent/plan-page.ts (engine wave-2 verifier, repro v6-root.mjs). These tests
  go through the ROOT, as a host does.
*/

const NullRender: BlockRenderComponent = () => null;

function kernel(): BuilderKernel {
  const manifest: TrustedExtensionManifest = {
    tier: 1,
    name: 'plan-ai-page-fixture',
    version: '0.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'The page root.',
            props: z.object({
              title: z.string().max(120).default(''),
              description: z.string().max(200).default(''),
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
              label: z.string().max(80).default('Custom section'),
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
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: { root: { id: 'root', type: 'page', props: {}, slots: { default: [] } } },
    },
    extensions: [manifest],
    ports: { clock: { now: () => 1 }, ids: seededIds('plan-ai-page') },
  });
}

/** The wire's documented page plan — the one its validator is tested to accept. */
function documentedPlan(): { readonly rationale: string; readonly pagePlan: PagePlanCandidate } {
  const source = readFileSync(new URL('../../provider/wire.ts', import.meta.url), 'utf8');
  const start = source.indexOf('BEGIN PAGE PLAN WIRE EXAMPLE');
  const end = source.indexOf('END PAGE PLAN WIRE EXAMPLE');
  const body = source
    .slice(source.indexOf('\n', start) + 1, source.lastIndexOf('\n', end))
    .split('\n')
    .map((line) => line.replace(/^\s*\*( |$)/u, ''))
    .join('\n');
  return JSON.parse(body) as { rationale: string; pagePlan: PagePlanCandidate };
}

const REQUEST = 'Build a landing page for my specialty coffee roastery in Amman';

describe('planAiPage from the package root — Plan mode', () => {
  it('is the real implementation, not a stub', () => {
    expect(root.planAiPage).toBe(realPlanAiPage);
  });

  it('plans with a scripted provider: one call, a validated plan, nothing written', async () => {
    const { rationale, pagePlan } = documentedPlan();
    const live = kernel();
    const events: AiPagePlanEvent[] = [];

    const result = await root.planAiPage(REQUEST, {
      runId: 'plan-mode',
      clock: { now: () => 1 },
      kernel: live,
      provider: createScriptedAiPlanProvider(
        { rationale: 'unused', commands: [] },
        { pagePlan, rationale },
      ),
      onEvent: (event) => events.push(event),
    });

    if (!('plan' in result)) throw new Error(result.error.message);
    expect(result.attempts).toBe(1);
    expect(result.rationale).toBe(rationale);
    expect(result.plan.title).toBe('Cardamom Roasters — specialty coffee in Amman');
    // An empty page is replaced, whatever the model said (the build's own rule).
    expect(result.plan.intent).toBe('replace');
    expect(events.map(({ type }) => type)).toEqual(['page-plan.started', 'page-plan.ready']);
    expect(live.transactions()).toHaveLength(0);
  });

  it('plans through the REMOTE provider — the page-plan task on the wire, the plan back', async () => {
    const { rationale, pagePlan } = documentedPlan();
    const bodies: AiPlanWireRequest[] = [];
    const provider = createRemoteAiPlanProvider({
      endpoint: 'https://assistant.example.test/plan',
      fetch: (_input, init) => {
        if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body.');
        bodies.push(JSON.parse(init.body) as AiPlanWireRequest);
        return Promise.resolve(
          new Response(JSON.stringify({ version: 1, rationale, pagePlan }), {
            headers: { 'content-type': 'application/json' },
          }),
        );
      },
    });

    const result = await root.planAiPage(REQUEST, {
      runId: 'plan-mode-remote',
      clock: { now: () => 1 },
      kernel: kernel(),
      provider,
    });

    expect('plan' in result).toBe(true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.task).toBe('page-plan');
    expect(bodies[0]?.request).toContain(REQUEST);
  });

  it('reports a server that predates page plans as the step’s failure, never as a plan', async () => {
    const events: AiPagePlanEvent[] = [];
    const provider = createRemoteAiPlanProvider({
      endpoint: 'https://assistant.example.test/plan',
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ rationale: 'Added a hero.', commands: [] }), {
            headers: { 'content-type': 'application/json' },
          }),
        ),
    });

    const result = await root.planAiPage(REQUEST, {
      runId: 'plan-mode-old-server',
      clock: { now: () => 1 },
      kernel: kernel(),
      provider,
      onEvent: (event) => events.push(event),
    });

    expect(result).toMatchObject({
      error: {
        source: 'provider',
        code: 'invalid-output',
        retryable: false,
        message: expect.stringMatching(/does not support page plans/u) as unknown,
      },
    });
    expect(events.at(-1)?.type).toBe('page-plan.failed');
  });

  it('says "unsupported" for a provider with no proposePagePlan at all', async () => {
    const result = await root.planAiPage(REQUEST, {
      runId: 'plan-mode-no-t1',
      clock: { now: () => 1 },
      kernel: kernel(),
      provider: createScriptedAiPlanProvider({ rationale: 'unused', commands: [] }),
    });

    expect(result).toMatchObject({ error: { code: 'unsupported' } });
  });
});
