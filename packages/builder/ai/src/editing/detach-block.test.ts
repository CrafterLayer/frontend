import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { blockConvertTool } from '../style-tools/block-convert';
import { runStyleTool } from '../style-tools/run-direct';
import {
  detachBlockToCustomCode,
  detachFidelity,
  humanBlockName,
  regionTreeFromMarkup,
  setBlockMarkupRenderer,
  type BlockMarkupRenderer,
} from './detach-block';
import { MARKETING_BLOCK_MARKUP } from './marketing-markup.fixtures';

/*
  "Convert to editable" (style-manager DESIGN.md §A.9). The fidelity half
  reads the captured static markup of every blocks-marketing block type
  (marketing-markup.fixtures.ts); the kernel half replaces a block with a
  customCode region through a stand-in renderer that returns that capture.
*/

const NullRender: BlockRenderComponent = () => null;

const blocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'detach-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({}),
          slots: { default: { allow: ['customCode', 'hero', 'faq', 'videoSection'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region.',
          props: z.object({
            label: z.string().max(80).default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: customCss(24_000).optional(),
          }),
          examples: [],
        }),
        render: NullRender,
      },
      ...['hero', 'faq', 'videoSection'].map((type) => ({
        schema: defineBlockSchema({
          type,
          description: `A ${type}.`,
          props: z.object({ label: z.string().optional() }),
          examples: [],
        }),
        render: NullRender,
      })),
    ],
  },
};

function captured(type: string): string {
  const entry = MARKETING_BLOCK_MARKUP.find((item) => item.type === type);
  if (entry === undefined) throw new Error(`no capture for ${type}`);
  return entry.markup;
}

/** Stands in for renderStaticMarkup: the capture for the root block's type. */
const fakeRenderer: BlockMarkupRenderer = (document) => captured(document.nodes[document.rootId]?.type ?? '');

function kernel(): BuilderKernel {
  const document = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['intro', 'b-hero', 'outro'] } },
      intro: { id: 'intro', type: 'faq', props: {} },
      'b-hero': { id: 'b-hero', type: 'hero', props: {} },
      outro: { id: 'outro', type: 'videoSection', props: { label: 'Showreel' } },
    },
  } as unknown as BuilderDocument;
  return createBuilder({
    document,
    extensions: [blocks],
    ports: { clock: fixedClock(1), ids: seededIds('detach') },
  });
}

afterEach(() => {
  setBlockMarkupRenderer(undefined);
});

/*
  Documented exceptions: none for classes or words. Attributes the region
  door does not admit are dropped and reported (data-* hooks, form
  action/method); the test asserts those are the only kinds dropped.
*/
describe('fidelity: every blocks-marketing block keeps its classes and words', () => {
  it.each(MARKETING_BLOCK_MARKUP.map((entry) => [entry.type, entry.markup] as const))('%s', (_type, markup) => {
    const converted = regionTreeFromMarkup(markup);
    expect(converted.ok, converted.ok ? '' : converted.reasons.join('\n')).toBe(true);
    if (!converted.ok) return;
    const fidelity = detachFidelity(markup, converted.tree);
    expect(fidelity.missingClasses).toEqual([]);
    // Documented exception: a respelled <del>/<ins>/<u> keeps its default look as one utility.
    expect(fidelity.extraClasses.filter((cls) => cls !== 'line-through' && cls !== 'underline')).toEqual([]);
    if (fidelity.extraClasses.length > 0) expect(converted.respelled.length).toBeGreaterThan(0);
    expect(fidelity.wordsAfter).toEqual(fidelity.wordsBefore);
    expect(fidelity.textEqual).toBe(true);
    for (const dropped of converted.dropped) {
      expect(dropped.reason, `${dropped.name} at ${dropped.path.join(',')}`).toMatch(/block's own hook|forms submit through whatsapp-form|data-ck-\*|not|refused|admit/iu);
    }
  });

  it('a lost space at an inline boundary fails the word check', () => {
    const tree = { kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'Pay once', children: [{ kind: 'element', tag: 'strong', text: 'and keep it' }] }] } as unknown as CustomCodeRoot;
    expect(detachFidelity('<p>Pay once <strong>and keep it</strong></p>', tree).textEqual).toBe(false);
  });
});

