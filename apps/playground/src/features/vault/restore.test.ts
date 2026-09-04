import {
  codeViewExtension,
  createBuilder,
  defaultBlocks,
  emptyDocument,
  type BuilderDocument,
  type BuilderKernel,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it } from 'vitest';

import { restoreDocument } from './restore';

const kernelWith = (extensions = [defaultBlocks, codeViewExtension]): BuilderKernel =>
  createBuilder({
    document: emptyDocument('site', 'ltr'),
    extensions,
    ports: { clock: fixedClock(), ids: seededIds('restore') },
  });

describe('restoreDocument', () => {
  it('reports changed:false for an identical document — nothing to do is not an error', () => {
    const kernel = kernelWith();
    const before = kernel.transactions().length;

    expect(restoreDocument(kernel, kernel.getDocument())).toEqual({ ok: true, changed: false });
    expect(kernel.transactions()).toHaveLength(before);
  });

  it('restores an older document as ONE transaction that a single undo reverses', () => {
    const kernel = kernelWith();
    const original = structuredClone(kernel.getDocument()) as BuilderDocument;

    kernel.dispatch('setProp', { id: 'root', key: 'title', value: 'Edited' });
    const beforeRestore = kernel.transactions().length;

    expect(restoreDocument(kernel, original)).toEqual({ ok: true, changed: true });

    expect(kernel.transactions()).toHaveLength(beforeRestore + 1);
    expect(kernel.getDocument()).toEqual(original);
    expect(kernel.validate()).toEqual([]);

    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument().nodes['root']?.props['title']).toBe('Edited');
  });

  it('refuses a document whose block vocabulary is not registered, with a readable reason', () => {
    const kernel = kernelWith();
    const before = kernel.transactions().length;
    const alien: BuilderDocument = {
      ...emptyDocument('site', 'ltr'),
      nodes: {
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['ghost'] } },
        ghost: { id: 'ghost', type: 'not-a-registered-block', props: {} },
      },
    };

    const outcome = restoreDocument(kernel, alien);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toContain('not-a-registered-block');
    }
    expect(kernel.transactions()).toHaveLength(before);
  });

  it('refuses when the canonical-json projection is not registered, instead of throwing', () => {
    const kernel = kernelWith([defaultBlocks]);

    const outcome = restoreDocument(kernel, emptyDocument('site', 'ltr'));

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toContain('canonical-json');
    }
  });
});
