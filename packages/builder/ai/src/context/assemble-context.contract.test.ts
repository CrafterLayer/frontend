import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  blockPropsJsonSchema,
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import {
  assembleAiContext,
  blockCatalogContextProvider,
  documentShapeContextProvider,
  estimateContextTokens,
  selectionContextProvider,
} from './assemble-context';

const NullRender: BlockRenderComponent = () => null;

const page = defineBlockSchema({
  type: 'context-page',
  description: 'A page root with a primary content area and one compact sidebar.',
  props: z.object({ title: z.string().min(1).default('Context fixture') }),
  slots: {
    main: { allow: ['context-article', 'context-hero'], max: 4 },
    sidebar: { allow: ['context-cta'], max: 1 },
  },
  examples: [{ prompt: 'create a content page', node: { type: 'context-page', props: {} } }],
});

const hero = defineBlockSchema({
  type: 'context-hero',
  description: 'A prominent opening section with a headline and optional action buttons.',
  props: z.object({ heading: z.string().min(1).max(80), tone: z.enum(['calm', 'bold']) }),
  slots: { actions: { allow: ['context-cta'], max: 2 } },
  examples: [
    {
      prompt: 'add a bold product hero',
      node: { type: 'context-hero', props: { heading: 'Build with confidence', tone: 'bold' } },
    },
  ],
});

const article = defineBlockSchema({
  type: 'context-article',
  description: 'An article section with a title and a concise summary.',
  props: z.object({ title: z.string().min(1), summary: z.string().min(1) }),
  examples: [
    {
      prompt: 'add an article summary',
      node: {
        type: 'context-article',
        props: { title: 'Reliable plans', summary: 'Every proposal is validated first.' },
      },
    },
  ],
});

const cta = defineBlockSchema({
  type: 'context-cta',
  description: 'A compact call to action with an accessible label.',
  props: z.object({ label: z.string().min(1), href: z.string().min(1) }),
  examples: [
    {
      prompt: 'add a get started button',
      node: { type: 'context-cta', props: { label: 'Get started', href: '/start' } },
    },
  ],
});

const emailOnly = defineBlockSchema({
  type: 'context-email-banner',
  description: 'A banner that is available only on email surfaces.',
  surfaces: ['email'],
  props: z.object({ text: z.string().min(1) }),
  examples: [],
});

const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'builder-ai-context-contract-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: page, render: NullRender },
      { schema: hero, render: NullRender },
      { schema: article, render: NullRender },
      { schema: cta, render: NullRender },
      { schema: emailOnly, render: NullRender },
    ],
  },
};

function documentFixture(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    // Deliberately not alphabetical: the providers, not object insertion order,
    // define the deterministic output contract.
    nodes: {
      'side-cta': {
        id: 'side-cta',
        type: 'context-cta',
        props: { label: 'Read docs', href: '/docs' },
      },
      'article-1': {
        id: 'article-1',
        type: 'context-article',
        props: { title: 'Safe plans', summary: 'The kernel is the only writer.' },
      },
      root: {
        id: 'root',
        type: 'context-page',
        props: { title: 'Context fixture' },
        slots: { main: ['hero-1', 'article-1'], sidebar: ['side-cta'] },
      },
      'hero-cta': {
        id: 'hero-cta',
        type: 'context-cta',
        props: { label: 'Start now', href: '/start' },
      },
      'hero-1': {
        id: 'hero-1',
        type: 'context-hero',
        props: { heading: 'Build safely', tone: 'bold' },
        slots: { actions: ['hero-cta'] },
      },
    },
  };
}

function contextKernel() {
  return createBuilder({
    document: documentFixture(),
    extensions: [vocabulary],
    ports: { clock: fixedClock(10), ids: seededIds('context-contract') },
  });
}

function bodyOf(fragment: { body: string }): unknown {
  return JSON.parse(fragment.body) as unknown;
}

