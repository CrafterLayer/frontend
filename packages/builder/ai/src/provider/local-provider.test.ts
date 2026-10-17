import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, insertedNodeId } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type DeclarativeExtensionManifest,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { assembleAiContext } from '../context';
import { applyAiPlan } from '../plan/apply-plan';
import { generateAiPlan } from '../plan/generate-plan';
import { resolveAiCommandPolicy } from '../skills';
import type { AssembledAiContext } from '../types';
import {
  LOCAL_AI_MAX_COLLECTION_ITEMS,
  createLocalAiPlanProvider,
  LocalAiProviderError,
} from './local-provider';

const NullRender: BlockRenderComponent = () => null;

const pricingSchema = defineBlockSchema({
  type: 'pricing',
  description:
    'Pricing plans side by side: each plan has a name, price, billing period, and feature list.',
  props: z.object({
    heading: z.string().min(1).max(80).default('Pricing'),
    plans: z
      .array(
        z.object({
          name: z.string().min(1).max(40),
          price: z.string().min(1).max(20),
          period: z.enum(['month', 'year']),
          features: z.array(z.string().min(1).max(80)).max(8),
          highlighted: z.boolean().optional(),
        }),
      )
      .max(4)
      .default([]),
    columns: z.enum(['auto', '2', '3', '4']).default('auto'),
  }),
  examples: [
    {
      prompt: 'simple two-plan yearly pricing',
      node: {
        type: 'pricing',
        props: {
          heading: 'Simple pricing',
          columns: '2',
          plans: [
            { name: 'Solo', price: '$90', period: 'year', features: ['1 seat'] },
            {
              name: 'Team',
              price: '$290',
              period: 'year',
              features: ['10 seats'],
              highlighted: true,
            },
          ],
        },
      },
    },
  ],
});

const featureSchema = defineBlockSchema({
  type: 'features',
  description: 'A grid of feature cards with a title and body.',
  props: z.object({
    items: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
    columns: z.enum(['1', '2', '3', '4']).default('3'),
  }),
  examples: [
    {
      prompt: 'two product features',
      node: {
        type: 'features',
        props: { items: [{ title: 'Fast', body: 'Ships quickly.' }], columns: '1' },
      },
    },
  ],
});

const pageSchema = defineBlockSchema({
  type: 'page',
  description: 'The root page that accepts marketing sections.',
  props: z.object({}),
  slots: { default: { allow: ['pricing', 'features'], max: 8 } },
  examples: [],
});

const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'ai-local-provider-vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: pageSchema, render: NullRender },
      { schema: pricingSchema, render: NullRender },
      { schema: featureSchema, render: NullRender },
    ],
  },
};

const starterTemplate: DeclarativeExtensionManifest = {
  tier: 2,
  name: 'ai-local-provider-templates',
  version: '0.0.0',
  contributes: {
    compositions: [
      {
        id: 'starter-page',
        name: 'Starter landing page',
        version: 1,
        surfaces: ['site'],
        rootId: 'starter-features',
        nodes: {
          'starter-features': {
            id: 'starter-features',
            type: 'features',
            props: {
              items: [{ title: 'Built to convert', body: 'A complete starting point.' }],
              columns: '1',
            },
          },
        },
      },
    ],
  },
};

function pricingKernel() {
  const kernel = createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: { root: { id: 'root', type: 'page', props: {} } },
    },
    extensions: [vocabulary],
    ports: { clock: fixedClock(1_000), ids: seededIds('pricing') },
  });
  kernel.extensions.hydrateDeclarative(starterTemplate);
  return kernel;
}

function validationPorts(seed: string) {
  return { clock: fixedClock(2_000), ids: seededIds(seed) };
}

function boundedCollectionContext(): AssembledAiContext {
  return {
    fragments: [],
    totalTokens: 0,
    blocks: [
      {
        type: 'page',
        description: 'A page.',
        propsSchema: { type: 'object' },
        examples: [],
        slots: [{ name: 'default', allow: ['features'] }],
      },
      {
        type: 'features',
        description: 'A grid of feature items.',
        propsSchema: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object' } },
            columns: { type: 'string', enum: ['1', '2', '3', '4'] },
          },
        },
        examples: [
          {
            prompt: 'one feature item',
            node: {
              type: 'features',
              props: { items: [{ title: 'Fast', body: 'Ships quickly.' }], columns: '1' },
            },
          },
        ],
        slots: [],
      },
    ],
    templates: [],
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: [{ id: 'root', type: 'page', props: {}, slots: { default: [] } }],
    },
    selection: { ids: [] },
  };
}

