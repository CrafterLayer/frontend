import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { setUtilityClassOracle } from '@craftkit/builder-schema';

import { ELEMENT_NAME_WORDS_AR } from '../../custom-code/element-target';
import { makePartTestKernel, PROMO_ID, promoProps } from '../../style-manager/part-test-kernel';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { buildLayerRows } from './layers-rows';
import { partRowKey, withPartRows, type PartLayerRow } from './layers-part-rows';
import { LayersPartRow } from './LayersPartRow';
import { LAYERS_PART_LABELS_EN } from './LayersPartRow.labels';
import { LayersTree } from './LayersTree';
import { LAYERS_TREE_LABELS_AR } from './LayersTree.labels';

beforeAll(() => {
  installBrowserStandIns();
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});

const rowEl = (container: HTMLElement, part: string, index: number[] = []) => {
  const element = container.querySelector<HTMLElement>(`[data-layer-key="${partRowKey(PROMO_ID, { part, index })}"]`);
  if (element === null) throw new Error(`no row for ${part}@${index.join('.')}`);
  return element;
};
const titles = (kernel: ReturnType<typeof makePartTestKernel>) =>
  (promoProps(kernel)['items'] as { title: string }[]).map((item) => item.title);
const focusOf = (kernel: ReturnType<typeof makePartTestKernel>) => kernel.context.store.getState().partFocus ?? null;

