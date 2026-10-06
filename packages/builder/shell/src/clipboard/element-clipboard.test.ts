import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { setUtilityClassOracle, type CustomCodeRoot } from '@craftkit/builder-schema';

import { createElementSelection } from '../selection/element-selection';
import {
  deleteElements,
  duplicateElements,
  hiddenStateAt,
  moveElement,
  renameElement,
  selectFirstChildElement,
  selectParentElement,
  toggleElementsHidden,
  toggleElementsLocked,
  unwrapElement,
  wrapElements,
} from './element-actions';
import { ELEMENT_ACTION_LABELS_AR } from './element-actions.labels';
import { createElementClipboard, parseElementPayloads, pasteDestination, type SystemClipboard } from './element-clipboard';
import { runEditorAction } from './run-editor-action';
import { TREE_FIXTURE_VOCAB, treeFixtureDocument } from './tree-commands.fixture';

/*
  The static vocabulary predates the desktop-first bucket prefixes
  (`max-md:`); in the product the live compiler's oracle answers for them, so
  these suites stand in a permissive one — as the style engine's own do.
*/
beforeAll(() => {
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});

const setup = (dir: 'ltr' | 'rtl' = 'ltr') =>
  createBuilder({
    document: treeFixtureDocument(dir),
    extensions: [TREE_FIXTURE_VOCAB],
    ports: { clock: fixedClock(0, 5_000), ids: seededIds('cb') },
  });

const t = (nodeId: string, ...path: number[]) => ({ kind: 'tree' as const, nodeId, path });
type Kernel = ReturnType<typeof setup>;
const treeOf = (kernel: Kernel, id: string) => kernel.getDocument().nodes[id]?.props['tree'] as unknown as CustomCodeRoot;
const texts = (kernel: Kernel, id: string) =>
  treeOf(kernel, id).children.map((node) => (node.kind === 'element' ? (node.text ?? node.tag) : node.kind));

