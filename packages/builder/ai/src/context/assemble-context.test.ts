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
      'craftkit.selection',
      'craftkit.document-shape',
    ]);
    expect(builderAiContextExtension.contributes?.aiContext).toEqual(BUILDER_AI_CONTEXT_PROVIDERS);
    expect(context.fragments.map((fragment) => fragment.title)).toEqual([
      'Registered block vocabulary',
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
      slots: { actions: ['cta1', 'cta2'] },
    });
    expect(context.fragments[0]?.body).toContain('"propsSchema"');
    expect(context.fragments[0]?.body).toContain('"slots"');
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
});
