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
});