describe('withPartRows — the part rows of a registered block', () => {
  it('inserts part instances after the block row, nested by bind, renumbering the set', () => {
    const kernel = makePartTestKernel();
    const doc = kernel.getDocument();
    const rows = withPartRows(kernel, doc, buildLayerRows(kernel, doc, () => ['default'], new Set()), new Set());
    const parts = rows.filter((row): row is PartLayerRow => row.kind === 'part');
    // The promo block sits at depth 1 under the page, so its own parts start at depth 2.
    expect(parts.map((row) => `${'  '.repeat(row.depth - 2)}${row.ref.part}@${row.ref.index.join('.')}`)).toEqual([
      'heading@',
      'body@',
      'cta@',
      'image@',
      'items@',
      '  item@0',
      '    item.title@0',
      '  item@1',
      '    item.title@1',
      '  item@2',
      '    item.title@2',
      'frame@',
    ]);
    const block = rows.find((row) => row.key === `block:${PROMO_ID}`);
    expect(block?.expandable).toBe(true);
    const top = parts.filter((row) => row.depth === (block?.depth ?? 0) + 1);
    expect(top.map((row) => row.posInSet)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(top.every((row) => row.setSize === 6)).toBe(true);
  });

  it('a collapsed block hides its parts; a collapsed list hides its items', () => {
    const kernel = makePartTestKernel();
    const doc = kernel.getDocument();
    const base = buildLayerRows(kernel, doc, () => ['default'], new Set());
    expect(withPartRows(kernel, doc, base, new Set([`block:${PROMO_ID}`])).some((row) => row.kind === 'part')).toBe(false);
    const listKey = partRowKey(PROMO_ID, { part: 'items', index: [] });
    const rows = withPartRows(kernel, doc, base, new Set([listKey]));
    expect(rows.some((row) => row.kind === 'part' && row.ref.part === 'item')).toBe(false);
    expect(rows.some((row) => row.key === listKey)).toBe(true);
  });
});

describe('LayersPartRow', () => {
  it('is a treeitem with a localized name, an isolated preview and no drag grip', () => {
    const kernel = makePartTestKernel();
    const doc = kernel.getDocument();
    const row = withPartRows(kernel, doc, buildLayerRows(kernel, doc, () => ['default'], new Set()), new Set()).find(
      (candidate): candidate is PartLayerRow => candidate.kind === 'part' && candidate.ref.part === 'heading',
    );
    if (row === undefined) throw new Error('no heading row');
    const onSelect = vi.fn();
    render(
      <ul role="tree">
        <LayersPartRow
          row={row}
          name="Heading"
          preview="Build faster"
          description="Heading · Promo"
          glyph="T"
          selected={false}
          tabbable
          collapsed={false}
          labels={LAYERS_PART_LABELS_EN}
          registerRow={vi.fn()}
          onSelect={onSelect}
          onToggleExpanded={vi.fn()}
          onRowKeyDown={vi.fn()}
          onRowFocus={vi.fn()}
        />
      </ul>,
    );
    const item = screen.getByRole('treeitem', { name: /Heading/u });
    expect(item).toHaveAttribute('aria-selected', 'false');
    expect(item.querySelector('bdi')).toHaveTextContent('Build faster');
    expect(screen.queryByRole('button', { name: /Drag/u })).not.toBeInTheDocument();
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledWith(row);
  });
});

describe('LayersTree — part rows', () => {
  it('a click focuses the part (selecting the block) and highlights its row', async () => {
    const kernel = makePartTestKernel();
    const user = userEvent.setup();
    const { container } = render(<LayersTree kernel={kernel} />);
    const heading = rowEl(container, 'heading');
    expect(heading).toHaveTextContent('Heading');
    expect(heading.querySelector('bdi')).toHaveTextContent('Build faster');
    await user.click(heading);
    expect(focusOf(kernel)).toEqual({ id: PROMO_ID, part: 'heading', index: [] });
    expect(kernel.context.store.getState().selection).toEqual([PROMO_ID]);
    expect(rowEl(container, 'heading')).toHaveAttribute('aria-selected', 'true');
    // A part focus set elsewhere (the canvas) highlights its row too.
    act(() => {
      kernel.focusPart(PROMO_ID, { part: 'item.title', index: [1] });
    });
    expect(rowEl(container, 'item.title', [1])).toHaveAttribute('aria-selected', 'true');
    expect(rowEl(container, 'heading')).toHaveAttribute('aria-selected', 'false');
  });

  it('item rows duplicate, move and remove — each ONE labelled transaction, one Undo', async () => {
    const kernel = makePartTestKernel();
    const user = userEvent.setup();
    const { container } = render(<LayersTree kernel={kernel} />);
    const second = () => rowEl(container, 'item', [1]);

    await user.click(second().querySelector<HTMLElement>('[data-action="duplicate"]')!);
    expect(titles(kernel)).toEqual(['Fast', 'Safe', 'Safe', 'Arabic']);
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Duplicate item · Promo');
    // The focus follows the copy.
    expect(focusOf(kernel)).toEqual({ id: PROMO_ID, part: 'item', index: [2] });
    kernel.undo();
    expect(titles(kernel)).toEqual(['Fast', 'Safe', 'Arabic']);

    await user.click(second().querySelector<HTMLElement>('[data-action="moveUp"]')!);
    expect(titles(kernel)).toEqual(['Safe', 'Fast', 'Arabic']);
    kernel.undo();
    await user.click(second().querySelector<HTMLElement>('[data-action="remove"]')!);
    expect(titles(kernel)).toEqual(['Fast', 'Arabic']);
    expect(kernel.transactions().at(-1)?.command).toBe('Remove item · Promo');
  });

  it('the first item cannot move up, the last cannot move down', () => {
    const kernel = makePartTestKernel();
    const { container } = render(<LayersTree kernel={kernel} />);
    expect(rowEl(container, 'item', [0]).querySelector('[data-action="moveUp"]')).toBeDisabled();
    expect(rowEl(container, 'item', [2]).querySelector('[data-action="moveDown"]')).toBeDisabled();
  });

  it('keyboard: arrows walk into part rows, Enter focuses, Delete removes an item, Alt+↓ moves it', async () => {
    const kernel = makePartTestKernel();
    const user = userEvent.setup();
    const { container } = render(<LayersTree kernel={kernel} />);
    const block = container.querySelector<HTMLElement>(`[data-layer-key="block:${PROMO_ID}"]`)!;
    act(() => {
      block.focus();
    });
    await user.keyboard('{ArrowDown}');
    expect(rowEl(container, 'heading')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(focusOf(kernel)).toEqual({ id: PROMO_ID, part: 'heading', index: [] });

    act(() => {
      rowEl(container, 'item', [0]).focus();
    });
    fireEvent.keyDown(rowEl(container, 'item', [0]), { key: 'ArrowDown', altKey: true });
    expect(titles(kernel)).toEqual(['Safe', 'Fast', 'Arabic']);
    fireEvent.keyDown(rowEl(container, 'item', [1]), { key: 'Delete' });
    expect(titles(kernel)).toEqual(['Safe', 'Arabic']);
    // A non-item part ignores Delete: the block is never removed from a part row.
    fireEvent.keyDown(rowEl(container, 'heading'), { key: 'Delete' });
    expect(kernel.getDocument().nodes[PROMO_ID]).toBeDefined();
  });

  it('speaks Arabic: part names from the declaration, actions and counts', () => {
    const kernel = makePartTestKernel({ dir: 'rtl' });
    const { container } = render(
      <div dir="rtl">
        <LayersTree kernel={kernel} labels={LAYERS_TREE_LABELS_AR} words={ELEMENT_NAME_WORDS_AR} />
      </div>,
    );
    expect(rowEl(container, 'heading')).toHaveTextContent('العنوان');
    expect(rowEl(container, 'items').querySelector('bdi')).toHaveTextContent('3 عناصر');
    expect(rowEl(container, 'item', [1])).toHaveTextContent('الميزة 2');
    expect(
      rowEl(container, 'item', [1]).querySelector('[data-action="duplicate"]'),
    ).toHaveAccessibleName('تكرار الميزة 2');
  });
});
