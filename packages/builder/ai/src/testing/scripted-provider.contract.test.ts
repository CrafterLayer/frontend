import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createLocalAiPlanProvider } from '../provider';
import { applyAiPlan, generateAiPlan } from '../plan';
import { AiPlanRejectedError } from '../plan/validate-plan';
import type { AiPlan, AiPlanProvider } from '../types';
import { createScriptedAiPlanProvider } from './scripted-provider';

const NullRender: BlockRenderComponent = () => null;

const page = defineBlockSchema({
  type: 'scripted-page',
  description: 'A page root that accepts assistant-created heroes.',
  props: z.object({}),
  slots: { default: { allow: ['scripted-ghost', 'scripted-hero'], max: 4 } },
  examples: [],
});

const hero = defineBlockSchema({
  type: 'scripted-hero',
  description: 'A hero section with one heading.',
  props: z.object({ heading: z.string().min(1).max(80).default('Scripted hero') }),
  examples: [
    {
      prompt: 'add a hero',
      node: { type: 'scripted-hero', props: { heading: 'Scripted hero' } },
    },
  ],
});

const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'builder-ai-scripted-provider-contract-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: page, render: NullRender },
      { schema: hero, render: NullRender },
    ],
  },
};

function documentFixture(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'scripted-page', props: {} } },
  };
}

function providerKernel(seed: string) {
  return createBuilder({
    document: documentFixture(),
    extensions: [vocabulary],
    ports: { clock: fixedClock(0), ids: seededIds(`${seed}-live`) },
  });
}

function validationPorts(seed: string) {
  return { clock: fixedClock(100), ids: seededIds(`${seed}-validation`) };
}

const validScript: AiPlan = {
  rationale: 'A network adapter supplied this deterministic test plan.',
  commands: [
    {
      command: 'insertNode',
      args: {
        type: 'scripted-hero',
        props: { heading: 'Proposed, then validated' },
        parentId: 'root',
      },
    },
  ],
};

describe('scripted provider contract parity', () => {
  // Mutation proof: after `await options.provider.propose(...)` in generate-plan.ts, add
  // `options.kernel.dispatch('setDocMeta', { dir: 'rtl' })`; the pre-application document snapshot assertion below must fail.
  it('keeps local and scripted providers inside the same plan-only, validated, attributed, undoable pipeline', async () => {
    const providers: readonly {
      name: string;
      provider: AiPlanProvider;
      request: string;
      expected?: AiPlan;
    }[] = [
      { name: 'local', provider: createLocalAiPlanProvider(), request: 'add a hero' },
      {
        name: 'scripted',
        provider: createScriptedAiPlanProvider(validScript),
        request: 'a future network provider receives arbitrary request text',
        expected: validScript,
      },
    ];

    for (const candidate of providers) {
      const kernel = providerKernel(candidate.name);
      const beforeDocument = structuredClone(kernel.getDocument());
      const beforeTransactions = structuredClone(kernel.transactions());

      const plan = await generateAiPlan({
        kernel,
        provider: candidate.provider,
        request: candidate.request,
        validationPorts: validationPorts(candidate.name),
      });

      expect(kernel.getDocument()).toEqual(beforeDocument);
      expect(kernel.transactions()).toEqual(beforeTransactions);
      if (candidate.expected !== undefined) {
        expect(plan).toEqual(candidate.expected);
      }

      const applied = applyAiPlan({
        kernel,
        plan,
        validationPorts: validationPorts(`${candidate.name}-apply`),
      });
      expect(applied.transactions).not.toHaveLength(0);
      expect(applied.transactions.every((transaction) => transaction.author === 'ai')).toBe(true);

      while (kernel.undo()) {
        // Both provider adapters can only propose; the shared command history owns reversal.
      }
      expect(kernel.getDocument()).toEqual(beforeDocument);
    }
  });

  // Mutation proof: in generate-plan.ts, replace `return assertValidAiPlan(candidate, options.kernel, options.validationPorts)`
  // with `return candidate`; this invalid scripted proposal would escape and the rejection assertion below must fail.
  it('rejects a scripted invalid multi-command proposal before any live application can begin', async () => {
    const kernel = providerKernel('invalid-script');
    const beforeDocument = structuredClone(kernel.getDocument());
    const beforeTransactions = structuredClone(kernel.transactions());
    const invalidScript: AiPlan = {
      rationale: 'The first command is valid, but a future provider must not partially apply it.',
      commands: [
        {
          command: 'insertNode',
          args: { type: 'scripted-hero', props: { heading: 'Do not apply yet' }, parentId: 'root' },
        },
        { command: 'insertNode', args: { type: 'scripted-ghost', parentId: 'root' } },
      ],
    };

    let thrown: unknown;
    try {
      await generateAiPlan({
        kernel,
        provider: createScriptedAiPlanProvider(invalidScript),
        request: 'try to bypass preflight',
        validationPorts: validationPorts('invalid-script'),
      });
    } catch (error) {
      thrown = error;
    }

    expect(kernel.getDocument()).toEqual(beforeDocument);
    expect(kernel.transactions()).toEqual(beforeTransactions);
    expect(kernel.canUndo()).toBe(false);
    expect(thrown).toBeInstanceOf(AiPlanRejectedError);
  });
});
