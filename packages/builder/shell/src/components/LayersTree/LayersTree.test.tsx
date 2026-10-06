import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  setUtilityClassOracle,
  type BuilderDocument,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { TREE_FIXTURE_VOCAB, treeFixtureDocument } from '../../clipboard/tree-commands.fixture';
import { createElementSelection } from '../../selection/element-selection';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { LayersTree } from './LayersTree';

const NullRender: BlockRenderComponent = () => null;
const block = (type: string, description: string, slots?: Record<string, { allow: string[] }>) => ({
  schema: defineBlockSchema({
    type,
    description,
    props: z.object({}),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: NullRender,
});

const PAGE_DESCRIPTION =
  'The page root. Holds top-level sections in order. Exactly one per document; never nested.';
const SECTION_DESCRIPTION = 'A structural section that groups related page content.';
const TEXT_DESCRIPTION = 'A paragraph of editable text content.';
const HERO_DESCRIPTION =
  'Opening section at the top of a page: a large heading, optional supporting body, and up to two call-to-action buttons. Use once per page.';
const CTA_DESCRIPTION =
  'A call-to-action button with a short label and an emphasis level; optionally a small supporting note underneath.';

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'layers-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', PAGE_DESCRIPTION, { default: { allow: ['section'] } }),
      block('section', SECTION_DESCRIPTION, { default: { allow: ['text', 'section'] } }),
      block('text', TEXT_DESCRIPTION),
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

const IDENTITY_VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'layers-identity-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', PAGE_DESCRIPTION, { default: { allow: ['hero'] } }),
      block('hero', HERO_DESCRIPTION, { default: { allow: ['cta'] } }),
      block('cta', CTA_DESCRIPTION),
    ],
  },
};

const IDENTITY_DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['hero-main'] } },
    'hero-main': {
      id: 'hero-main',
      type: 'hero',
      props: {},
      slots: { default: ['cta-primary', 'cta-secondary'] },
    },
    'cta-primary': { id: 'cta-primary', type: 'cta', props: {} },
    'cta-secondary': { id: 'cta-secondary', type: 'cta', props: {} },
  },
};

const makeIdentityKernel = () =>
  createBuilder({
    document: IDENTITY_DOC,
    extensions: [IDENTITY_VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('identity') },
  });

const treeItemForText = (text: string): HTMLElement => {
  const row = screen.getByText(text).closest<HTMLElement>('[role="treeitem"]');
  if (row === null) {
    throw new Error(`expected ${text} to belong to a treeitem`);
  }
  return row;
};

const rowText = (selector: string): string[] =>
  screen.getAllByRole('treeitem').map((row) => {
    const value = row.querySelector(selector);
    if (value === null) {
      throw new Error(`expected every treeitem to contain ${selector}`);
    }
    return value.textContent.trim();
  });

const rowNames = () => rowText('.bldr-layers__name');
const rowIdentities = () => rowText('.bldr-layers__identity');

