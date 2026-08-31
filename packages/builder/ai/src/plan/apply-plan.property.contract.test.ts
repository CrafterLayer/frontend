import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { AiPlan } from '../types';
import { applyAiPlan } from './apply-plan';
import { AiPlanRejectedError } from './validate-plan';

const RUNS = 1_000;
const SEED = 0x0a11d00d;
const TIMEOUT = 120_000;

const NullRender: BlockRenderComponent = () => null;

const page = defineBlockSchema({
  type: 'application-page',
  description: 'A root page for command-application properties.',
  props: z.object({}),
  slots: {
    default: {
      allow: ['application-ghost', 'application-hero', 'application-text'],
      max: 12,
    },
  },
  examples: [],
});

const hero = defineBlockSchema({
  type: 'application-hero',
  description: 'A hero section with a heading.',
  props: z.object({ heading: z.string().min(1).max(80).default('Application hero') }),
  examples: [],
});

const text = defineBlockSchema({
  type: 'application-text',
  description: 'A text block with one content field.',
  props: z.object({ content: z.string().min(1).max(160).default('Application copy') }),
  examples: [],
});

const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'builder-ai-application-contract-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: page, render: NullRender },
      { schema: hero, render: NullRender },
      { schema: text, render: NullRender },
    ],
  },
};

const childTypes = fc.constantFrom<'application-hero' | 'application-text'>(
  'application-hero',
  'application-text',
);

const documentArbitrary = fc
  .record({
    dir: fc.constantFrom<'ltr' | 'rtl'>('ltr', 'rtl'),
    children: fc.array(childTypes, { minLength: 0, maxLength: 6 }),
  })
  .map(({ dir, children }): BuilderDocument => {
    const ids = children.map((type, index) => `${type}-${String(index)}`);
    const nodes: BuilderDocument['nodes'] = {
      root: {
        id: 'root',
        type: 'application-page',
        props: {},
        ...(ids.length === 0 ? {} : { slots: { default: ids } }),
      },
    };
    children.forEach((type, index) => {
      const id = ids[index];
      if (id !== undefined) {
        nodes[id] = { id, type, props: {} };
      }
    });
    return { schemaVersion: 1, surface: 'site', dir, rootId: 'root', nodes };
  });

const commandTypesArbitrary = fc.array(childTypes, { minLength: 1, maxLength: 3 });

function applicationKernel(document: BuilderDocument, seed: string) {
  return createBuilder({
    document,
    extensions: [vocabulary],
    ports: { clock: fixedClock(0), ids: seededIds(`${seed}-live`) },
  });
}

function validationPorts(seed: string) {
  return { clock: fixedClock(100), ids: seededIds(`${seed}-validation`) };
}

function planFor(types: readonly ('application-hero' | 'application-text')[]): AiPlan {
  return {
    rationale: 'Apply only commands through the kernel door.',
    commands: types.map((type, index) => ({
      command: 'insertNode',
      args:
        type === 'application-hero'
          ? { type, props: { heading: `Generated hero ${String(index + 1)}` }, parentId: 'root' }
          : { type, props: { content: `Generated copy ${String(index + 1)}` }, parentId: 'root' },
    })),
  };
}

describe('AI plan application properties', () => {
  // Mutation proof: in apply-plan.ts, replace the author argument `'ai'` in
  // `options.kernel.dispatch(step.command, step.args, 'ai')` with `'user'`; the author assertion below must fail.
  it(
    `attributes every applied transaction to AI and restores generated documents after undo (${String(RUNS)} cases, seed ${String(SEED)})`,
    () => {
      fc.assert(
        fc.property(
          documentArbitrary,
          commandTypesArbitrary,
          fc.integer({ min: 0, max: 1_000_000 }),
          (document, commandTypes, generatedSeed) => {
            const seed = `application-${String(generatedSeed)}`;
            const kernel = applicationKernel(structuredClone(document), seed);
            const before = structuredClone(kernel.getDocument());
            const plan = planFor(commandTypes);

            const applied = applyAiPlan({
              kernel,
              plan,
              validationPorts: validationPorts(seed),
            });

            // The grouped door: however many commands, ONE ai-authored transaction.
            expect(applied.transactions).toHaveLength(1);
            expect(applied.transactions[0]?.author).toBe('ai');
            expect(kernel.getDocument()).not.toEqual(before);

            while (kernel.undo()) {
              // The property includes command sequences, so every historical command must reverse.
            }
            expect(kernel.getDocument()).toEqual(before);
          },
        ),
        { numRuns: RUNS, seed: SEED },
      );
    },
    TIMEOUT,
  );

  // Mutation proof: in apply-plan.ts, replace `const plan = assertValidAiPlan(...)` with
  // `const plan = options.plan`; the valid first command below leaks into the live document and the snapshot assertion must fail.
  it('never partially applies an invalid multi-command plan', () => {
    const kernel = applicationKernel(
      {
        schemaVersion: 1,
        surface: 'site',
        dir: 'ltr',
        rootId: 'root',
        nodes: { root: { id: 'root', type: 'application-page', props: {} } },
      },
      'rejection',
    );
    const beforeDocument = structuredClone(kernel.getDocument());
    const beforeTransactions = structuredClone(kernel.transactions());
    const dispatch = vi.spyOn(kernel, 'dispatch');
    const invalidPlan: AiPlan = {
      rationale: 'First command is valid; second must stop the entire proposal.',
      commands: [
        {
          command: 'insertNode',
          args: {
            type: 'application-text',
            props: { content: 'Must not leak.' },
            parentId: 'root',
          },
        },
        { command: 'insertNode', args: { type: 'application-ghost', parentId: 'root' } },
      ],
    };

    let thrown: unknown;
    try {
      applyAiPlan({ kernel, plan: invalidPlan, validationPorts: validationPorts('rejection') });
    } catch (error) {
      thrown = error;
    }

    expect(kernel.getDocument()).toEqual(beforeDocument);
    expect(kernel.transactions()).toEqual(beforeTransactions);
    expect(dispatch).not.toHaveBeenCalled();
    expect(thrown).toBeInstanceOf(AiPlanRejectedError);
  });

  it('applies a multi-command plan as ONE transaction that ONE undo fully reverses', () => {
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(10), ids: seededIds('grouped-apply') },
    });
    const before = structuredClone(kernel.getDocument());
    const plan: AiPlan = {
      rationale: 'Two inserts and a retitle, as one change.',
      commands: [
        { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'One change' } },
        { command: 'insertNode', args: { type: 'text', props: { content: 'A' }, parentId: 'sec1' } },
        { command: 'insertNode', args: { type: 'text', props: { content: 'B' }, parentId: 'sec1' } },
      ],
    };

    const applied = applyAiPlan({
      kernel,
      plan,
      validationPorts: { clock: fixedClock(20), ids: seededIds('grouped-preflight') },
    });

    expect(applied.mode).toBe('group');
    expect(applied.transactions).toHaveLength(1);
    expect(applied.transactions[0]?.author).toBe('ai');
    expect(kernel.transactions()).toHaveLength(1);

    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(before);
    expect(kernel.canUndo()).toBe(false);
  });
});
