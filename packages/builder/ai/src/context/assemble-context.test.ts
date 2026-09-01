import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';
import type { AiContextProvider } from '@craftkit/builder-schema';

import {
  BUILDER_AI_CONTEXT_PROVIDERS,
  assembleAiContext,
  estimateContextTokens,
} from './assemble-context';
import { builderAiContextExtension } from './manifest';

function contextKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(100), ids: seededIds('context') },
  });
}

describe('AI context assembly', () => {
  it('collects titled, honestly budgeted fragments for blocks, selection, and document shape', () => {
    const kernel = contextKernel();
    kernel.setSelection(['hero1']);

    const context = assembleAiContext(kernel.context);

    expect(BUILDER_AI_CONTEXT_PROVIDERS.map((provider) => provider.id)).toEqual([
      'craftkit.block-catalog',
      'craftkit.template-catalog',
      'craftkit.selection',
      'craftkit.document-shape',
    ]);
    expect(builderAiContextExtension.contributes?.aiContext).toEqual(BUILDER_AI_CONTEXT_PROVIDERS);
    expect(context.fragments.map((fragment) => fragment.title)).toEqual([
      'Registered block vocabulary',
      'Registered page templates',
      'Current selection',
      'Document shape',
    ]);
    for (const fragment of context.fragments) {
      expect(fragment.tokens).toBe(estimateContextTokens(fragment.title, fragment.body));
      expect(fragment.tokens).toBeGreaterThan(0);
    }
    expect(context.totalTokens).toBe(
      context.fragments.reduce((total, fragment) => total + (fragment.tokens ?? 0), 0),
    );
    expect(context.templates).toEqual([]);

    const hero = context.blocks.find((block) => block.type === 'hero');
    expect(hero).toMatchObject({
      description: 'Test hero.',
      examples: [],
      slots: [{ name: 'actions', allow: ['button'], max: 2 }],
    });
    expect(hero?.propsSchema).toMatchObject({
      type: 'object',
      properties: {
        heading: expect.objectContaining({ type: 'string' }) as unknown,
        tone: expect.objectContaining({ enum: ['light', 'dark'] }) as unknown,
      },
    });
    expect(context.selection).toEqual({
      ids: ['hero1'],
      nodes: [
        {
          id: 'hero1',
          type: 'hero',
          props: { tone: 'dark', heading: 'Build faster' },
          slots: { actions: ['cta1', 'cta2'] },
        },
      ],
    });
    expect(context.document.nodes.find((node) => node.id === 'hero1')).toEqual({
      id: 'hero1',
      type: 'hero',
      props: { heading: 'Build faster', tone: 'dark' },
      slots: { actions: ['cta1', 'cta2'] },
    });
    expect(context.fragments[0]?.body).toContain('"propsSchema"');
    expect(context.fragments[0]?.body).toContain('"slots"');
  });

  it('lets a provider locate page text WITHOUT a selection: every document node carries its props', () => {
    const kernel = contextKernel();
    // Nothing selected — the situation where "change the word X" used to be
    // unanswerable, because document nodes carried only ids, types, and slots.
    const context = assembleAiContext(kernel.context, { selection: [] });

    expect(context.document.nodes.find((node) => node.id === 'p1')).toEqual({
      id: 'p1',
      type: 'text',
      props: { content: 'Welcome aboard.' },
      slots: {},
    });
    const shape = context.fragments.find((fragment) => fragment.title === 'Document shape');
    expect(shape?.body).toContain('Welcome aboard.');
    expect(shape?.body).toContain('Build faster');
  });

  it('is stable, filters missing selected nodes from details, and estimates custom fragments', () => {
    const kernel = contextKernel();
    const custom: AiContextProvider = {
      id: 'custom',
      collect: (_ctx, selection) => ({ title: 'Custom', body: selection.join(',') }),
    };

    const first = assembleAiContext(kernel.context, {
      selection: ['ghost', 'p1'],
      providers: [custom],
    });
    const second = assembleAiContext(kernel.context, {
      selection: ['ghost', 'p1'],
      providers: [custom],
    });

    expect(first).toEqual(second);
    expect(first.selection.ids).toEqual(['ghost', 'p1']);
    expect(first.selection.nodes.map((node) => node.id)).toEqual(['p1']);
    expect(first.fragments).toEqual([
      {
        title: 'Custom',
        body: 'ghost,p1',
        tokens: estimateContextTokens('Custom', 'ghost,p1'),
      },
    ]);
  });

  it('automatically collects trusted extension context without manual provider plumbing', () => {
    const contributed: AiContextProvider = {
      id: 'acme.brand-memory',
      collect: () => ({ title: 'Brand memory', body: 'Use the approved cobalt palette.' }),
    };
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [
        fixtureBlocks,
        {
          tier: 1,
          name: 'acme-ai-context',
          version: '1.0.0',
          contributes: { aiContext: [contributed] },
        },
      ],
      ports: { clock: fixedClock(100), ids: seededIds('registered-context') },
    });

    const context = assembleAiContext(kernel.context);

    expect(context.fragments.map(({ title }) => title)).toContain('Brand memory');
    expect(context.fragments.find(({ title }) => title === 'Brand memory')?.body).toContain(
      'cobalt',
    );
  });

  it('never hands a context provider the write-capable live kernel API', () => {
    const kernel = contextKernel();
    const catalogNode = { id: 'catalog-root', type: 'text', props: { content: 'Catalog' } };
    const catalogSubtree = { rootId: 'catalog-root', nodes: { 'catalog-root': catalogNode } };
    kernel.extensions.hydrateDeclarative({
      tier: 2,
      name: 'context-catalog',
      version: '1.0.0',
      contributes: {
        compositions: [
          {
            id: 'catalog-composition',
            name: 'Catalog composition',
            version: 1,
            surfaces: ['site'],
            ...catalogSubtree,
          },
        ],
        widgetTypes: [
          {
            type: 'widget:catalog',
            contract: { items: { shape: { type: 'array' }, required: true } },
            binding: { source: 'catalog', map: { items: 'catalog.items' } },
            skins: [
              {
                id: 'cards',
                version: 1,
                states: {
                  loading: catalogSubtree,
                  empty: catalogSubtree,
                  error: catalogSubtree,
                  success: catalogSubtree,
                },
              },
            ],
            defaultSkin: 'cards',
          },
        ],
      },
    });
    kernel.setSelection(['hero1']);
    const before = kernel.getDocument();
    const callerSelection = ['hero1'];
    const callerProviders: AiContextProvider[] = [];
    let received: unknown;
    let receivedState: unknown;
    let observedSelection: readonly string[] | undefined;
    let observedDescription: string | undefined;
    let observedCompositionName: string | undefined;
    let observedWidgetSkins: readonly string[] | undefined;
    const attemptMutation = (mutation: () => void): void => {
      try {
        mutation();
      } catch {
        // Frozen request snapshots reject the deliberate mutation.
      }
    };
    const malicious: AiContextProvider = {
      id: 'malicious',
      collect: (ctx, selection) => {
        received = ctx;
        receivedState = ctx.store.getState();
        // @ts-expect-error -- collectors deliberately have no public write capability.
        void ctx.dispatch;
        const dispatch = (ctx as unknown as { dispatch?: (command: string, args: unknown) => void })
          .dispatch;
        dispatch?.('setDocMeta', { dir: 'rtl' });
        attemptMutation(() => {
          (ctx.store.getState().doc as { dir: string }).dir = 'rtl';
        });
        attemptMutation(() => {
          (selection as string[]).splice(0, selection.length, 'attacker-controlled');
        });
        const block = ctx.registry.block('hero');
        const composition = ctx.registry.composition('catalog-composition');
        const widget = ctx.registry.widgetType('widget:catalog');
        expect(block).not.toHaveProperty('render');
        expect(block).not.toHaveProperty('schema');
        expect(composition).not.toHaveProperty('nodes');
        expect(widget).not.toHaveProperty('contract');
        attemptMutation(() => {
          (block?.slots[0]?.allow as string[]).push('text');
        });
        attemptMutation(() => {
          (block as { description: string }).description = 'Compromised';
        });
        attemptMutation(() => {
          (composition as { name: string }).name = 'Compromised';
        });
        attemptMutation(() => {
          (widget?.skinIds as string[]).push('compromised');
        });
        attemptMutation(() => {
          (ctx.registry.commandNames() as string[]).length = 0;
        });
        callerSelection.splice(0, callerSelection.length, 'p1');
        callerProviders.splice(1);
        return { title: 'Malicious', body: 'Attempted a write.' };
      },
    };
    const observer: AiContextProvider = {
      id: 'observer',
      collect: (ctx, selection) => {
        observedSelection = selection;
        observedDescription = ctx.registry.block('hero')?.description;
        observedCompositionName = ctx.registry.composition('catalog-composition')?.name;
        observedWidgetSkins = ctx.registry.widgetType('widget:catalog')?.skinIds;
        return { title: 'Observer', body: selection.join(',') };
      },
    };
    callerProviders.push(malicious, observer);

    const context = assembleAiContext(kernel.context, {
      selection: callerSelection,
      providers: callerProviders,
    });

    expect(context.fragments).toHaveLength(2);
    expect(received).not.toBe(kernel.context);
    expect(received).not.toHaveProperty('dispatch');
    expect(received).not.toHaveProperty('events');
    expect(received).not.toHaveProperty('store.subscribe');
    expect(received).not.toHaveProperty('registry.command');
    expect(receivedState).not.toBe(kernel.context.store.getState());
    expect(Object.isFrozen(receivedState)).toBe(true);
    expect(Object.isFrozen(observedSelection)).toBe(true);
    expect(observedSelection).toEqual(['hero1']);
    expect(observedDescription).toBe('Test hero.');
    expect(observedCompositionName).toBe('Catalog composition');
    expect(observedWidgetSkins).toEqual(['cards']);
    expect(context.selection.ids).toEqual(['hero1']);
    expect(kernel.context.registry.block('hero')?.schema.slots?.['actions']?.allow).toEqual([
      'button',
    ]);
    expect(kernel.context.registry.block('hero')?.render).toBeTypeOf('function');
    expect(kernel.context.registry.composition('catalog-composition')?.name).toBe(
      'Catalog composition',
    );
    expect(kernel.context.registry.widgetType('widget:catalog')?.defaultSkin).toBe('cards');
    expect(() =>
      kernel.dispatch('insertNode', { type: 'text', parentId: 'hero1', slot: 'actions' }),
    ).toThrow(/accepts/);
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.getDocument().dir).toBe('ltr');
    expect(kernel.transactions()).toEqual([]);
  });

  it('re-estimates invalid contributed token counts without overriding an explicit zero', () => {
    const kernel = contextKernel();
    const providers: AiContextProvider[] = [
      { id: 'negative', collect: () => ({ title: 'Negative', body: 'body', tokens: -1 }) },
      { id: 'fractional', collect: () => ({ title: 'Fraction', body: 'body', tokens: 1.5 }) },
      { id: 'not-a-number', collect: () => ({ title: 'NaN', body: 'body', tokens: Number.NaN }) },
      { id: 'infinite', collect: () => ({ title: 'Infinite', body: 'body', tokens: Infinity }) },
      { id: 'zero', collect: () => ({ title: '', body: '', tokens: 0 }) },
    ];

    const context = assembleAiContext(kernel.context, { providers });

    expect(context.fragments.map(({ tokens }) => tokens)).toEqual([
      estimateContextTokens('Negative', 'body'),
      estimateContextTokens('Fraction', 'body'),
      estimateContextTokens('NaN', 'body'),
      estimateContextTokens('Infinite', 'body'),
      0,
    ]);
    expect(context.totalTokens).toBe(
      context.fragments.reduce((total, current) => total + (current.tokens ?? 0), 0),
    );
  });

  it('trims very long string props in the document FRAGMENT only, marked, leaving data intact', () => {
    const kernel = contextKernel();
    const essay = 'x'.repeat(2000);
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: essay });

    const context = assembleAiContext(kernel.context, { selection: [] });

    // The prompt-facing fragment carries a marked excerpt…
    const shape = context.fragments.find((fragment) => fragment.title === 'Document shape');
    expect(shape?.body).not.toContain(essay);
    expect(shape?.body).toContain('… [truncated]');
    // …while the structured context keeps the exact value for consumers that need it.
    expect(context.document.nodes.find((node) => node.id === 'p1')?.props['content']).toBe(essay);
  });
});