describe('AI context-provider contracts', () => {
  // Mutation proof: in assemble-context.ts, replace `collectBlocks(ctx)` in
  // `blockCatalogContextProvider.collect` with `[]`; the exact catalog assertion below must fail.
  it('serializes every active registered block model contract', () => {
    const kernel = contextKernel();
    const catalog = bodyOf(blockCatalogContextProvider.collect(kernel.context, []));

    expect(catalog).toEqual([
      {
        type: 'context-article',
        description: article.description,
        propsSchema: blockPropsJsonSchema(article),
        examples: article.examples,
        slots: [],
      },
      {
        type: 'context-cta',
        description: cta.description,
        propsSchema: blockPropsJsonSchema(cta),
        examples: cta.examples,
        slots: [],
      },
      {
        type: 'context-hero',
        description: hero.description,
        propsSchema: blockPropsJsonSchema(hero),
        examples: hero.examples,
        slots: [{ name: 'actions', allow: ['context-cta'], max: 2 }],
      },
      {
        type: 'context-page',
        description: page.description,
        propsSchema: blockPropsJsonSchema(page),
        examples: page.examples,
        slots: [
          { name: 'main', allow: ['context-article', 'context-hero'], max: 4 },
          { name: 'sidebar', allow: ['context-cta'], max: 1 },
        ],
      },
    ]);
  });

  // Mutation proof: in assemble-context.ts, replace `nodes: Object.values(doc.nodes)` in
  // `collectDocument` with `nodes: []`; the exact real-document assertion below must fail.
  it('serializes the live document shape with every node’s own props, inventing none', () => {
    const kernel = contextKernel();
    const shape = bodyOf(documentShapeContextProvider.collect(kernel.context, []));

    expect(shape).toEqual({
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: [
        {
          id: 'article-1',
          type: 'context-article',
          props: { summary: 'The kernel is the only writer.', title: 'Safe plans' },
          slots: {},
        },
        {
          id: 'hero-1',
          type: 'context-hero',
          props: { heading: 'Build safely', tone: 'bold' },
          slots: { actions: ['hero-cta'] },
        },
        {
          id: 'hero-cta',
          type: 'context-cta',
          props: { href: '/start', label: 'Start now' },
          slots: {},
        },
        {
          id: 'root',
          type: 'context-page',
          props: { title: 'Context fixture' },
          slots: { main: ['hero-1', 'article-1'], sidebar: ['side-cta'] },
        },
        {
          id: 'side-cta',
          type: 'context-cta',
          props: { href: '/docs', label: 'Read docs' },
          slots: {},
        },
      ],
    });

    kernel.dispatch('setDocMeta', { dir: 'rtl' });
    expect(
      (bodyOf(documentShapeContextProvider.collect(kernel.context, [])) as { dir: string }).dir,
    ).toBe('rtl');
  });

  // Mutation proof: in assemble-context.ts, replace `collectSelection(ctx, selection)` in
  // `selectionContextProvider.collect` with `collectSelection(ctx, [])`; this live-selection assertion must fail.
  it('follows the live selection order and exposes selected props', () => {
    const kernel = contextKernel();
    kernel.setSelection(['article-1', 'hero-1']);

    const selection = bodyOf(
      selectionContextProvider.collect(kernel.context, kernel.context.store.getState().selection),
    );

    expect(selection).toEqual({
      ids: ['article-1', 'hero-1'],
      nodes: [
        {
          id: 'article-1',
          type: 'context-article',
          props: { title: 'Safe plans', summary: 'The kernel is the only writer.' },
          slots: {},
        },
        {
          id: 'hero-1',
          type: 'context-hero',
          props: { heading: 'Build safely', tone: 'bold' },
          slots: { actions: ['hero-cta'] },
        },
      ],
    });

    kernel.setSelection(['side-cta']);
    expect(assembleAiContext(kernel.context).selection.ids).toEqual(['side-cta']);
  });

  // Mutation proof: in assemble-context.ts, replace `${title}\n${body}` in
  // `estimateContextTokens` with `body`; the title-and-separator count below must fail.
  it('counts title, separator, and body with ceiling and a one-token minimum', () => {
    expect(estimateContextTokens('', '')).toBe(1);
    expect(estimateContextTokens('a', 'bbb')).toBe(2);
    expect(estimateContextTokens('ab', '12345678')).toBe(3);
  });

  // Mutation proof: in assemble-context.ts, replace
  // `: estimateContextTokens(collected.title, collected.body)` with `: 0` in the token ternary;
  // the fallback budget assertion below must fail.
  it('uses the exact estimate when a contributed fragment omits a token count', () => {
    const kernel = contextKernel();
    const context = assembleAiContext(kernel.context, {
      providers: [{ id: 'unbudgeted', collect: () => ({ title: 'a', body: 'bbb' }) }],
    });

    expect(context.fragments).toEqual([{ title: 'a', body: 'bbb', tokens: 2 }]);
    expect(context.totalTokens).toBe(2);
  });
});