describe('detachBlockToCustomCode', () => {
  it('replaces the block with a region at the same place in one labelled transaction', () => {
    const k = kernel();
    const before = k.transactions().length;
    const result = detachBlockToCustomCode(k, 'b-hero', { render: fakeRenderer });
    if (!result.ok) throw new Error(result.reasons.join('\n'));
    expect(k.transactions().length).toBe(before + 1);
    expect(result.label).toBe('Convert to editable · Hero');
    expect(result.transaction.command).toBe('Convert to editable · Hero');
    const document = k.getDocument();
    const slot = document.nodes['root']?.slots?.['default'] ?? [];
    expect(slot).toHaveLength(3);
    expect(slot[0]).toBe('intro');
    expect(slot[2]).toBe('outro');
    expect(result.regionId).toBe(slot[1]);
    const region = document.nodes[result.regionId ?? ''];
    expect(region?.type).toBe('customCode');
    expect(region?.props['label']).toBe('Hero');
    expect(document.nodes['b-hero']).toBeUndefined();
    expect(JSON.stringify(region?.props['tree'])).toContain('Turn scattered work into clear momentum');
    k.undo();
    expect(k.getDocument().nodes['root']?.slots?.['default']).toEqual(['intro', 'b-hero', 'outro']);
  });

  it('keeps the block\'s own label as the region name', () => {
    const k = kernel();
    const result = detachBlockToCustomCode(k, 'outro', { render: fakeRenderer });
    expect(result.ok && result.label).toBe('Convert to editable · Showreel');
  });

  it('refuses markup the door refuses, and changes nothing', () => {
    const k = kernel();
    const before = JSON.stringify(k.getDocument());
    const result = detachBlockToCustomCode(k, 'b-hero', { render: () => '<section><marquee>Hi</marquee></section>' });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reasons.join(' ')).toMatch(/<marquee> is not an element a region admits/u);
    expect(JSON.stringify(k.getDocument())).toBe(before);
    expect(k.transactions()).toHaveLength(0);
  });

  it('refuses without a renderer, the root, a region and an unknown node', () => {
    const k = kernel();
    expect(detachBlockToCustomCode(k, 'b-hero')).toMatchObject({ ok: false, reasons: [expect.stringMatching(/no static renderer/u)] });
    expect(detachBlockToCustomCode(k, 'root', { render: fakeRenderer })).toMatchObject({ ok: false });
    expect(detachBlockToCustomCode(k, 'nope', { render: fakeRenderer })).toMatchObject({ ok: false, reasons: [expect.stringMatching(/does not exist/u)] });
    const converted = detachBlockToCustomCode(k, 'b-hero', { render: fakeRenderer });
    const regionId = converted.ok ? converted.regionId ?? '' : '';
    expect(detachBlockToCustomCode(k, regionId, { render: fakeRenderer })).toMatchObject({ ok: false, reasons: [expect.stringMatching(/already an editable region/u)] });
  });

  it('names block types for people', () => {
    expect(humanBlockName('bento-grid')).toBe('Bento grid');
    expect(humanBlockName('logoCloud')).toBe('Logo cloud');
  });
});

describe('block.convert (the agent tool)', () => {
  it('expands to insertNode + removeNode and lands as one transaction', () => {
    setBlockMarkupRenderer(fakeRenderer);
    const k = kernel();
    const parsed = blockConvertTool.parse({ nodeId: 'intro' });
    if (!parsed.ok) throw new Error(parsed.error);
    const result = runStyleTool(k, blockConvertTool, { nodeId: 'intro' });
    if (!result.ok) throw new Error(result.error);
    expect(result.steps.map(({ command }) => command)).toEqual(['insertNode', 'removeNode']);
    expect(result.label).toBe('Convert to editable · Faq');
    expect(k.transactions()).toHaveLength(1);
    expect(k.getDocument().nodes['intro']).toBeUndefined();
  });

  it('refuses with the reason and leaves the block', () => {
    const k = kernel();
    expect(blockConvertTool.parse({ id: 'x' })).toMatchObject({ ok: false });
    const result = runStyleTool(k, blockConvertTool, { nodeId: 'b-hero' });
    expect(result.ok ? '' : result.error).toMatch(/no static renderer.*leave the block/u);
  });
});
