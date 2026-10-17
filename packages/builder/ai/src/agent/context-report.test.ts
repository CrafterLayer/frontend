import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { BuilderDocument } from '@craftkit/builder-schema';

import { parseTreeMarkup } from '../plan/tree-markup';
import type { AiChatTurn } from '../types';
import { contextReadyReport, focusReport } from './context-report';

/** A page of four sections: a labelled region, a heading-only one, an anchor-only one, a bare block. */
function page(): BuilderDocument {
  const region = (id: string, props: Record<string, unknown>) => ({
    id,
    type: 'customCode',
    props,
    slots: {},
  });
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: {},
        slots: { default: ['pricing', 'faq', 'contact', 'gallery'] },
      },
      pricing: region('pricing', {
        label: 'Pricing',
        tree: parseTreeMarkup('<section></section>'),
      }),
      faq: region('faq', { tree: parseTreeMarkup('<section><h2>Questions</h2></section>') }),
      contact: region('contact', { tree: parseTreeMarkup("<section id='contact'></section>") }),
      gallery: { id: 'gallery', type: 'gallery', props: {}, slots: {} },
    },
  } as unknown as BuilderDocument;
}

function run(history?: readonly AiChatTurn[], maxContextTokens?: number) {
  const document = page();
  return {
    kernel: { getDocument: () => document } as unknown as BuilderKernel,
    ...(history === undefined ? {} : { history }),
    ...(maxContextTokens === undefined ? {} : { policy: { maxContextTokens } }),
  };
}

describe('focusReport', () => {
  it('names each section shown whole by its label, else its heading, else its anchor', () => {
    expect(focusReport(page(), { nodeIds: ['contact', 'pricing', 'faq'], kind: 'edit' })).toEqual({
      kind: 'edit',
      whole: [
        { id: 'pricing', type: 'customCode', name: 'Pricing' },
        { id: 'faq', type: 'customCode', name: 'Questions' },
        { id: 'contact', type: 'customCode', name: 'contact' },
      ],
      outlined: 1,
    });
  });

  it('gives a section with no name its type, and counts every other section as outlined', () => {
    expect(focusReport(page(), { nodeIds: ['gallery'], kind: 'add-section' })).toEqual({
      kind: 'add-section',
      whole: [{ id: 'gallery', type: 'gallery' }],
      outlined: 3,
    });
  });
});

describe('contextReadyReport', () => {
  const history: readonly AiChatTurn[] = [
    { role: 'user', text: 'first' },
    { role: 'assistant', text: 'first answer' },
    { role: 'user', text: 'second' },
    { role: 'assistant', text: 'x'.repeat(3_000) },
  ];

  it('reports the request against the default budget, and nothing trimmed when all was sent', () => {
    expect(contextReadyReport(run(history), undefined, 1_234, history)).toEqual({
      requestTokens: 1_234,
      maxTokens: 64_000,
    });
  });

  it('reports the host’s budget and the focus', () => {
    const report = contextReadyReport(
      run(undefined, 20_000),
      { nodeIds: ['faq'], kind: 'edit' },
      10,
      undefined,
    );

    expect(report.maxTokens).toBe(20_000);
    expect(report.focus?.whole.map(({ name }) => name)).toEqual(['Questions']);
    expect(report.historyTrimmed).toBeUndefined();
  });

  it('counts the entries left out and the ones cut short', () => {
    const sent: readonly AiChatTurn[] = [
      { role: 'user', text: 'second' },
      { role: 'assistant', text: `${'x'.repeat(1_999)}…` },
    ];

    expect(contextReadyReport(run(history), undefined, 10, sent).historyTrimmed).toEqual({
      dropped: 2,
      capped: 1,
    });
  });

  it('counts the whole conversation as left out when none of it was sent', () => {
    expect(contextReadyReport(run(history), undefined, 10, undefined).historyTrimmed).toEqual({
      dropped: 4,
      capped: 0,
    });
  });
});
