import { describe, expect, it } from 'vitest';

import { createBuilder } from '../kernel/create-builder';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture } from '../testing/fixtures';

function testKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('s') },
  });
}

describe('state facade', () => {
  it('select fires only when the selected value actually changes', () => {
    const kernel = testKernel();
    const seen: unknown[] = [];
    kernel.context.store.select(
      (state) => state.doc.nodes['p1']?.props['content'],
      (value) => {
        seen.push(value);
      },
    );

    kernel.dispatch('setProp', { id: 'hero1', key: 'heading', value: 'Elsewhere' }); // unrelated
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Selected.' });
    kernel.setSelection(['p1']); // state change, selected value unchanged

    expect(seen).toEqual(['Selected.']);
  });

  it('subscribeNode unsubscribes cleanly and reports removal as undefined', () => {
    const kernel = testKernel();
    const seen: (string | undefined)[] = [];
    const unsubscribe = kernel.context.store.subscribeNode('cta2', (node) => {
      seen.push(node?.id);
    });

    kernel.dispatch('removeNode', { id: 'cta2' });
    expect(seen).toEqual([undefined]);

    unsubscribe();
    kernel.undo();
    expect(seen).toEqual([undefined]);
  });

  it('isolates throwing state, selector, and node observers after an atomic write', () => {
    const kernel = testKernel();
    const seen: string[] = [];
    kernel.context.store.subscribe(() => {
      throw new Error('state observer failed');
    });
    kernel.context.store.subscribe(() => {
      seen.push('state');
    });
    kernel.context.store.select(
      (state) => state.doc.nodes['p1']?.props['content'],
      () => {
        throw new Error('selector observer failed');
      },
    );
    kernel.context.store.subscribeNode('p1', () => {
      throw new Error('node observer failed');
    });
    kernel.context.store.subscribeNode('p1', () => {
      seen.push('node');
    });

    expect(() =>
      kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Committed safely' }),
    ).not.toThrow();
    expect(seen).toEqual(['state', 'node']);
    expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('Committed safely');
    expect(kernel.transactions()).toHaveLength(1);
  });
});
