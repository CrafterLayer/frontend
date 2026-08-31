import { describe, expect, it } from 'vitest';

import { BuilderError, type Transaction } from '@craftkit/builder-schema';

import { insertedNodeId } from '../commands/core-commands';
import { fakeExtension } from '../testing/fake-extension';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { emptyDocument, fixtureBlocks, landingFixture } from '../testing/fixtures';
import { createBuilder } from './create-builder';

function testKernel(document = emptyDocument()) {
  return createBuilder({
    document,
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('t') },
  });
}

describe('US1 — build and edit through commands with reliable undo', () => {
  it('scenario 1: a command sequence produces the expected structure and one attributed record each', () => {
    const kernel = testKernel();
    const heroTx = kernel.dispatch('insertNode', { type: 'hero', parentId: 'root' });
    const heroId = insertedNodeId(heroTx.patches);
    if (heroId === undefined) {
      throw new Error('insertNode produced no node');
    }
    const buttonTx = kernel.dispatch('insertNode', {
      type: 'button',
      parentId: heroId,
      slot: 'actions',
    });
    const buttonId = insertedNodeId(buttonTx.patches);
    kernel.dispatch('setProp', { id: heroId, key: 'heading', value: 'مرحبا' });

    const doc = kernel.getDocument();
    expect(doc.nodes['root']?.slots?.['default']).toEqual([heroId]);
    expect(doc.nodes[heroId]?.slots?.['actions']).toEqual([buttonId]);
    expect(doc.nodes[heroId]?.props['heading']).toBe('مرحبا');
    // Defaults applied through the schema on insert:
    expect(doc.nodes[heroId]?.props['tone']).toBe('light');

    const log = kernel.transactions();
    expect(log).toHaveLength(3);
    expect(log.every((tx) => tx.author === 'user')).toBe(true);
    expect(log.map((tx) => tx.command)).toEqual(['insertNode', 'insertNode', 'setProp']);
    expect(kernel.validate()).toEqual([]);
  });

  it('scenario 2+3: undo to the beginning restores the exact original; redo restores the final', () => {
    const original = landingFixture();
    const kernel = testKernel(original);
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Changed.' });
    kernel.dispatch('removeNode', { id: 'cta2' });
    kernel.dispatch('moveNode', { id: 'sec1', toParentId: 'root', toIndex: 0 });
    const finalDoc = kernel.getDocument();

    while (kernel.undo()) {
      // drain
    }
    expect(kernel.getDocument()).toEqual(original);
    expect(kernel.canUndo()).toBe(false);

    while (kernel.redo()) {
      // drain
    }
    expect(kernel.getDocument()).toEqual(finalDoc);
    expect(kernel.canRedo()).toBe(false);
  });

  it('scenario 4: malformed input is rejected before any state change, naming the offender', () => {
    const kernel = testKernel();
    const before = kernel.getDocument();
    let caught: BuilderError | undefined;
    try {
      kernel.dispatch('insertNode', { type: 'hero' } as never);
    } catch (error) {
      caught = error as BuilderError;
    }
    expect(caught?.code).toBe('cmd/invalid-args');
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toHaveLength(0);
    expect(kernel.canUndo()).toBe(false);
  });

  it('scenario 5: AI and code-view authors produce the same record shape, distinguished only by author', () => {
    const kernel = testKernel(landingFixture());
    const aiTx = kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'From AI.' }, 'ai');
    const codeTx = kernel.dispatch(
      'setProp',
      { id: 'p1', key: 'content', value: 'From code view.' },
      'codeview',
    );
    const shape = (tx: Transaction) => Object.keys(tx).sort();
    expect(shape(aiTx)).toEqual(shape(codeTx));
    expect(aiTx.author).toBe('ai');
    expect(codeTx.author).toBe('codeview');
    expect(aiTx.inverse.length).toBeGreaterThan(0);
  });

  it('rejects an invalid runtime author before dispatch can change provenance or state', () => {
    const kernel = testKernel(landingFixture());
    const before = kernel.getDocument();

    expect(() =>
      kernel.dispatch(
        'setProp',
        { id: 'p1', key: 'content', value: 'Invalid provenance' },
        'robot' as 'ai',
      ),
    ).toThrow(/author/i);
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toEqual([]);
  });

  it('unknown commands are rejected as cmd/unknown', () => {
    const kernel = testKernel();
    expect(() => kernel.dispatch('teleport', {})).toThrow(/No command named/);
  });

  it('setDocMeta is an ordinary undoable command with a live meta event (Law L)', () => {
    const kernel = testKernel();
    const seen: { dir: string; surface: string }[] = [];
    kernel.context.events.on('docMeta.changed', (payload) => {
      seen.push(payload);
    });

    kernel.dispatch('setDocMeta', { dir: 'rtl', surface: 'store' });
    expect(kernel.context.dir).toBe('rtl');
    expect(kernel.context.surface).toBe('store');
    expect(seen).toEqual([{ dir: 'rtl', surface: 'store' }]);

    kernel.undo();
    expect(kernel.context.dir).toBe('ltr');
    expect(seen).toHaveLength(2);
  });

  it('a no-effect command is not an observable change: nothing logged, nothing undoable', () => {
    const kernel = testKernel(landingFixture());
    const tx = kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Welcome aboard.' });
    expect(tx.patches).toHaveLength(0);
    expect(kernel.transactions()).toHaveLength(0);
    expect(kernel.canUndo()).toBe(false);
  });

  it('selection is kernel state, not a transaction', () => {
    const kernel = testKernel(landingFixture());
    kernel.setSelection(['hero1']);
    expect(kernel.context.store.getState().selection).toEqual(['hero1']);
    expect(kernel.transactions()).toHaveLength(0);
  });
});

describe('runtime extension registration (fixture-level; full lifecycle in US2)', () => {
  it('registers the fake extension: block discoverable, command dispatchable, keymaps visible', () => {
    const kernel = testKernel(landingFixture());
    kernel.registerExtension(fakeExtension);

    expect(kernel.context.registry.block('fakeBox')?.schema.type).toBe('fakeBox');
    expect(kernel.context.registry.keymaps()).toEqual([
      { combo: 'mod+shift+t', command: 'fake.tag' },
    ]);

    const tx = kernel.dispatch('fake.tag', { id: 'p1' });
    expect(tx.command).toBe('fake.tag');
    expect(kernel.getDocument().nodes['p1']?.props['label']).toBe('tagged');
  });

  it('structural guard still applies to extension blocks: fakeBox is not allowed under page', () => {
    const kernel = testKernel();
    kernel.registerExtension(fakeExtension);
    expect(() => kernel.dispatch('insertNode', { type: 'fakeBox', parentId: 'root' })).toThrow(
      BuilderError,
    );
  });
});