describe('LayersTree (006 contract §5)', () => {
  it('renders a short type-derived name instead of the schema description', () => {
    render(<LayersTree kernel={makeIdentityKernel()} />);

    const heroRow = treeItemForText('Hero');
    expect(heroRow).toHaveTextContent('Hero');
    expect(heroRow).not.toHaveTextContent(HERO_DESCRIPTION);
    expect(screen.queryByText(HERO_DESCRIPTION)).not.toBeInTheDocument();
  });

  it('shows node ids so same-type siblings remain distinguishable', () => {
    render(<LayersTree kernel={makeIdentityKernel()} />);

    const primaryRow = treeItemForText('cta-primary');
    const secondaryRow = treeItemForText('cta-secondary');
    expect(primaryRow).not.toBe(secondaryRow);
    expect(primaryRow).toHaveTextContent('cta-primary');
    expect(primaryRow).not.toHaveTextContent('cta-secondary');
    expect(secondaryRow).toHaveTextContent('cta-secondary');
    expect(secondaryRow).not.toHaveTextContent('cta-primary');
    expect(primaryRow.textContent).not.toBe(secondaryRow.textContent);
  });

  it('preserves the CTA acronym in the type-derived name', () => {
    render(<LayersTree kernel={makeIdentityKernel()} />);

    expect(screen.getAllByText('CTA')).toHaveLength(2);
    expect(screen.queryByText('Cta')).not.toBeInTheDocument();
  });

  it('keeps the schema description on the row title', () => {
    render(<LayersTree kernel={makeIdentityKernel()} />);

    expect(treeItemForText('Hero')).toHaveAttribute('title', HERO_DESCRIPTION);
  });

  it('l1: every node appears once, nested, in canvas order — with explicit set positions', () => {
    render(<LayersTree kernel={makeKernel()} />);
    expect(rowNames()).toEqual(['Page', 'Section', 'Text', 'Text', 'Section']);
    expect(rowIdentities()).toEqual(['root', 'sA', 't1', 't2', 'sB']);
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

// ── P8-manual-editor: element rows (style-manager DESIGN.md §E) ──────────────

describe('LayersTree — element trees under custom-code regions', () => {
  beforeAll(() => {
    installBrowserStandIns();
    // The live compiler answers for `max-md:` in the product (see element-clipboard.test.ts).
    setUtilityClassOracle(() => true);
  });
  afterAll(() => {
    setUtilityClassOracle(undefined);
  });

  const setupTree = (dir: 'ltr' | 'rtl' = 'ltr') => {
    const kernel = createBuilder({
      document: treeFixtureDocument(dir),
      extensions: [TREE_FIXTURE_VOCAB],
      ports: { clock: fixedClock(0, 5_000), ids: seededIds('lte') },
    });
    const selection = createElementSelection(kernel);
    return { kernel, selection };
  };
  const tree = (kernel: ReturnType<typeof setupTree>['kernel'], id: string) =>
    kernel.getDocument().nodes[id]?.props['tree'] as unknown as CustomCodeRoot;
  const rowByName = (name: string): HTMLElement => {
    const row = screen
      .getAllByRole('treeitem')
      .find((candidate) => candidate.querySelector('.bldr-layers__preview')?.textContent === name);
    if (row === undefined) throw new Error(`no element row previews "${name}"`);
    return row;
  };

  it('lists each region’s elements with glyph, name and text preview, nested under the region', () => {
    const { kernel } = setupTree();
    render(<LayersTree kernel={kernel} />);
    expect(rowNames()).toEqual([
      'Page',
      'Region',
      'Heading',
      'Container',
      'Text',
      'Text',
      'Region',
      'Text',
      'Text',
    ]);
    const heading = rowByName('Our story');
    expect(heading).toHaveAttribute('aria-level', '3');
    expect(heading.querySelector('.bldr-layers__glyph')).toHaveTextContent('H2');
    expect(rowByName('Second')).toHaveAttribute('aria-level', '4');
  });

  it('selection syncs both ways: a click focuses the element, Shift-click adds to the multi-selection', async () => {
    const { kernel, selection } = setupTree();
    const user = userEvent.setup();
    render(<LayersTree kernel={kernel} selection={selection} />);
    await user.click(rowByName('Our story'));
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: 'rA', path: [0] });
    expect(rowByName('Our story')).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Shift>}');
    await user.click(rowByName('Elsewhere'));
    await user.keyboard('{/Shift}');
    expect(selection.targets()).toHaveLength(2);
    expect(rowByName('Elsewhere')).toHaveAttribute('aria-selected', 'true');
    expect(rowByName('Our story')).toHaveAttribute('aria-selected', 'true');

    // From outside: the canvas focuses another element — the row follows.
    act(() => {
      kernel.focusElement('rA', [1, 1]);
    });
    expect(rowByName('Second')).toHaveAttribute('aria-selected', 'true');
    expect(rowByName('Elsewhere')).toHaveAttribute('aria-selected', 'false');
  });

  it('a keyboard-sensor drag reorders an element and is exactly one undo', async () => {
    const { kernel } = setupTree();
    const user = userEvent.setup();
    render(<LayersTree kernel={kernel} />);
    const before = kernel.transactions().length;
    const second = within(rowByName('Second')).getByRole('button', { name: /^Drag / });
    second.focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');
    const card = tree(kernel, 'rA').children[1];
    expect(card?.kind === 'element' ? card.children?.map((c) => (c.kind === 'element' ? c.text : '')) : []).toEqual([
      'Second',
      'First',
    ]);
    expect(kernel.transactions()).toHaveLength(before + 1);
    expect(kernel.transactions().at(-1)?.command).toBe('Move · Text');
    act(() => {
      kernel.undo();
    });
    const restored = tree(kernel, 'rA').children[1];
    expect(
      restored?.kind === 'element' ? restored.children?.map((c) => (c.kind === 'element' ? c.text : '')) : [],
    ).toEqual(['First', 'Second']);
  });

  it('renames inline (double-click, Enter) into the element label', async () => {
    const { kernel } = setupTree();
    const user = userEvent.setup();
    render(<LayersTree kernel={kernel} />);
    await user.dblClick(rowByName('Our story').querySelector('.bldr-layers__name')!);
    const input = screen.getByRole('textbox', { name: 'Name for Heading' });
    await user.type(input, 'Story title{Enter}');
    const heading = tree(kernel, 'rA').children[0];
    expect(heading?.kind === 'element' ? heading.label : '').toBe('Story title');
    expect(rowNames()).toContain('Story title');
    expect(kernel.transactions().at(-1)?.command).toBe('Rename · Story title');
  });

  it('the eye hides at the current bucket and shows it; the lock writes locked', async () => {
    const { kernel } = setupTree();
    const user = userEvent.setup();
    render(<LayersTree kernel={kernel} bucket="mobile" />);
    const eye = screen.getByRole('button', { name: 'Hide Heading on mobile' });
    expect(eye).toHaveAttribute('aria-pressed', 'false');
    expect(eye).toHaveTextContent('M');
    await user.click(eye);
    const heading = tree(kernel, 'rA').children[0];
    expect(heading?.kind === 'element' ? heading.className : '').toContain('max-md:hidden');
    expect(screen.getByRole('button', { name: 'Hide Heading on mobile' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Lock Heading' }));
    expect(tree(kernel, 'rA').children[0]?.locked).toBe(true);
    expect(screen.getByRole('button', { name: 'Lock Heading' })).toHaveAttribute('aria-pressed', 'true');
    // Each switch was one transaction.
    expect(kernel.transactions()).toHaveLength(2);
  });

  it('Delete on a focused element row removes it in one transaction', async () => {
    const { kernel } = setupTree();
    const user = userEvent.setup();
    render(<LayersTree kernel={kernel} />);
    rowByName('Elsewhere').focus();
    await user.keyboard('{Delete}');
    expect(tree(kernel, 'rB').children).toEqual([]);
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('the context menu duplicates and offers save-as-template', async () => {
    const { kernel } = setupTree();
    const user = userEvent.setup();
    const onSaveTemplate = vi.fn();
    render(<LayersTree kernel={kernel} onSaveTemplate={onSaveTemplate} />);
    fireEvent.contextMenu(rowByName('Our story'));
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));
    expect(tree(kernel, 'rA').children).toHaveLength(3);

    fireEvent.contextMenu(rowByName('Elsewhere'));
    await user.click(await screen.findByRole('menuitem', { name: 'Save as template' }));
    expect(onSaveTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'element', name: 'Text', tree: { kind: 'root', children: [expect.objectContaining({ text: 'Elsewhere' })] } }),
    );
  });
});
