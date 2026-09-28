import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { AiPlanProvider } from '../types';
import { generateAiPlan } from './generate-plan';

const NullRender: BlockRenderComponent = () => null;

const blocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'normalize-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({ title: z.string().default('') }),
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
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function kernel(): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          type: 'page',
          props: { title: 'Home' },
          slots: { default: ['region'] },
        },
        region: {
          id: 'region',
          type: 'customCode',
          props: { label: 'Drinks', tree: emptyCustomCodeTree() },
          slots: {},
        },
      },
    } as unknown as BuilderDocument,
    extensions: [blocks],
    ports: { clock: fixedClock(1), ids: seededIds('normalize') },
  });
}

describe('generateAiPlan with tree normalization', () => {
  it('lands a section whose only defect is a class with no CSS, without a repair round', async () => {
    const calls: string[] = [];
    const provider: AiPlanProvider = {
      propose: () => {
        calls.push('propose');
        return Promise.resolve({
          rationale: 'Fill the drinks section.',
          commands: [
            {
              command: 'setProp',
              args: {
                id: 'region',
                key: 'tree',
                value: {
                  kind: 'root',
                  children: [
                    {
                      kind: 'element',
                      tag: 'section',
                      className: 'py-24 border-emerald-900/20',
                      children: [{ kind: 'icon', name: 'not-a-lucide-icon' }],
                    },
                  ],
                },
              },
            },
          ],
        });
      },
      repair: () => {
        calls.push('repair');
        return Promise.reject(new Error('a repair round should not be needed'));
      },
    };

    const plan = await generateAiPlan({
      kernel: kernel(),
      provider,
      request: 'Fill the drinks section',
      validationPorts: { clock: fixedClock(2), ids: seededIds('normalize-validate') },
    });

    expect(calls).toEqual(['propose']);
    expect(JSON.stringify(plan)).not.toContain('border-emerald-900/20');
    expect(JSON.stringify(plan)).not.toContain('not-a-lucide-icon');
    expect(JSON.stringify(plan)).toContain('"className":"py-24"');
  });
});

describe('generateAiPlan with a tree written as markup', () => {
  it('lands the section the markup describes, with no repair round', async () => {
    const calls: string[] = [];
    const provider: AiPlanProvider = {
      propose: () => {
        calls.push('propose');
        return Promise.resolve({
          rationale: 'Fill the drinks section.',
          commands: [
            {
              command: 'setProp',
              args: {
                id: 'region',
                key: 'tree',
                value:
                  "<section class='py-16 md:py-24'><div class='mx-auto max-w-6xl px-4'><h2 class='text-4xl font-bold'>Drinks</h2><ul class='grid gap-4 md:grid-cols-3'><li class='flex gap-2'><icon name='coffee' class='size-5'/>Espresso <strong>1.75</strong></li></ul></div></section>",
              },
            },
          ],
        });
      },
      repair: () => {
        calls.push('repair');
        return Promise.reject(new Error('a repair round should not be needed'));
      },
    };

    const plan = await generateAiPlan({
      kernel: kernel(),
      provider,
      request: 'Fill the drinks section',
      validationPorts: { clock: fixedClock(2), ids: seededIds('markup-validate') },
    });

    expect(calls).toEqual(['propose']);
    const value = (plan.commands[0]?.args as { value: unknown }).value;
    expect(JSON.stringify(value)).toContain('"kind":"icon","name":"coffee"');
    expect(JSON.stringify(value)).toContain('"tag":"strong","text":"1.75"');
  });
});

describe('generateAiPlan with the vocabulary check turned off', () => {
  it('still reads a tree written as markup, because the context always asks for markup', async () => {
    const calls: string[] = [];
    const provider: AiPlanProvider = {
      propose: (_request, context) => {
        calls.push(`propose treeMarkup=${String(context.treeMarkup)}`);
        return Promise.resolve({
          rationale: 'Fill the drinks section.',
          commands: [
            {
              command: 'setProp',
              args: {
                id: 'region',
                key: 'tree',
                value: "<section class='py-16'><h2 class='text-4xl'>Drinks</h2></section>",
              },
            },
          ],
        });
      },
      repair: () => {
        calls.push('repair');
        return Promise.reject(new Error('a repair round should not be needed'));
      },
    };

    const plan = await generateAiPlan({
      kernel: kernel(),
      provider,
      request: 'Fill the drinks section',
      validationPorts: { clock: fixedClock(2), ids: seededIds('markup-no-vocabulary') },
      composition: { enforceUtilityVocabulary: false },
    });

    expect(calls).toEqual(['propose treeMarkup=true']);
    expect((plan.commands[0]?.args as { value: unknown }).value).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'py-16',
          children: [{ kind: 'element', tag: 'h2', className: 'text-4xl', text: 'Drinks' }],
        },
      ],
    });
  });
});
