import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '@craftkit/builder-core/testing';
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
describe('catalog mode: none', () => {
  it('sends the escape hatch and nothing else', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'none' },
    });

    expect(context.blocks.map((block) => block.type)).toEqual(['customCode']);
    expect(context.blocks[0]?.propsSchema).toBeDefined();
  });

  it('states not even the NAME of a block the person did not add', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'none' },
    });

    // The difference from `index`: absent, rather than present-but-thin.
    expect(context.blocks.some((block) => block.type === 'hero')).toBe(false);
  });

  it('brings a block the person added, in full, and still nothing else', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'none', scopedBlockTypes: ['hero'] },
    });

    expect(context.blocks.map((block) => block.type)).toEqual(['customCode', 'hero']);
    expect(context.blocks.find((block) => block.type === 'hero')?.propsSchema).toBeDefined();
    expect(context.blocks.find((block) => block.type === 'hero')?.examples).toBeDefined();
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

    expect(seen?.blocks.map((block) => block.type)).toEqual(['customCode', 'hero']);
  });

  it('is the cheapest mode by construction', () => {
    const size = (mode: 'none' | 'index' | 'full') =>
      JSON.stringify(
        assembleAiContext(kernel().context, { composition: { catalogMode: mode } }).blocks,
      ).length;

    expect(size('none')).toBeLessThan(size('index'));
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
