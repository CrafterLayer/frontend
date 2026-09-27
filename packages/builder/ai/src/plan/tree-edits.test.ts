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
import { expandTreeEdits } from './tree-edits';
import { parseTreeMarkup } from './tree-markup';

const NullRender: BlockRenderComponent = () => null;

const blocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'tree-edit-fixture',
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

const HERO =
  "<section class='bg-stone-900 py-24 text-stone-50'><h1 class='text-6xl font-bold'>بُن</h1><p class='text-lg'>قهوة مختصة</p><a class='rounded-full bg-amber-600 px-6 py-3' href='#menu'>اطلب الآن</a></section>";

function kernel(): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'rtl',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: ['hero'] } },
        hero: {
          id: 'hero',
          type: 'customCode',
          props: { label: 'Hero', tree: parseTreeMarkup(HERO) },
          slots: {},
        },
      },
    } as unknown as BuilderDocument,
    extensions: [blocks],
    ports: { clock: fixedClock(1), ids: seededIds('tree-edit') },
  });
}

function editPlan(args: Record<string, unknown>) {
  return {
    rationale: 'Darken the hero.',
    commands: [{ command: 'editTree', args, title: 'Hero' }],
  };
}

describe('expandTreeEdits', () => {
  it('turns a quoted change into the setProp it stands for, touching nothing else', () => {
    const result = expandTreeEdits(
      editPlan({ id: 'hero', edits: [{ find: 'bg-stone-900', replace: 'bg-black' }] }),
      kernel(),
    );

    expect(result.issues).toEqual([]);
    expect(result.plan).toEqual({
      rationale: 'Darken the hero.',
      commands: [
        {
          command: 'setProp',
          args: {
            id: 'hero',
            key: 'tree',
            value: parseTreeMarkup(HERO.replace('bg-stone-900', 'bg-black')),
          },
          title: 'Hero',
        },
      ],
    });
  });

  it('applies several edits in order and accepts a single bare find/replace', () => {
    const several = expandTreeEdits(
      editPlan({
        id: 'hero',
        edits: [
          { find: '>بُن<', replace: '>بُن — منذ ٢٠١٩<' },
          { find: 'اطلب الآن', replace: 'احجز طاولتك' },
        ],
      }),
      kernel(),
    );
    expect(JSON.stringify(several.plan)).toContain('بُن — منذ ٢٠١٩');
    expect(JSON.stringify(several.plan)).toContain('احجز طاولتك');

    const bare = expandTreeEdits(
      editPlan({ id: 'hero', find: 'text-6xl', replace: 'text-7xl' }),
      kernel(),
    );
    expect(bare.issues).toEqual([]);
    expect(JSON.stringify(bare.plan)).toContain('text-7xl');
  });

  it('says exactly why when the quoted text is not in the region once', () => {
    const missing = expandTreeEdits(
      editPlan({ id: 'hero', edits: [{ find: 'bg-red-500', replace: 'bg-black' }] }),
      kernel(),
    );
    expect(missing.issues[0]?.message).toMatch(/not in the region's markup/u);

    const twice = expandTreeEdits(
      editPlan({ id: 'hero', edits: [{ find: 'class=', replace: 'class=' }] }),
      kernel(),
    );
    expect(twice.issues[0]?.message).toMatch(/more than once/u);
  });

  it('refuses an edit to a node that does not exist or carries no tree', () => {
    expect(
      expandTreeEdits(editPlan({ id: 'nope', find: 'a', replace: 'b' }), kernel()).issues[0]
        ?.message,
    ).toMatch(/no node "nope"/u);
    expect(
      expandTreeEdits(editPlan({ id: 'root', find: 'a', replace: 'b' }), kernel()).issues[0]
        ?.message,
    ).toMatch(/no tree that can be edited/u);
  });

  it('leaves a plan with no editTree as the very same value', () => {
    const plan = {
      rationale: 'r',
      commands: [{ command: 'setProp', args: { id: 'a', key: 'k', value: 1 } }],
    };
    expect(expandTreeEdits(plan, kernel()).plan).toBe(plan);
  });
});

describe('generateAiPlan with editTree', () => {
  it('lands a quoted edit through the real door without a repair round', async () => {
    const calls: string[] = [];
    const provider: AiPlanProvider = {
      propose: () => {
        calls.push('propose');
        return Promise.resolve(
          editPlan({ id: 'hero', edits: [{ find: 'bg-stone-900', replace: 'bg-black' }] }),
        );
      },
      repair: () => {
        calls.push('repair');
        return Promise.reject(new Error('a repair round should not be needed'));
      },
    };

    const plan = await generateAiPlan({
      kernel: kernel(),
      provider,
      request: 'make the hero darker',
      validationPorts: { clock: fixedClock(2), ids: seededIds('tree-edit-validate') },
    });

    expect(calls).toEqual(['propose']);
    expect(plan.commands[0]?.command).toBe('setProp');
    expect(JSON.stringify(plan)).toContain('bg-black');
    expect(JSON.stringify(plan)).not.toContain('bg-stone-900');
  });

  it('sends an unmatched quote to the repair round with its reason', async () => {
    const seen: string[] = [];
    const provider: AiPlanProvider = {
      propose: () =>
        Promise.resolve(
          editPlan({ id: 'hero', edits: [{ find: 'bg-red-500', replace: 'bg-black' }] }),
        ),
      repair: (_request, _context, _plan, issues) => {
        seen.push(...issues.map((entry) => entry.message));
        return Promise.resolve(
          editPlan({ id: 'hero', edits: [{ find: 'bg-stone-900', replace: 'bg-black' }] }),
        );
      },
    };

    const plan = await generateAiPlan({
      kernel: kernel(),
      provider,
      request: 'make the hero darker',
      validationPorts: { clock: fixedClock(2), ids: seededIds('tree-edit-repair') },
    });

    expect(seen[0]).toMatch(/not in the region's markup/u);
    expect(JSON.stringify(plan)).toContain('bg-black');
  });
});
