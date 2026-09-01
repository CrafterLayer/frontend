import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { assembleAiContext, estimateAssembledAiContextTokens } from './assemble-context';

function contextKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(100), ids: seededIds('catalog') },
  });
}

/**
 * The catalog is 94% of a real request's context (measured: 57,851 of 61,578
 * tokens on the playground's landing fixture). These tests pin the three modes
 * that make that cost a decision rather than a constant.
 */
describe('block catalog modes', () => {
  it('defaults to the full catalog so no existing caller silently loses schemas', () => {
    const kernel = contextKernel();

    const implicit = assembleAiContext(kernel.context);
    const explicit = assembleAiContext(kernel.context, { composition: { catalogMode: 'full' } });

    expect(implicit.blocks).toEqual(explicit.blocks);
    for (const block of implicit.blocks) {
      expect(block.propsSchema).toBeDefined();
      expect(block.examples).toBeDefined();
      expect(block.slots).toBeDefined();
    }
  });

  it('index mode keeps every type but drops the per-block detail that dominates cost', () => {
    const kernel = contextKernel();

    const full = assembleAiContext(kernel.context, { composition: { catalogMode: 'full' } });
    const index = assembleAiContext(kernel.context, { composition: { catalogMode: 'index' } });

    // The vocabulary is intact: the model still knows what exists and may ask for it.
    expect(index.blocks.map((block) => block.type)).toEqual(full.blocks.map((block) => block.type));
    for (const block of index.blocks) {
      expect(block.description).toBe(
        full.blocks.find((candidate) => candidate.type === block.type)?.description,
      );
      expect(block.propsSchema).toBeUndefined();
      expect(block.examples).toBeUndefined();
      expect(block.slots).toBeUndefined();
      expect(block.propertyIntents).toBeUndefined();
    }
    expect(estimateAssembledAiContextTokens(index)).toBeLessThan(
      estimateAssembledAiContextTokens(full),
    );
  });

  it('scoped mode expands exactly the requested types and nothing else', () => {
    const kernel = contextKernel();

    const scoped = assembleAiContext(kernel.context, {
      composition: { catalogMode: 'scoped', scopedBlockTypes: ['hero'] },
    });

    const hero = scoped.blocks.find((block) => block.type === 'hero');
    const button = scoped.blocks.find((block) => block.type === 'button');
    expect(hero?.propsSchema).toBeDefined();
    expect(hero?.slots).toBeDefined();
    expect(button?.propsSchema).toBeUndefined();
    expect(button?.description).toBeDefined();
  });

  it('scoped mode with no requested types is exactly index mode', () => {
    const kernel = contextKernel();

    const scoped = assembleAiContext(kernel.context, { composition: { catalogMode: 'scoped' } });
    const index = assembleAiContext(kernel.context, { composition: { catalogMode: 'index' } });

    expect(scoped.blocks).toEqual(index.blocks);
  });

  it('ignores a scoped type that is not registered rather than inventing an entry', () => {
    const kernel = contextKernel();

    const scoped = assembleAiContext(kernel.context, {
      composition: { catalogMode: 'scoped', scopedBlockTypes: ['hero', 'not-a-block'] },
    });

    expect(scoped.blocks.some((block) => block.type === 'not-a-block')).toBe(false);
    expect(scoped.blocks.find((block) => block.type === 'hero')?.propsSchema).toBeDefined();
  });

  it('keeps every non-catalog part of the context identical across modes', () => {
    const kernel = contextKernel();
    kernel.setSelection(['hero1']);

    const full = assembleAiContext(kernel.context, { composition: { catalogMode: 'full' } });
    const index = assembleAiContext(kernel.context, { composition: { catalogMode: 'index' } });

    expect(index.document).toEqual(full.document);
    expect(index.selection).toEqual(full.selection);
    expect(index.commands).toEqual(full.commands);
    expect(index.templates).toEqual(full.templates);
    expect(index.outputContract).toEqual(full.outputContract);
  });

  it('stays deterministic: the same mode assembles byte-identical catalogs', () => {
    const kernel = contextKernel();

    const first = assembleAiContext(kernel.context, { composition: { catalogMode: 'index' } });
    const second = assembleAiContext(kernel.context, { composition: { catalogMode: 'index' } });

    // Byte identity is what makes the prompt prefix cacheable.
    expect(JSON.stringify(first.blocks)).toBe(JSON.stringify(second.blocks));
  });
});
