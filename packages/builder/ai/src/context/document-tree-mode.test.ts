import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type CustomCodeNode,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { serializeTreeMarkup } from '../plan/tree-markup';
import { assembleAiContext } from './assemble-context';

const NullRender: BlockRenderComponent = () => null;

/** A section with a heading and `size` paragraphs, so trees differ in weight. */
function filledTree(heading: string, size: number): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        className: 'py-12',
        children: [
          { kind: 'element', tag: 'h2', className: 'text-3xl', text: heading, children: [] },
          ...Array.from({ length: size }, (_, index): CustomCodeNode => ({
            kind: 'element',
            tag: 'p',
            className: 'text-base',
            text: `Body copy number ${String(index)} that the model was told not to touch.`,
            children: [],
          })),
        ],
      },
    ],
  };
}

const extension: TrustedExtensionManifest = {
  tier: 1,
  name: 'tree-mode-fixture',
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

function document(faq: CustomCodeRoot = emptyCustomCodeTree()): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Home' },
        slots: { default: ['a', 'b', 'c'] },
      },
      a: { id: 'a', type: 'customCode', props: { label: 'Hero', tree: filledTree('Hero', 12) } },
      b: {
        id: 'b',
        type: 'customCode',
        props: { label: 'Pricing', tree: filledTree('Pricing', 12) },
      },
      c: { id: 'c', type: 'customCode', props: { label: 'FAQ', tree: faq } },
    },
  } as unknown as BuilderDocument;
}

function kernel(faq?: CustomCodeRoot) {
  return createBuilder({
    document: document(faq),
    extensions: [extension],
    ports: { clock: fixedClock(1), ids: seededIds('tree-mode') },
  });
}

function nodeOf(context: ReturnType<typeof assembleAiContext>, id: string) {
  return context.document.nodes.find((node) => node.id === id);
}

/**
 * The ten-section build re-shipped every section's tree on every step, so
 * filling the last section cost several times what filling the first did — for
 * text the run was explicitly told not to touch.
 */
describe('documentTreeMode', () => {
  it('quotes every tree by default, so "change the word X" stays answerable', () => {
    const context = assembleAiContext(kernel().context);

    expect(nodeOf(context, 'a')?.props['tree']).toEqual(
      serializeTreeMarkup(filledTree('Hero', 12)),
    );
    expect(nodeOf(context, 'b')?.props['tree']).toEqual(
      serializeTreeMarkup(filledTree('Pricing', 12)),
    );
  });

  it('keeps the region in hand whole and describes the rest', () => {
    const context = assembleAiContext(kernel().context, {
      selection: ['b'],
      composition: { catalogMode: 'none', documentTreeMode: 'scoped' },
    });

    // The one being edited arrives in full.
    expect(nodeOf(context, 'b')?.props['tree']).toEqual(
      serializeTreeMarkup(filledTree('Pricing', 12)),
    );
    // The others are described: what stands there, never its body copy.
    const summary = nodeOf(context, 'a')?.props['tree'];
    expect(summary).toBe('filled · 14 nodes · “Hero”');
    expect(JSON.stringify(summary)).not.toContain('Body copy');
  });

  it('names the regions to keep explicitly when the run is not about the selection', () => {
    const context = assembleAiContext(kernel().context, {
      selection: ['b'],
      composition: {
        catalogMode: 'none',
        documentTreeMode: 'scoped',
        treeScopeNodeIds: ['a'],
      },
    });

    expect(nodeOf(context, 'a')?.props['tree']).toEqual(
      serializeTreeMarkup(filledTree('Hero', 12)),
    );
    expect(nodeOf(context, 'b')?.props['tree']).toBe('filled · 14 nodes · “Pricing”');
  });

  it('hides no structure: ids, types, slots and ordinary props all survive', () => {
    const context = assembleAiContext(kernel().context, {
      composition: { documentTreeMode: 'scoped' },
    });

    expect(context.document.nodes.map((node) => node.id)).toEqual(['a', 'b', 'c', 'root']);
    expect(nodeOf(context, 'a')?.props['label']).toBe('Hero');
    expect(nodeOf(context, 'root')?.slots).toEqual({ default: ['a', 'b', 'c'] });
    // An empty region is described too, and says so rather than pretending.
    expect(nodeOf(context, 'c')?.props['tree']).toBe('filled · 0 nodes');
  });

  it('quotes a region holding a component reference as markup too, so editTree can reach it', () => {
    const tree: CustomCodeRoot = {
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
    };
    const context = assembleAiContext(kernel(tree).context);

    expect(nodeOf(context, 'c')?.props['tree']).toBe(
      '<section><h2>Contact</h2><ck-component type=\'contact\' props=\'{"email":"a@b.co"}\'/></section>',
    );
  });

  it('makes the last fill cost what the first one did', () => {
    const size = (selection: readonly string[]) =>
      JSON.stringify(
        assembleAiContext(kernel().context, {
          selection,
          composition: { catalogMode: 'none', documentTreeMode: 'scoped' },
        }).document,
      ).length;
    const whole = JSON.stringify(
      assembleAiContext(kernel().context, { composition: { catalogMode: 'none' } }).document,
    ).length;

    // Whichever region is in hand, the request is the same size.
    expect(Math.abs(size(['a']) - size(['b']))).toBeLessThan(40);
    // And smaller than shipping every tree.
    expect(size(['a'])).toBeLessThan(whole);
  });
});
