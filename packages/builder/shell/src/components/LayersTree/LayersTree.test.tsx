import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { LayersTree } from './LayersTree';

const NullRender: BlockRenderComponent = () => null;
const block = (type: string, label: string, slots?: Record<string, { allow: string[] }>) => ({
  schema: defineBlockSchema({
    type,
    description: label,
    props: z.object({}),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: NullRender,
});

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'layers-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', 'Page', { default: { allow: ['section'] } }),
      block('section', 'Section', { default: { allow: ['text', 'section'] } }),
      block('text', 'Text'),
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['sA', 'sB'] } },
    sA: { id: 'sA', type: 'section', props: {}, slots: { default: ['t1', 't2'] } },
    t1: { id: 't1', type: 'text', props: {} },
    t2: { id: 't2', type: 'text', props: {} },
    sB: { id: 'sB', type: 'section', props: {} },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('lt') },
  });

const rowNames = () =>
  screen.getAllByRole('treeitem').map((row) => row.textContent.replace(/[▸▾]/g, '').trim());

describe('LayersTree (006 contract §5)', () => {
  it('l1: every node appears once, nested, in canvas order — with explicit set positions', () => {
    render(<LayersTree kernel={makeKernel()} />);
    expect(rowNames()).toEqual(['Page', 'Section', 'Text', 'Text', 'Section']);
    const rows = screen.getAllByRole('treeitem');
    expect(rows.map((row) => row.getAttribute('aria-level'))).toEqual(['1', '2', '3', '3', '2']);
    // The DOM is flat, so ARIA position must be explicit (posinset/setsize):
    expect(rows.map((row) => row.getAttribute('aria-posinset'))).toEqual(['1', '1', '1', '2', '2']);
    expect(rows.map((row) => row.getAttribute('aria-setsize'))).toEqual(['1', '2', '2', '2', '2']);
  });

  it('restores keyboard focus to the tree when the FOCUSED row is removed by undo', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(<LayersTree kernel={kernel} />);
    // Focus t2's row via real keyboard traversal (root → sA → t1 → t2).
    screen.getAllByRole('treeitem')[0]!.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(document.activeElement?.textContent).toContain('Text');

    act(() => {
      kernel.dispatch('removeNode', { id: 't2' });
    });
    // The focused <li> unmounted; focus must land back on a tree row, not <body>.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.getAttribute('role')).toBe('treeitem');
  });

  it('l4-rtl: horizontal keys mirror under RTL content (US3/AC4)', async () => {
    const rtlDoc: BuilderDocument = { ...DOC, dir: 'rtl' };
    const kernel = createBuilder({
      document: rtlDoc,
      extensions: [VOCAB],
      ports: { clock: fixedClock(), ids: seededIds('rtl') },
    });
    const user = userEvent.setup();
    render(<LayersTree kernel={kernel} />);
    screen.getAllByRole('treeitem')[0]!.focus();
    await user.keyboard('{ArrowDown}'); // → sA (expanded)
    // Under RTL, ArrowRight = collapse-or-parent (the LTR ArrowLeft):
    await user.keyboard('{ArrowRight}');
    expect(rowNames()).toEqual(['Page', 'Section', 'Section']);
    // …and ArrowLeft = expand-or-step-in (the LTR ArrowRight):
    await user.keyboard('{ArrowLeft}');
    expect(rowNames()).toEqual(['Page', 'Section', 'Text', 'Text', 'Section']);
  });

  it('l2: clicking selects through the kernel; external selection highlights and reveals', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(<LayersTree kernel={kernel} />);

    await user.click(screen.getAllByRole('treeitem')[1]!); // sA
    expect(kernel.context.store.getState().selection).toEqual(['sA']);
    expect(screen.getAllByRole('treeitem')[1]).toHaveAttribute('aria-selected', 'true');

    // Collapse sA, then select its hidden child from OUTSIDE — the tree reveals it.
    const toggle = screen.getAllByRole('treeitem')[1]?.querySelector('.bldr-layers__toggle');
    await user.click(toggle!);
    expect(rowNames()).toEqual(['Page', 'Section', 'Section']); // t1/t2 hidden

    act(() => {
      kernel.setSelection(['t2']);
    });
    expect(rowNames()).toEqual(['Page', 'Section', 'Text', 'Text', 'Section']); // revealed
    expect(screen.getAllByRole('treeitem')[3]).toHaveAttribute('aria-selected', 'true');
  });

  it('l3: expand/collapse is view state — the document and history never change', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(<LayersTree kernel={kernel} />);
    const before = kernel.getDocument();
    const toggle = screen.getAllByRole('treeitem')[1]?.querySelector('.bldr-layers__toggle');
    await user.click(toggle!);
    await user.click(toggle!);
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('l4: the keyboard walks visible rows, expands/collapses, and selects', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(<LayersTree kernel={kernel} />);
    const root = screen.getAllByRole('treeitem')[0]!;
    root.focus();

    await user.keyboard('{ArrowDown}'); // → sA
    await user.keyboard('{ArrowLeft}'); // collapse sA
    expect(rowNames()).toEqual(['Page', 'Section', 'Section']);
    await user.keyboard('{ArrowRight}'); // expand it again
    expect(rowNames()).toEqual(['Page', 'Section', 'Text', 'Text', 'Section']);
    await user.keyboard('{ArrowRight}'); // step into the first child
    await user.keyboard('{Enter}'); // select t1
    expect(kernel.context.store.getState().selection).toEqual(['t1']);
  });

  it('l3: document changes (undo included) re-derive rows without reload', () => {
    const kernel = makeKernel();
    render(<LayersTree kernel={kernel} />);
    act(() => {
      kernel.dispatch('removeNode', { id: 't2' });
    });
    expect(rowNames()).toEqual(['Page', 'Section', 'Text', 'Section']);
    act(() => {
      kernel.undo();
    });
    expect(rowNames()).toEqual(['Page', 'Section', 'Text', 'Text', 'Section']);
  });

  it('a removed selected node clears its highlight (the kernel pruned the id)', () => {
    const kernel = makeKernel();
    render(<LayersTree kernel={kernel} />);
    act(() => {
      kernel.setSelection(['t1']);
    });
    act(() => {
      kernel.dispatch('removeNode', { id: 't1' });
    });
    for (const row of screen.getAllByRole('treeitem')) {
      expect(row).toHaveAttribute('aria-selected', 'false');
    }
  });
});