describe('element clipboard', () => {
  it('copies from region A and pastes into region B after the focused element — one transaction, one undo', async () => {
    const kernel = setup();
    const clipboard = createElementClipboard({ system: null });
    const copied = await clipboard.copy({ kernel, targets: [t('rA', 0)] });
    expect(copied).toEqual({ ok: true, message: 'Copied Heading “Our story”' });

    const before = kernel.transactions().length;
    const pasted = await clipboard.paste({ kernel, targets: [t('rB', 0)] });
    expect(pasted.ok).toBe(true);
    expect(pasted.message).toBe('Paste · Heading “Our story”');
    expect(texts(kernel, 'rB')).toEqual(['Elsewhere', 'Our story']);
    expect(kernel.transactions()).toHaveLength(before + 1);
    // The pasted copy is the new focus.
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: 'rB', path: [1] });

    kernel.undo();
    expect(texts(kernel, 'rB')).toEqual(['Elsewhere']);
  });

  it('pastes INTO a focused container as its last child, and at the end of a selected region', async () => {
    const kernel = setup();
    const clipboard = createElementClipboard({ system: null });
    await clipboard.copy({ kernel, targets: [t('rB', 0)] });
    expect(pasteDestination(kernel, t('rA', 1))).toEqual({ regionId: 'rA', parent: [1], index: 2 });
    await clipboard.paste({ kernel, targets: [t('rA', 1)] });
    const card = treeOf(kernel, 'rA').children[1];
    expect(card?.kind === 'element' ? card.children?.map((c) => (c.kind === 'element' ? c.text : '')) : []).toEqual([
      'First',
      'Second',
      'Elsewhere',
    ]);
    await clipboard.paste({ kernel, targets: [{ kind: 'block', nodeId: 'rA' }] });
    expect(texts(kernel, 'rA')).toEqual(['Our story', 'div', 'Elsewhere']);
  });

  it('refuses to paste onto a block without a tree, and with an empty clipboard', async () => {
    const kernel = setup();
    const clipboard = createElementClipboard({ system: null });
    expect((await clipboard.paste({ kernel, targets: [t('rB', 0)] })).ok).toBe(false);
    await clipboard.copy({ kernel, targets: [t('rB', 0)] });
    const refused = await clipboard.paste({ kernel, targets: [{ kind: 'block', nodeId: 't1' }] });
    expect(refused.ok).toBe(false);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('carries the region css a hook class needs, merged into the destination once', async () => {
    const kernel = setup();
    const clipboard = createElementClipboard({ system: null });
    await clipboard.copy({ kernel, targets: [t('rA', 0)] });
    expect(clipboard.elements()[0]?.css).toContain('.ck-glow');
    await clipboard.paste({ kernel, targets: [t('rB', 0)] });
    await clipboard.paste({ kernel, targets: [t('rB', 0)] });
    const css = kernel.getDocument().nodes['rB']?.props['css'] as string;
    expect(css.match(/\.ck-glow/gu)).toHaveLength(1);
  });

  it('round-trips through the system clipboard, and falls back to memory when the system refuses', async () => {
    let stored = '';
    const system: SystemClipboard = {
      writeText: vi.fn((text: string) => {
        stored = text;
        return Promise.resolve();
      }),
      readText: vi.fn(() => Promise.resolve(stored)),
    };
    const kernel = setup();
    const clipboard = createElementClipboard({ system });
    await clipboard.copy({ kernel, targets: [t('rA', 0), t('rB', 0)] });
    expect(parseElementPayloads(stored)).toHaveLength(2);
    // Something else copied since: foreign text is not an element.
    stored = 'hello';
    expect((await clipboard.paste({ kernel, targets: [t('rB', 0)] })).ok).toBe(false);

    const refusing: SystemClipboard = {
      writeText: () => Promise.reject(new Error('denied')),
      readText: () => Promise.resolve('stale text'),
    };
    const fallback = createElementClipboard({ system: refusing });
    await fallback.copy({ kernel, targets: [t('rB', 0)] });
    expect((await fallback.paste({ kernel, targets: [t('rA', 0)] })).ok).toBe(true);
    expect(texts(kernel, 'rA')).toEqual(['Our story', 'Elsewhere', 'div']);
  });

  it('cut copies then deletes in one labelled transaction', async () => {
    const kernel = setup();
    const clipboard = createElementClipboard({ system: null });
    const outcome = await clipboard.cut({ kernel, targets: [t('rB', 0)] });
    expect(outcome.message).toBe('Cut · Text “Elsewhere”');
    expect(texts(kernel, 'rB')).toEqual([]);
    await clipboard.paste({ kernel, targets: [{ kind: 'block', nodeId: 'rB' }] });
    expect(texts(kernel, 'rB')).toEqual(['Elsewhere']);
  });

  it('copies a style and pastes it across the multi-selection in ONE group, keeping structure', () => {
    const kernel = setup();
    const clipboard = createElementClipboard({ system: null });
    expect(clipboard.pasteStyle({ kernel, targets: [t('rB', 0)] }).ok).toBe(false);
    expect(clipboard.copyStyle({ kernel, targets: [t('rA', 0)] }).ok).toBe(true);
    expect(clipboard.style()).toBe('text-4xl font-bold text-accent');

    const before = kernel.transactions().length;
    const outcome = clipboard.pasteStyle({ kernel, targets: [t('rB', 0), t('rA', 1, 0)] });
    expect(outcome).toEqual({ ok: true, message: 'Paste style · 2 elements' });
    expect(kernel.transactions()).toHaveLength(before + 1);
    const elsewhere = treeOf(kernel, 'rB').children[0];
    expect(elsewhere?.kind === 'element' ? elsewhere.className : '').toBe('text-4xl font-bold text-accent');
    kernel.undo();
    const restored = treeOf(kernel, 'rB').children[0];
    expect(restored?.kind === 'element' ? restored.className : '').toBe('text-sm');
  });
});

