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

function documentWith(tree: unknown): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: ['hero'] } },
      hero: { id: 'hero', type: 'customCode', props: { label: 'Hero', tree }, slots: {} },
    },
  } as unknown as BuilderDocument;
}

function kernelWith(markup: string): BuilderKernel {
  return createBuilder({
    document: documentWith(parseTreeMarkup(markup)),
    extensions: [blocks],
    ports: { clock: fixedClock(1), ids: seededIds('tree-edit') },
  });
}

function kernel(): BuilderKernel {
  return kernelWith(HERO);
}

/** The tree the expanded step at `index` writes. */
function treeOf(plan: unknown, index: number): unknown {
  const commands = (plan as { commands: { args: { value: unknown } }[] }).commands;
  return commands[index]?.args.value;
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

  it('refuses a find that occurs twice even when the two occurrences overlap', () => {
    const nested = kernelWith(
      "<section class='py-16'><div class='container'><div class='grid'><div class='card'><p>Hi</p></div></div></div></section>",
    );
    const result = expandTreeEdits(
      editPlan({ id: 'hero', find: '</div></div>', replace: "</div></div><a class='cta'>CTA</a>" }),
      nested,
    );

    expect(result.issues[0]?.message).toMatch(/more than once/u);
  });

  it('refuses an id that names an Object.prototype key instead of throwing', () => {
    for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const result = expandTreeEdits(editPlan({ id, find: 'a', replace: 'b' }), kernel());
      expect(result.issues[0]?.message).toMatch(new RegExp(`no node "${id}"`, 'u'));
    }
  });

  it('leaves every untouched word space in the region as it was', () => {
    const region =
      "<section><h2 class='text-3xl'>T</h2><p>Pay <strong>once</strong> and keep it. Read the <a href='/terms'>terms</a> <em>first</em>.</p><p>A<span> · </span>B</p><pre><code>npm i\nnpm run dev</code></pre><p>10&nbsp;%</p></section>";
    const result = expandTreeEdits(
      editPlan({ id: 'hero', find: 'text-3xl', replace: 'text-4xl' }),
      kernelWith(region),
    );

    expect(result.issues).toEqual([]);
    expect(treeOf(result.plan, 0)).toEqual(parseTreeMarkup(region.replace('text-3xl', 'text-4xl')));
  });

  it('edits a region that holds a component reference', () => {
    const withComponent = createBuilder({
      document: documentWith({
        kind: 'root',
        children: [
          {
            kind: 'element',
            tag: 'section',
            children: [
              { kind: 'element', tag: 'h2', text: 'Contact' },
              { kind: 'component', component: 'contact', props: { email: 'a@b.co' } },
            ],
          },
        ],
      }),
      extensions: [blocks],
      ports: { clock: fixedClock(1), ids: seededIds('tree-edit') },
    });
    const result = expandTreeEdits(
      editPlan({ id: 'hero', find: '>Contact<', replace: '>Write to us<' }),
      withComponent,
    );

    expect(result.issues).toEqual([]);
    expect(treeOf(result.plan, 0)).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          children: [
            { kind: 'element', tag: 'h2', text: 'Write to us' },
            { kind: 'component', component: 'contact', props: { email: 'a@b.co' } },
          ],
        },
      ],
    });
  });

  it('leaves a plan with no editTree as the very same value', () => {
    const plan = {
      rationale: 'r',
      commands: [{ command: 'setProp', args: { id: 'a', key: 'k', value: 1 } }],
    };
    expect(expandTreeEdits(plan, kernel()).plan).toBe(plan);
  });
});

describe('expandTreeEdits across steps', () => {
  it('builds a second editTree on the region as the first one left it', () => {
    const result = expandTreeEdits(
      {
        rationale: 'Two changes, two steps.',
        commands: [
          {
            command: 'editTree',
            args: { id: 'hero', find: 'text-6xl', replace: 'text-7xl' },
            title: 'Bigger',
          },
          {
            command: 'editTree',
            args: { id: 'hero', find: '>اطلب الآن<', replace: '>احجز<' },
            title: 'Copy',
          },
        ],
      },
      kernel(),
    );

    expect(result.issues).toEqual([]);
    const last = JSON.stringify(treeOf(result.plan, 1));
    expect(last).toContain('text-7xl');
    expect(last).toContain('احجز');
    expect(last).not.toContain('text-6xl');
  });

  it('builds an editTree on a tree an earlier setProp wrote, as markup or as a tree', () => {
    const rewritten = "<section class='py-16'><h2 class='text-3xl'>New</h2></section>";
    for (const value of [rewritten, parseTreeMarkup(rewritten)]) {
      const result = expandTreeEdits(
        {
          rationale: 'Rewrite, then adjust.',
          commands: [
            { command: 'setProp', args: { id: 'hero', key: 'tree', value } },
            { command: 'editTree', args: { id: 'hero', find: 'text-3xl', replace: 'text-5xl' } },
          ],
        },
        kernel(),
      );

      expect(result.issues).toEqual([]);
      expect(treeOf(result.plan, 1)).toEqual(
        parseTreeMarkup(rewritten.replace('text-3xl', 'text-5xl')),
      );
    }
  });

  it('quotes against the earlier step, so a find that step removed is refused', () => {
    const result = expandTreeEdits(
      {
        rationale: 'r',
        commands: [
          { command: 'editTree', args: { id: 'hero', find: 'bg-stone-900', replace: 'bg-black' } },
          {
            command: 'editTree',
            args: { id: 'hero', find: 'bg-stone-900', replace: 'bg-zinc-900' },
          },
        ],
      },
      kernel(),
    );

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.step).toBe(1);
    expect(result.issues[0]?.message).toMatch(/not in the region's markup/u);
  });
});

describe('generateAiPlan with editTree', () => {
  it('keeps both of two editTree steps on one region through the real door', async () => {
    const provider: AiPlanProvider = {
      propose: () =>
        Promise.resolve({
          rationale: 'Two changes.',
          commands: [
            {
              command: 'editTree',
              args: { id: 'hero', find: 'text-6xl', replace: 'text-7xl' },
              title: 'Bigger title',
            },
            {
              command: 'editTree',
              args: { id: 'hero', find: 'bg-stone-900', replace: 'bg-black' },
              title: 'Darker',
            },
          ],
        }),
      repair: () => Promise.reject(new Error('a repair round should not be needed')),
    };

    const plan = await generateAiPlan({
      kernel: kernel(),
      provider,
      request: 'bigger title and darker',
      validationPorts: { clock: fixedClock(2), ids: seededIds('tree-edit-twice') },
    });

    const final = JSON.stringify(plan.commands[plan.commands.length - 1]);
    expect(final).toContain('text-7xl');
    expect(final).toContain('bg-black');
  });

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