describe('local deterministic AI provider', () => {
  it('selects and inserts a registered landing-page template as one undoable command', async () => {
    const kernel = pricingKernel();
    const context = assembleAiContext(kernel.context);

    expect(context.templates).toEqual([
      {
        id: 'starter-page',
        name: 'Starter landing page',
        rootType: 'features',
        nodeCount: 1,
        blockTypes: ['features'],
      },
    ]);

    const plan = await generateAiPlan({
      kernel,
      provider: createLocalAiPlanProvider(),
      request: 'build a complete landing page from the starter template',
      validationPorts: validationPorts('template-plan'),
    });

    expect(plan.commands).toEqual([
      {
        command: 'insertComposition',
        args: { compositionId: 'starter-page', parentId: 'root', slot: 'default' },
      },
    ]);

    const applied = applyAiPlan({
      kernel,
      plan,
      validationPorts: validationPorts('template-apply'),
      policy: resolveAiCommandPolicy({
        registeredCommands: kernel.context.registry.commandNames(),
      }),
    });
    expect(applied.transactions).toHaveLength(1);
    expect(Object.values(kernel.getDocument().nodes).some((node) => node.type === 'features')).toBe(
      true,
    );
    expect(kernel.undo()).toBe(true);
    expect(Object.values(kernel.getDocument().nodes).some((node) => node.type === 'features')).toBe(
      false,
    );
  });

  it('isolates nested provider context from the live document and registered examples', () => {
    const kernel = pricingKernel();
    const transaction = kernel.dispatch('insertNode', {
      type: 'pricing',
      parentId: 'root',
      props: {
        heading: 'Safe pricing',
        columns: '2',
        plans: [
          { name: 'Solo', price: '$9', period: 'month', features: ['One seat'] },
          { name: 'Team', price: '$29', period: 'month', features: ['Ten seats'] },
        ],
      },
    });
    const nodeId = insertedNodeId(transaction.patches);
    expect(nodeId).toBeDefined();
    kernel.setSelection(nodeId === undefined ? [] : [nodeId]);

    const context = assembleAiContext(kernel.context);
    const selectedPlans = context.document.nodes.find(({ id }) => id === nodeId)?.props['plans'];
    const selectedFirst = Array.isArray(selectedPlans) ? selectedPlans[0] : undefined;
    if (
      typeof selectedFirst === 'object' &&
      selectedFirst !== null &&
      !Array.isArray(selectedFirst)
    ) {
      selectedFirst['name'] = 'Mutated outside dispatch';
    }
    const example = context.blocks.find(({ type }) => type === 'pricing')?.examples?.[0]?.node;
    if (typeof example === 'object' && example !== null && !Array.isArray(example)) {
      const props = example['props'];
      if (typeof props === 'object' && props !== null && !Array.isArray(props)) {
        const plans = props['plans'];
        const first = Array.isArray(plans) ? plans[0] : undefined;
        if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
          first['name'] = 'Mutated example';
        }
      }
    }

    const livePlans =
      nodeId === undefined ? undefined : kernel.getDocument().nodes[nodeId]?.props['plans'];
    const liveFirst = Array.isArray(livePlans) ? livePlans[0] : undefined;
    expect(liveFirst).toMatchObject({ name: 'Solo' });
    expect(pricingSchema.examples[0]?.node).toMatchObject({
      props: { plans: [{ name: 'Solo' }, { name: 'Team' }] },
    });
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('turns "add a pricing section with three plans" into a real valid block plan', async () => {
    const kernel = pricingKernel();
    const plan = await generateAiPlan({
      kernel,
      provider: createLocalAiPlanProvider(),
      request: 'add a pricing section with three plans',
      validationPorts: validationPorts('generate-pricing'),
    });

    expect(plan).toMatchObject({
      commands: [
        {
          command: 'insertNode',
          args: {
            type: 'pricing',
            parentId: 'root',
            slot: 'default',
            props: { columns: '3' },
          },
        },
      ],
    });
    const step = plan.commands[0];
    const args =
      step !== undefined && typeof step.args === 'object' && step.args !== null
        ? (step.args as Record<string, unknown>)
        : {};
    const props = args['props'] as Record<string, unknown> | undefined;
    expect(props?.['plans']).toHaveLength(3);

    const applied = applyAiPlan({
      kernel,
      plan,
      validationPorts: validationPorts('apply-pricing'),
      policy: resolveAiCommandPolicy({
        registeredCommands: kernel.context.registry.commandNames(),
      }),
    });
    expect(applied).toMatchObject({ mode: 'group' });
    expect(applied.transactions).toHaveLength(1);
    const nodeId = insertedNodeId(applied.transactions[0]?.patches ?? []);
    expect(nodeId).toBeDefined();
    expect(kernel.getDocument().nodes[nodeId ?? '']).toMatchObject({
      type: 'pricing',
      props: { columns: '3', plans: expect.any(Array) as unknown },
    });
    expect(kernel.getDocument().nodes[nodeId ?? '']?.props['plans']).toHaveLength(3);
  });

  it('uses the current selection when it exposes a compatible slot', async () => {
    const kernel = pricingKernel();
    kernel.dispatch('insertNode', { type: 'features', parentId: 'root' });
    kernel.setSelection(['root']);
    const plan = await generateAiPlan({
      kernel,
      provider: createLocalAiPlanProvider(),
      request: 'add two feature items',
      validationPorts: validationPorts('selected-target'),
    });
    expect(plan.commands[0]).toMatchObject({
      command: 'insertNode',
      args: {
        type: 'features',
        parentId: 'root',
        slot: 'default',
        props: { columns: '2', items: expect.any(Array) as unknown },
      },
    });
    const args = plan.commands[0]?.args as Record<string, unknown>;
    const props = args['props'] as Record<string, unknown>;
    expect(props['items']).toHaveLength(2);
  });

  it('understands Arabic-Indic counts and respects the array maximum', async () => {
    const kernel = pricingKernel();
    const plan = await generateAiPlan({
      kernel,
      provider: createLocalAiPlanProvider(),
      request: 'pricing with ٩ plans',
      validationPorts: validationPorts('arabic-digits'),
    });
    const step = plan.commands[0];
    const args = step?.args as Record<string, unknown>;
    const props = args['props'] as Record<string, unknown>;
    expect(props['plans']).toHaveLength(4);
    expect(props['columns']).toBe('4');

    const singular = await generateAiPlan({
      kernel: pricingKernel(),
      provider: createLocalAiPlanProvider(),
      request: 'pricing with ٣ plan',
      validationPorts: validationPorts('singular-array-key'),
    });
    const singularArgs = singular.commands[0]?.args as Record<string, unknown>;
    const singularProps = singularArgs['props'] as Record<string, unknown>;
    expect(singularProps['plans']).toHaveLength(3);
  });

  it('uses only own number-word entries so prototype names cannot alter collection counts', async () => {
    const provider = createLocalAiPlanProvider();

    const plan = await provider.propose(
      'add constructor feature items',
      boundedCollectionContext(),
    );
    const args = plan.commands[0]?.args as Record<string, unknown>;
    const props = args['props'] as Record<string, unknown>;

    expect(props['items']).toHaveLength(1);
  });

  it.each(['add 2025 feature items', `add ${String(Number.MAX_SAFE_INTEGER)} feature items`])(
    'bounds the request-derived collection before allocation for %s',
    async (request) => {
      const provider = createLocalAiPlanProvider();

      const plan = await provider.propose(request, boundedCollectionContext());
      const args = plan.commands[0]?.args as Record<string, unknown>;
      const props = args['props'] as Record<string, unknown>;

      expect(props['items']).toHaveLength(LOCAL_AI_MAX_COLLECTION_ITEMS);
      expect(plan.rationale).toMatch(
        new RegExp(`limited.*${String(LOCAL_AI_MAX_COLLECTION_ITEMS)}`, 'i'),
      );
    },
  );

  it('refuses empty, unmatched, and structurally unplaceable requests', async () => {
    const provider = createLocalAiPlanProvider();
    const kernel = pricingKernel();
    const context = assembleAiContext(kernel.context);

    await expect(provider.propose('', context)).rejects.toThrow(LocalAiProviderError);
    await expect(provider.propose('add an orbital telescope', context)).rejects.toThrow(
      /No registered block matches/,
    );
    await expect(provider.propose('add a telescope', context)).rejects.toThrow(
      /No registered block matches/,
    );
    await expect(provider.propose('!!!', context)).rejects.toThrow(/No registered block matches/);

    const missingSelection = {
      ...context,
      selection: { ids: ['ghost'] },
    };
    await expect(provider.propose('add pricing', missingSelection)).resolves.toMatchObject({
      commands: [{ args: { parentId: 'root' } }],
    });

    const fullKernel = pricingKernel();
    for (let index = 0; index < 8; index += 1) {
      fullKernel.dispatch('insertNode', { type: 'features', parentId: 'root' });
    }
    const fullContext = assembleAiContext(fullKernel.context);
    await expect(provider.propose('add pricing', fullContext)).rejects.toThrow(/available slot/);
  });

  it('rejects caller cancellation before work and before its queued microtask runs', async () => {
    const provider = createLocalAiPlanProvider();
    const assembled = assembleAiContext(pricingKernel().context);

    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await expect(
      provider.propose('add pricing', assembled, { signal: alreadyAborted.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    const beforeMicrotask = new AbortController();
    const pending = provider.propose('add pricing', assembled, {
      signal: beforeMicrotask.signal,
    });
    beforeMicrotask.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
