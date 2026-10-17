import { describe, expect, it } from 'vitest';

import { createBuilder } from '../kernel/create-builder';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture } from '../testing/fixtures';
import { TYPING_MERGE_WINDOW_MS } from './history';

describe('history', () => {
  it('merges a typing burst on one (node, key) into a single undo step', () => {
    // fixedClock step 1ms — every keystroke lands inside the merge window.
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(0, 1), ids: seededIds('h') },
    });

    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'W' });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'We' });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Wel' });

    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('Welcome aboard.');
    expect(kernel.canUndo()).toBe(false);

    expect(kernel.redo()).toBe(true);
    expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('Wel');
  });

  it('does not merge across the window, across keys, or across nodes', () => {
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(0, TYPING_MERGE_WINDOW_MS + 1), ids: seededIds('h') },
    });

    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'One' });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Two' });
    kernel.dispatch('setProp', { id: 'hero1', key: 'heading', value: 'Three' });

    kernel.undo();
    kernel.undo();
    kernel.undo();
    expect(kernel.getDocument()).toEqual(landingFixture());
    expect(kernel.canUndo()).toBe(false);
  });

  it('merges a person\'s repeated labelled edit on the same paths (a rich-text burst) into one undo step', () => {
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(0, 1), ids: seededIds('h') },
    });
    const edit = (value: string, author: 'user' | 'ai' = 'user') => {
      kernel.dispatchGroup([{ command: 'setProp', args: { id: 'p1', key: 'content', value } }], {
        author,
        label: 'Edit text · Rich Text',
      });
    };
    edit('w');
    edit('wo');
    edit('wor');
    edit('word');
    expect(kernel.history?.().entries()).toHaveLength(1);
    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('Welcome aboard.');
    expect(kernel.canUndo()).toBe(false);

    // Another author's identical edits are not a person's typing burst.
    edit('a', 'ai');
    edit('ab', 'ai');
    expect(kernel.history?.().entries()).toHaveLength(2);
  });

  it('never merges steps that splice an array, even on identical paths (a move out and straight back)', () => {
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(0, 1), ids: seededIds('h') },
    });
    kernel.dispatch('moveNode', { id: 'hero1', toParentId: 'sec1', toIndex: 0 });
    const afterFirstMove = kernel.getDocument();
    kernel.dispatch('moveNode', { id: 'hero1', toParentId: 'root', toIndex: 0 });
    // Both moves write the same slot paths with add/remove at array indices.
    expect(kernel.history?.().entries()).toHaveLength(2);

    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(afterFirstMove);
    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(landingFixture());
    expect(kernel.canUndo()).toBe(false);
  });

  it('undo-all restores the page after the property-suite counterexample (seed -928950502)', () => {
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(), ids: seededIds('prop') },
    });
    kernel.dispatch('moveNode', { id: 'hero1', toParentId: 'sec1', toIndex: 0 });
    kernel.dispatch('moveNode', { id: 'hero1', toParentId: 'root', toIndex: 0 });
    kernel.dispatch('removeNode', { id: 'hero1' });
    kernel.dispatch('setProp', { id: 'sec1', key: 'gap', value: 'sm' });
    kernel.dispatch('setProp', { id: 'sec1', key: 'gap', value: 'sm' });
    kernel.dispatch('duplicateNode', { id: 'sec1' });
    const final = kernel.getDocument();

    while (kernel.undo()) {
      // drain
    }
    expect(kernel.getDocument()).toEqual(landingFixture());
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toEqual(['hero1', 'sec1']);
    while (kernel.redo()) {
      // drain
    }
    expect(kernel.getDocument()).toEqual(final);
    expect(kernel.validate()).toEqual([]);
  });

  it('a new change clears the redo stack', () => {
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(0, TYPING_MERGE_WINDOW_MS + 1), ids: seededIds('h') },
    });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'A' });
    kernel.undo();
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'B' });
    expect(kernel.canRedo()).toBe(false);
    expect(kernel.redo()).toBe(false);
  });

  it('undo on empty and redo with nothing undone are safe no-ops', () => {
    const kernel = createBuilder({ extensions: [fixtureBlocks] });
    expect(kernel.undo()).toBe(false);
    expect(kernel.redo()).toBe(false);
    expect(kernel.canUndo()).toBe(false);
    expect(kernel.canRedo()).toBe(false);
  });

  // ── P8-manual-editor: the read view (style-manager DESIGN.md §E) ──
  it('lists labelled entries with author and time, and tracks the position', () => {
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(0, TYPING_MERGE_WINDOW_MS + 1), ids: seededIds('h') },
    });
    const history = kernel.history?.();
    expect(history).toBeDefined();
    if (history === undefined) return;
    expect(history.entries()).toEqual([]);
    expect(history.position()).toBe(0);

    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'A' });
    kernel.dispatchGroup(
      [{ command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'B' } }],
      { author: 'ai', label: 'Heading · Hero' },
    );
    const entries = history.entries();
    expect(entries.map((entry) => [entry.label, entry.author])).toEqual([
      ['setProp', 'user'],
      ['Heading · Hero', 'ai'],
    ]);
    expect(entries[1]!.at).toBeGreaterThan(entries[0]!.at);
    expect(history.position()).toBe(2);
    // A stable snapshot until the stack changes.
    expect(history.entries()).toBe(entries);

    kernel.undo();
    expect(history.position()).toBe(1);
    // Undone entries stay listed (redo order) until a new change clears them.
    expect(history.entries().map((entry) => entry.label)).toEqual(['setProp', 'Heading · Hero']);
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'C' });
    expect(history.entries().map((entry) => entry.label)).toEqual(['setProp', 'setProp']);
  });

  it('a merged typing burst is ONE entry', () => {
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(0, 1), ids: seededIds('h') },
    });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'W' });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'We' });
    expect(kernel.history?.().entries()).toHaveLength(1);
  });

  it('jumpTo replays undo/redo — no new transaction — and clamps', () => {
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(0, TYPING_MERGE_WINDOW_MS + 1), ids: seededIds('h') },
    });
    const history = kernel.history!();
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'One' });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Two' });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Three' });
    const logged = kernel.transactions().length;

    expect(history.jumpTo(1)).toBe(2);
    expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('One');
    expect(history.position()).toBe(1);

    expect(history.jumpTo(3)).toBe(2);
    expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('Three');

    expect(history.jumpTo(-5)).toBe(3);
    expect(kernel.getDocument()).toEqual(landingFixture());
    expect(history.jumpTo(99)).toBe(3);
    expect(history.position()).toBe(3);
    expect(kernel.transactions()).toHaveLength(logged);
  });
});
