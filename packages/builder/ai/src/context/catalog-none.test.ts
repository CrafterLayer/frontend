import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { assembleAiContext } from './assemble-context';
import { generateAiPlan } from '../plan/generate-plan';
import type { AiPlanProvider, AssembledAiContext } from '../types';

const NullRender: BlockRenderComponent = () => null;

/** A stand-in for the shipped escape hatch; this package must not depend on an extension. */
const customCode: TrustedExtensionManifest = {
  tier: 1,
  name: 'catalog-none-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region.',
          props: z.object({ tree: customCodeTree().default(emptyCustomCodeTree()) }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function kernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks, customCode],
    ports: { clock: fixedClock(100), ids: seededIds('none') },
  });
}

/**
 * `none`: the model is told what the person wants and handed the tools to
 * build it — not an inventory. A registered block exists to the model only
 * once the person puts it in the request.
 */
/** The block types the landing fixture actually holds. */
function typesOnThePage(): readonly string[] {
  return [...new Set(Object.values(landingFixture().nodes).map((node) => node.type))].sort();
}

describe('catalog mode: none', () => {
  it('sends the escape hatch in full, and the blocks on the page by name and prop keys only', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'none' },
    });

    const escapeHatch = context.blocks.find((block) => block.type === 'customCode');
    expect(escapeHatch?.propsSchema).toBeDefined();

    const present = context.blocks.filter((block) => block.type !== 'customCode');
    expect(present.map((block) => block.type)).toEqual(
      typesOnThePage().filter((type) => type !== 'customCode'),
    );
    for (const block of present) {
      // "Make the hero title bigger": the model must know the hero HAS a title
      // and has no size — names, never the schema.
      expect(block.propKeys).toBeDefined();
      expect(block.propKeys?.length).toBeGreaterThan(0);
      expect(block.propsSchema).toBeUndefined();
      expect(block.examples).toBeUndefined();
      expect(block.slots).toBeUndefined();
    }
  });

  it('marks what may NOT be inserted: the page root, and every schema-less entry', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'none' },
    });

    /*
      A real run died on this: the root's own type appeared in the block list
      with prop keys, the model wrote insertNode {type:'page'}, and the door
      answered "Slot default of root accepts [...], not page" after six
      minutes of work. The context now says it before the plan is written.
    */
    const root = context.blocks.find((block) => block.type === 'page');
    expect(root?.insertable).toBe(false);

    for (const block of context.blocks) {
      if (block.propsSchema === undefined) {
        // No schema travels with it, so it can only be edited, never authored.
        expect(block.insertable, block.type).toBe(false);
      }
    }
    // The escape hatch keeps its schema and stays insertable.
    const escapeHatch = context.blocks.find((block) => block.type === 'customCode');
    expect(escapeHatch?.propsSchema).toBeDefined();
    expect(escapeHatch?.insertable).toBeUndefined();
  });

  it('states not even the NAME of a block that is neither asked for nor on the page', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'none' },
    });

    const onThePage = new Set(typesOnThePage());
    const registered = kernel()
      .context.registry.blocks('page')
      .map((entry) => entry.schema.type);
    const absent = registered.filter((type) => !onThePage.has(type) && type !== 'customCode');
    expect(absent.length).toBeGreaterThan(0);
    // The difference from `index`: absent, rather than present-but-thin.
    for (const type of absent) {
      expect(context.blocks.some((block) => block.type === type)).toBe(false);
    }
  });

  it('brings a block the person added, in full, and still nothing else', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'none', scopedBlockTypes: ['hero'] },
    });

    const detailed = context.blocks.filter((block) => block.propsSchema !== undefined);
    expect(detailed.map((block) => block.type)).toEqual(['customCode', 'hero']);
    expect(context.blocks.find((block) => block.type === 'hero')?.examples).toBeDefined();
    // Every other block on the page stays a name with prop keys — no schema.
    for (const block of context.blocks.filter((entry) => entry.propsSchema === undefined)) {
      expect(block.propKeys).toBeDefined();
    }
  });

  it('derives the added blocks from the SELECTION in generate-plan', async () => {
    // Selecting a hero is how a person "adds it to the agent context".
    let seen: AssembledAiContext | undefined;
    const provider: AiPlanProvider = {
      propose: (_request, context) => {
        seen = context;
        return Promise.reject(new Error('stop here'));
      },
    };
    const k = kernel();

    await generateAiPlan({
      kernel: k,
      provider,
      request: 'make it darker',
      validationPorts: { clock: fixedClock(1), ids: seededIds('none-plan') },
      selection: ['hero1'],
      composition: { catalogMode: 'none' },
    }).catch(() => undefined);

    expect(
      seen?.blocks.filter((block) => block.propsSchema !== undefined).map((block) => block.type),
    ).toEqual(['customCode', 'hero']);
  });

  it('costs a small multiple of index and a small fraction of full', () => {
    const size = (mode: 'none' | 'index' | 'full') =>
      JSON.stringify(
        assembleAiContext(kernel().context, { composition: { catalogMode: mode } }).blocks,
      ).length;

    /*
      `none` is no longer cheaper than `index` on a page full of blocks: every
      block ON THE PAGE brings its prop keys (~75 characters each here, ~600 on
      the real registry), because a model that cannot name a block's props
      invents one. It stays a fraction of `full`, which ships schemas, examples
      and slots for every block whether the page holds it or not.
    */
    // On this six-block fixture the escape hatch's schema is most of `none`;
    // the real ratio (none < full / 5) is pinned on the wire in the playground.
    expect(size('none')).toBeLessThan(size('index') * 2);
    expect(size('none')).toBeLessThan(size('full'));
    expect(size('index')).toBeLessThan(size('full'));
  });

  it('leaves the document, commands, and contract untouched — only the catalog changes', () => {
    const none = assembleAiContext(kernel().context, { composition: { catalogMode: 'none' } });
    const full = assembleAiContext(kernel().context, { composition: { catalogMode: 'full' } });

    expect(none.document).toEqual(full.document);
    expect(none.commands).toEqual(full.commands);
    expect(none.outputContract).toEqual(full.outputContract);
  });
});