describe('element actions', () => {
  it('duplicates, wraps, unwraps and moves — each one labelled undo step', () => {
    const kernel = setup();
    expect(duplicateElements({ kernel, targets: [t('rA', 0)] }).message).toBe('Duplicate · Heading “Our story”');
    expect(texts(kernel, 'rA')).toEqual(['Our story', 'Our story', 'div']);
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: 'rA', path: [1] });
    kernel.undo();

    // Contiguous siblings wrap together.
    expect(wrapElements({ kernel, targets: [t('rA', 1, 0), t('rA', 1, 1)] }).ok).toBe(true);
    const card = treeOf(kernel, 'rA').children[1];
    expect(card?.kind === 'element' ? card.children?.length : 0).toBe(1);
    expect(unwrapElement({ kernel, targets: [t('rA', 1, 0)] }).ok).toBe(true);
    const unwrapped = treeOf(kernel, 'rA').children[1];
    expect(unwrapped?.kind === 'element' ? unwrapped.children?.length : 0).toBe(2);

    expect(moveElement({ kernel, targets: [t('rA', 0)] }, 'earlier').ok).toBe(false);
    expect(moveElement({ kernel, targets: [t('rA', 0)] }, 'later').message).toBe('Move later · Heading “Our story”');
    expect(texts(kernel, 'rA')).toEqual(['div', 'Our story']);
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: 'rA', path: [1] });
  });

  it('deletes a multi-selection in one step (descendants of a selected parent are not double-counted)', () => {
    const kernel = setup();
    const before = kernel.transactions().length;
    const outcome = deleteElements({ kernel, targets: [t('rA', 1), t('rA', 1, 0), t('rB', 0)] });
    expect(outcome.message).toBe('Delete · 2 elements');
    expect(kernel.transactions()).toHaveLength(before + 1);
    expect(texts(kernel, 'rA')).toEqual(['Our story']);
    expect(texts(kernel, 'rB')).toEqual([]);
  });

  it('hides at the current bucket only, and the eye reads it back', () => {
    const kernel = setup();
    expect(toggleElementsHidden({ kernel, targets: [t('rA', 0)] }, 'mobile').message).toBe(
      'Hide · Heading “Our story”',
    );
    const heading = treeOf(kernel, 'rA').children[0];
    const className = heading?.kind === 'element' ? heading.className : '';
    expect(className).toContain('max-md:hidden');
    expect(hiddenStateAt(className, 'mobile')).toEqual({ hidden: true, source: 'here' });
    expect(hiddenStateAt(className, 'base')).toEqual({ hidden: false, source: 'none' });
    toggleElementsHidden({ kernel, targets: [t('rA', 0)] }, 'mobile');
    const shown = treeOf(kernel, 'rA').children[0];
    expect(shown?.kind === 'element' ? shown.className : '').not.toContain('hidden');
  });

  it('locks, renames (Arabic labels too) and clears a name', () => {
    const kernel = setup();
    expect(toggleElementsLocked({ kernel, targets: [t('rA', 0)] }).message).toBe('Lock · Heading “Our story”');
    expect(treeOf(kernel, 'rA').children[0]?.locked).toBe(true);
    toggleElementsLocked({ kernel, targets: [t('rA', 0)] });
    expect(treeOf(kernel, 'rA').children[0]?.locked).toBeUndefined();

    const renamed = renameElement({ kernel, targets: [], labels: ELEMENT_ACTION_LABELS_AR }, t('rA', 0), '  العنوان  ');
    expect(renamed.message).toBe('إعادة تسمية · العنوان');
    const node = treeOf(kernel, 'rA').children[0];
    expect(node?.kind === 'element' ? node.label : '').toBe('العنوان');
    renameElement({ kernel, targets: [] }, t('rA', 0), '');
    const cleared = treeOf(kernel, 'rA').children[0];
    expect(cleared?.kind === 'element' ? cleared.label : 'x').toBeUndefined();
  });

  it('selects the parent and the first child', () => {
    const kernel = setup();
    expect(selectParentElement(kernel, t('rA', 1, 0))).toBe(true);
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: 'rA', path: [1] });
    expect(selectParentElement(kernel, t('rA', 1))).toBe(true);
    expect(kernel.context.store.getState().selection).toEqual(['rA']);
    expect(kernel.context.store.getState().elementFocus).toBeNull();
    expect(selectFirstChildElement(kernel, { kind: 'block', nodeId: 'rA' })).toBe(true);
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: 'rA', path: [0] });
    expect(selectFirstChildElement(kernel, t('rA', 0))).toBe(false);
  });
});

describe('runEditorAction', () => {
  it('runs shortcuts against the multi-selection and declines what does not apply', () => {
    const kernel = setup();
    const selection = createElementSelection(kernel);
    const clipboard = createElementClipboard({ system: null });
    const announce = vi.fn();
    const deps = { kernel, selection, clipboard, announce, bucket: 'tablet' as const };

    expect(runEditorAction({ type: 'delete' }, deps)).toBe(false);
    expect(runEditorAction({ type: 'undo' }, deps)).toBe(false);

    selection.set([t('rA', 0), t('rB', 0)]);
    expect(runEditorAction({ type: 'toggleHidden' }, deps)).toBe(true);
    expect(announce).toHaveBeenLastCalledWith('Hide · 2 elements', true);
    expect(runEditorAction({ type: 'undo' }, deps)).toBe(true);
    expect(runEditorAction({ type: 'nudge', inline: 1, block: 0, step: 1 }, deps)).toBe(false);
    const onNudge = vi.fn(() => true);
    expect(runEditorAction({ type: 'nudge', inline: 1, block: 0, step: 1 }, { ...deps, onNudge })).toBe(true);
    const onDevice = vi.fn();
    runEditorAction({ type: 'device', device: 'mobile' }, { ...deps, onDevice });
    expect(onDevice).toHaveBeenCalledWith('mobile');
    selection.dispose();
  });
});
