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
import { DEFAULT_ALWAYS_DETAILED_BLOCK_TYPES } from './composition-policy';

const NullRender: BlockRenderComponent = () => null;

/** A stand-in for the shipped block: this package must not depend on an extension. */
const customCode: TrustedExtensionManifest = {
  tier: 1,
  name: 'escape-hatch-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region.',
          props: z.object({ tree: customCodeTree().default(emptyCustomCodeTree()) }),
          examples: [{ prompt: 'a hero', node: { type: 'customCode', props: {} } }],
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
    ports: { clock: fixedClock(100), ids: seededIds('escape') },
  });
}

const detailOf = (context: ReturnType<typeof assembleAiContext>, type: string) =>
  context.blocks.find((block) => block.type === type);

/**
 * The escape hatch must survive the economy that makes it necessary.
 *
 * A cheap catalog is only a good trade if the model can still BUILD. Strip
 * `customCode` of its schema and the index mode becomes strictly worse than
 * either endpoint: the model is told an escape hatch exists and given no way
 * to write one. These tests pin that it is never stripped.
 */
describe('the composition escape hatch', () => {
  it('keeps its schema and examples in index mode, where every other block loses them', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'index' },
    });

    expect(detailOf(context, 'customCode')?.propsSchema).toBeDefined();
    expect(detailOf(context, 'customCode')?.examples).toBeDefined();
    // Everything else is a name and a sentence, which is the whole point.
    expect(detailOf(context, 'hero')?.propsSchema).toBeUndefined();
  });

  it('keeps its schema in scoped mode when the selection names something else', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'scoped', scopedBlockTypes: ['hero'] },
    });

    expect(detailOf(context, 'customCode')?.propsSchema).toBeDefined();
    expect(detailOf(context, 'hero')?.propsSchema).toBeDefined();
    expect(detailOf(context, 'button')?.propsSchema).toBeUndefined();
  });

  it('still names every other block, which is what a tree references them by', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'index' },
    });

    // A `{kind:'component', component:'hero'}` node resolves through this name.
    const hero = detailOf(context, 'hero');
    expect(hero?.type).toBe('hero');
    expect(hero?.description).toBeTruthy();
  });

  it('can be opted out of by a host that wants the strict economy', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'index', alwaysDetailedBlockTypes: [] },
    });

    expect(detailOf(context, 'customCode')?.propsSchema).toBeUndefined();
  });

  it('costs one block of detail, not a share of the catalog', () => {
    /*
      The exemption is a FIXED cost, and stating it that way is what keeps it
      honest as the registry grows. Measured against a proportion instead, this
      test would pass or fail on how many blocks a fixture happens to register
      — it reads as a saving guarantee and is really a fixture headcount.

      Against the real 55-block registry the same exemption is ~2% of the
      catalog; the saving is asserted at production size in the playground's
      own cost gate (apps/playground/src/features/preview/ai-context-cost.test.ts).

      Measured 5,510 characters on 2026-09-29, up from under 4,000: the
      2026-09-28 design-code vocabulary (custom-code-tree.ts) grew to 72 tags
      (details/summary, the table parts, picture/source/video and the svg
      shape family joined) and gained the svg paint and geometry attributes.
      The tree's props schema states each once — nothing is repeated, the
      lists are longer. The production gate above still passes, so the fixed
      bound moves with the vocabulary rather than the vocabulary shrinking to
      fit an old number.
    */
    const withHatch = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'index' },
    });
    const withoutHatch = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'index', alwaysDetailedBlockTypes: [] },
    });
    const onlyHatch = assembleAiContext(kernel().context, {
      composition: { catalogMode: 'scoped', scopedBlockTypes: ['customCode'] },
    });

    const size = (value: unknown) => JSON.stringify(value).length;
    const exemptionCost = size(withHatch.blocks) - size(withoutHatch.blocks);

    expect(exemptionCost).toBe(size(onlyHatch.blocks) - size(withoutHatch.blocks));
    expect(exemptionCost).toBeLessThan(6_000);
  });

  it('names the escape hatch once, where the renderer and the extension agree on it', () => {
    // A default naming a type no pack registers is an exemption that never fires.
    expect(DEFAULT_ALWAYS_DETAILED_BLOCK_TYPES).toEqual(['customCode']);
    expect(customCode.contributes?.blocks?.[0]?.schema.type).toBe('customCode');
  });
});
