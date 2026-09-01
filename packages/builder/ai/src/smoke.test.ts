import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { defineBlockSchema, type TrustedExtensionManifest } from '@craftkit/builder-schema';
import { z } from 'zod';

import {
  AI_SKILL_MAX_MANIFEST_METADATA_BYTES,
  AI_SKILL_MAX_METADATA_ENTRY_BYTES,
  applyAiPlan,
  createLocalAiPlanProvider,
  generateAiPlan,
} from './index';

/*
  A tiny vocabulary of its own. Layer 2 may not depend on a layer-4 extension —
  the boundary validator enforces it — so the smoke test brings the blocks it
  needs rather than reaching up a layer for them.
*/
const pricing = defineBlockSchema({
  type: 'pricing',
  description: 'A pricing section listing plans side by side.',
  props: z.object({ heading: z.string().max(80).default('Pricing') }),
  examples: [{ prompt: 'add a pricing section', node: { type: 'pricing', props: {} } }],
});
const hero = defineBlockSchema({
  type: 'hero',
  description: 'An opening section with a large heading.',
  props: z.object({ heading: z.string().max(80).default('Your headline') }),
  examples: [{ prompt: 'add a hero', node: { type: 'hero', props: {} } }],
});
const page = defineBlockSchema({
  type: 'page',
  description: 'The page root.',
  props: z.object({}),
  slots: { default: { allow: ['hero', 'pricing'] } },
  examples: [],
});
const Null = () => null;
const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'smoke.vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: page, render: Null },
      { schema: hero, render: Null },
      { schema: pricing, render: Null },
    ],
  },
};

/**
 * The coordinator's smoke test: does the thing actually generate blocks?
 *
 * Written because the package shipped with no tests at all, and the claim it
 * makes — an assistant that builds a page through the validated door — is the
 * one the product is about to be judged on.
 */
describe('generating blocks from a request', () => {
  const build = () =>
    createBuilder({
      document: {
        schemaVersion: 1,
        surface: 'site',
        dir: 'ltr',
        rootId: 'root',
        nodes: { root: { id: 'root', type: 'page', props: {}, slots: { default: [] } } },
      },
      extensions: [vocabulary],
      ports: { clock: fixedClock(0), ids: seededIds('ai') },
    });

  it('turns a request into blocks the kernel accepts, stamped as the assistant', async () => {
    const kernel = build();
    const before = kernel.getDocument().nodes['root']?.slots?.['default']?.length ?? 0;

    const plan = await generateAiPlan({
      kernel,
      provider: createLocalAiPlanProvider(),
      request: 'add a pricing section',
      validationPorts: { clock: fixedClock(0), ids: seededIds('validate') },
    });
    expect(plan.commands.length).toBeGreaterThan(0);

    applyAiPlan({
      kernel,
      plan,
      validationPorts: { clock: fixedClock(0), ids: seededIds('apply-validate') },
    });

    const after = kernel.getDocument().nodes['root']?.slots?.['default']?.length ?? 0;
    expect(after).toBeGreaterThan(before);
    // Every transaction it produced is the assistant's, which is what makes an
    // AI edit undoable and attributable rather than a mystery.
    expect(kernel.transactions().every((tx) => tx.author === 'ai')).toBe(true);
  });

  it('undo restores the document exactly', async () => {
    const kernel = build();
    const original = structuredClone(kernel.getDocument());

    const plan = await generateAiPlan({
      kernel,
      provider: createLocalAiPlanProvider(),
      request: 'add a hero',
      validationPorts: { clock: fixedClock(0), ids: seededIds('validate') },
    });
    applyAiPlan({
      kernel,
      plan,
      validationPorts: { clock: fixedClock(0), ids: seededIds('apply-validate') },
    });
    expect(kernel.getDocument()).not.toEqual(original);

    while (kernel.canUndo()) {
      kernel.undo();
    }
    expect(kernel.getDocument()).toEqual(original);
  });
});

describe('public package surface', () => {
  it('exports the authoritative Skill metadata bounds from the root entrypoint', () => {
    expect(AI_SKILL_MAX_METADATA_ENTRY_BYTES).toBe(4 * 1024);
    expect(AI_SKILL_MAX_MANIFEST_METADATA_BYTES).toBe(64 * 1024);
  });
});
