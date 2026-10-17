import fc from 'fast-check';
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

import { generateAiPlan } from '../plan/generate-plan';
import { createLocalAiPlanProvider } from './local-provider';

const RUNS = 1_000;
const SEED = 0x0a11c0de;
const TIMEOUT = 120_000;

const NullRender: BlockRenderComponent = () => null;

const page = defineBlockSchema({
  type: 'determinism-page',
  description: 'A root page that accepts heroes and pricing sections.',
  props: z.object({}),
  slots: { default: { allow: ['determinism-hero', 'determinism-pricing'], max: 12 } },
  examples: [],
});

const hero = defineBlockSchema({
  type: 'determinism-hero',
  description: 'An opening hero section with one concise headline.',
  props: z.object({ heading: z.string().min(1).max(80).default('Build confidently') }),
  examples: [
    {
      prompt: 'add a hero section',
      node: { type: 'determinism-hero', props: { heading: 'Build confidently' } },
    },
  ],
});

const pricing = defineBlockSchema({
  type: 'determinism-pricing',
  description: 'A pricing section with a named collection of plans.',
  props: z.object({
    plans: z
      .array(z.object({ name: z.string().min(1) }))
      .max(4)
      .default([]),
    columns: z.enum(['auto', '2', '3', '4']).default('auto'),
  }),
  examples: [
    {
      prompt: 'add a pricing section with plans',
      node: {
        type: 'determinism-pricing',
        props: { plans: [{ name: 'Starter' }], columns: 'auto' },
      },
    },
  ],
});

const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'builder-ai-determinism-contract-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: page, render: NullRender },
      { schema: hero, render: NullRender },
      { schema: pricing, render: NullRender },
    ],
  },
};

const requestArbitrary = fc.oneof(
  fc.constantFrom('add a hero', 'insert a hero section'),
  fc
    .integer({ min: 1, max: 4 })
    .map((count) => `add a pricing section with ${String(count)} plans`),
);

const documentArbitrary = fc
  .record({
    dir: fc.constantFrom<'ltr' | 'rtl'>('ltr', 'rtl'),
    children: fc.array(
      fc.constantFrom<'determinism-hero' | 'determinism-pricing'>(
        'determinism-hero',
        'determinism-pricing',
      ),
      { minLength: 0, maxLength: 6 },
    ),
  })
  .map(({ dir, children }): BuilderDocument => {
    const nodes: BuilderDocument['nodes'] = {
      root: {
        id: 'root',
        type: 'determinism-page',
        props: {},
        ...(children.length === 0
          ? {}
          : { slots: { default: children.map((type, index) => `${type}-${String(index)}`) } }),
      },
    };

    children.forEach((type, index) => {
      const id = `${type}-${String(index)}`;
      nodes[id] = { id, type, props: {} };
    });

    return { schemaVersion: 1, surface: 'site', dir, rootId: 'root', nodes };
  });

function propertyKernel(document: BuilderDocument, seed: string) {
  return createBuilder({
    document,
    extensions: [vocabulary],
    ports: { clock: fixedClock(0), ids: seededIds(seed) },
  });
}

function validationPorts(seed: string) {
  return { clock: fixedClock(100), ids: seededIds(seed) };
}

describe('local AI provider determinism', () => {
  // Mutation proof: add `let proposalCount = 0;` at module scope in local-provider.ts and append
  // `:${String(++proposalCount)}` to the `proposeLocally` rationale; the byte-for-byte equality below must fail.
  it(
    `returns byte-identical command plans for generated requests, documents, and equal seeds (${String(RUNS)} cases, seed ${String(SEED)})`,
    async () => {
      await fc.assert(
        fc.asyncProperty(
          documentArbitrary,
          requestArbitrary,
          fc.integer({ min: 0, max: 1_000_000 }),
          async (document, request, generatedSeed) => {
            const seed = `law-d-${String(generatedSeed)}`;
            const provider = createLocalAiPlanProvider();
            const left = await generateAiPlan({
              kernel: propertyKernel(structuredClone(document), seed),
              provider,
              request,
              validationPorts: validationPorts(`${seed}-validation`),
            });
            const right = await generateAiPlan({
              kernel: propertyKernel(structuredClone(document), seed),
              provider,
              request,
              validationPorts: validationPorts(`${seed}-validation`),
            });

            expect(JSON.stringify(right)).toBe(JSON.stringify(left));
          },
        ),
        { numRuns: RUNS, seed: SEED },
      );
    },
    TIMEOUT,
  );
});
