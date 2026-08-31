import { describe, expect, it } from 'vitest';

import { createBuilder } from '../kernel/create-builder';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '../testing';

function kernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(10), ids: seededIds('group') },
  });
}

const THREE_STEPS = [
  { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Grouped' } },
  { command: 'insertNode', args: { type: 'text', props: { content: 'One' }, parentId: 'sec1' } },
  { command: 'insertNode', args: { type: 'text', props: { content: 'Two' }, parentId: 'sec1' } },
] as const;

describe('dispatchGroup', () => {
  it('applies every step as ONE transaction and ONE undo restores the exact document', () => {
    const k = kernel();
    const before = structuredClone(k.getDocument());

    const tx = k.dispatchGroup([...THREE_STEPS], 'ai');

    expect(k.transactions()).toHaveLength(1);
    expect(tx.author).toBe('ai');
    const doc = k.getDocument();
    expect(doc.nodes['hero1']?.props['heading']).toBe('Grouped');
    const contents = Object.values(doc.nodes).map((node) => node.props['content']);
    expect(contents).toEqual(expect.arrayContaining(['One', 'Two']));

    expect(k.undo()).toBe(true);
    expect(k.getDocument()).toEqual(before);
    expect(k.canUndo()).toBe(false);

    expect(k.redo()).toBe(true);
    expect(k.getDocument().nodes['hero1']?.props['heading']).toBe('Grouped');
  });

  it('is atomic: a failing middle step leaves document, log, and history untouched', () => {
    const k = kernel();
    const before = structuredClone(k.getDocument());

    expect(() =>
      k.dispatchGroup(
        [
          { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Half' } },
          { command: 'removeNode', args: { id: 'ghost-node' } },
        ],
        'ai',
      ),
    ).toThrow();

    expect(k.getDocument()).toEqual(before);
    expect(k.transactions()).toHaveLength(0);
    expect(k.canUndo()).toBe(false);
  });

  it('rejects unknown commands and bad args BEFORE touching anything', () => {
    const k = kernel();
    const before = structuredClone(k.getDocument());

    expect(() => k.dispatchGroup([{ command: 'invent', args: {} }], 'ai')).toThrow(/invent/);
    expect(() =>
      k.dispatchGroup(
        [
          { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'ok' } },
          { command: 'insertNode', args: {} },
        ],
        'ai',
      ),
    ).toThrow();
    expect(k.getDocument()).toEqual(before);
    expect(k.transactions()).toHaveLength(0);
  });

  it('treats a no-effect group as no observable change: nothing logged, nothing undoable', () => {
    const k = kernel();
    const current = k.getDocument().nodes['hero1']?.props['heading'];

    k.dispatchGroup([{ command: 'setProp', args: { id: 'hero1', key: 'heading', value: current } }]);

    expect(k.transactions()).toHaveLength(0);
    expect(k.canUndo()).toBe(false);
  });
});
