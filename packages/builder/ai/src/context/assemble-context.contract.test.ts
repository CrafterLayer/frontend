import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  blockPropsJsonSchema,
  defineBlockSchema,
  isJsonValue,
  type AiContextProvider,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { assembleAiContext, estimateContextTokens } from './assemble-context';
import { wirePropsSchema } from './wire-schema';

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
  propertyGroups: {
    heading: { tab: 'content', section: 'Copy' },
    tone: { tab: 'design', section: 'Appearance', kind: 'color-role' },
  },
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
        bindings: { heading: 'cms.hero.heading' },
        variantOf: 'featured',
        responsive: { mobile: { tone: 'calm' } },
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

describe('AI context-provider contracts', () => {
  // Mutation proof: in assemble-context.ts, replace `blocks: collectBlocks(readCtx)` with `[]`;
  // the exact structured catalog assertion below must fail.
  it('serializes every active registered block model contract once, including property intent', () => {
    const kernel = contextKernel();
    const context = assembleAiContext(kernel.context);
    const catalog = context.blocks;

    expect(catalog).toEqual([
      {
        type: 'context-article',
        description: article.description,
        propsSchema: wirePropsSchema(blockPropsJsonSchema(article)),
        examples: article.examples,
        slots: [],
      },
      {
        type: 'context-cta',
        description: cta.description,
        propsSchema: wirePropsSchema(blockPropsJsonSchema(cta)),
        examples: cta.examples,
        slots: [],
      },
      {
        type: 'context-hero',
        description: hero.description,
        propsSchema: wirePropsSchema(blockPropsJsonSchema(hero)),
        propertyIntents: {
          tabs: { content: ['heading'], design: ['tone'] },
          kinds: { 'color-role': ['tone'] },
        },
        examples: hero.examples,
        slots: [{ name: 'actions', allow: ['context-cta'], max: 2 }],
      },
      {
        type: 'context-page',
        description: page.description,
        // The document's root IS a context-page, and a page cannot be inserted
        // into itself: the context says so rather than spending a run to learn
        // it from the door. Its AUTHORING examples are dropped for the same
        // reason — a worked example of the one command the door refuses is a
        // lesson, and a rule is only a request. The schema stays: the root is
        // edited constantly.
        insertable: false,
        propsSchema: wirePropsSchema(blockPropsJsonSchema(page)),
        slots: [
          { name: 'main', allow: ['context-article', 'context-hero'], max: 4 },
          { name: 'sidebar', allow: ['context-cta'], max: 1 },
        ],
      },
    ]);
    expect(context.fragments).toEqual([]);
  });

  // Mutation proof: in assemble-context.ts, replace `nodes: Object.values(doc.nodes)` in
  // `collectDocument` with `nodes: []`; the exact real-document assertion below must fail.
  it('serializes the live document shape with every node’s own props, inventing none', () => {
    const kernel = contextKernel();
    const shape = assembleAiContext(kernel.context).document;

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
          bindings: { heading: 'cms.hero.heading' },
          variantOf: 'featured',
          responsive: { mobile: { tone: 'calm' } },
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
    expect(assembleAiContext(kernel.context).document.dir).toBe('rtl');
  });

  // Mutation proof: in assemble-context.ts, replace `selection: collectSelection(readCtx, selection)`
  // with `selection: collectSelection(readCtx, [])`; this live-selection assertion must fail.
  it('keeps selection as ordered focus ids without duplicating canonical node facts', () => {
    const kernel = contextKernel();
    kernel.setSelection(['article-1', 'hero-1']);

    const selection = assembleAiContext(kernel.context).selection;

    expect(selection).toEqual({ ids: ['article-1', 'hero-1'] });
    expect(JSON.stringify(selection)).not.toContain('Build safely');

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

    expect(context.fragments).toEqual([
      {
        source: 'unbudgeted',
        kind: 'data',
        trust: 'reviewed',
        title: 'a',
        body: 'bbb',
        tokens: 2,
      },
    ]);
    expect(context.totalTokens).toBe(2);
    expect(Object.isFrozen(context.fragments[0])).toBe(true);
  });

  it('exposes only allowlisted live command schemas plus a versioned output contract', () => {
    const kernel = contextKernel();
    let providerCommands: unknown;
    const inspector: AiContextProvider = {
      id: 'contract.inspector',
      collect: (ctx) => {
        providerCommands = ctx.registry.commands();
        return { title: 'Inspector', body: 'Observed the data-only catalog.' };
      },
    };

    const context = assembleAiContext(kernel.context, {
      allowedCommands: ['setProp', 'insertNode', 'not-registered'],
      additionalContextProviders: [inspector],
    });

    expect(context.commands?.map(({ name }) => name)).toEqual(['insertNode', 'setProp']);
    for (const command of context.commands ?? []) {
      expect(isJsonValue(command.argsSchema)).toBe(true);
      expect(Object.isFrozen(command)).toBe(true);
      expect(Object.isFrozen(command.argsSchema)).toBe(true);
      expect(command).not.toHaveProperty('apply');
      expect(JSON.stringify(command.argsSchema)).not.toContain('_zod');
    }
    expect(context.outputContract).toMatchObject({
      version: 1,
      schema: {
        type: 'object',
        required: ['rationale', 'commands'],
        properties: {
          rationale: { type: 'string', minLength: 1, pattern: '\\S' },
          commands: expect.objectContaining({ type: 'array', minItems: 1 }) as unknown,
          followUp: { type: 'string' },
        },
      },
    });
    expect(context.outputContract?.schema).not.toHaveProperty('followUp');
    expect(isJsonValue(context.outputContract?.schema)).toBe(true);
    expect(context.omissions).toEqual([
      {
        source: 'commands',
        reason: 'policy-filtered',
        omittedCount: kernel.context.registry.commandNames().length - 2,
      },
    ]);

    const patchSchema = assembleAiContext(kernel.context, {
      allowedCommands: ['applyPatches'],
    }).commands?.[0]?.argsSchema as {
      properties?: {
        patches?: {
          items?: {
            oneOf?: readonly {
              required?: readonly string[];
              properties?: { path?: { items?: { anyOf?: readonly { pattern?: string }[] } } };
            }[];
          };
        };
      };
    };
    expect(patchSchema.properties?.patches?.items?.oneOf?.[1]?.required).toContain('value');
    const safePathPattern =
      patchSchema.properties?.patches?.items?.oneOf?.[0]?.properties?.path?.items?.anyOf?.[0]
        ?.pattern;
    expect(safePathPattern).toBeDefined();
    expect(new RegExp(safePathPattern ?? '').test('__proto__')).toBe(false);

    const setDocMetaSchema = assembleAiContext(kernel.context, {
      allowedCommands: ['setDocMeta'],
    }).commands?.[0]?.argsSchema as { anyOf?: readonly { required?: readonly string[] }[] };
    expect(setDocMetaSchema.anyOf?.map(({ required }) => required)).toEqual([['dir'], ['surface']]);

    expect(Array.isArray(providerCommands)).toBe(true);
    expect(Object.isFrozen(providerCommands)).toBe(true);
    expect(providerCommands).not.toBe(kernel.context.registry.commandNames());
    for (const command of providerCommands as readonly Record<string, unknown>[]) {
      expect(command).not.toHaveProperty('apply');
      expect(command).not.toHaveProperty('argsSchema._zod');
    }
  });
});
