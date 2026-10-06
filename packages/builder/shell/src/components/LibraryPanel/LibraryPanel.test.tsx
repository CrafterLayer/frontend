import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTreeProblems,
  customCodeTreeSchema,
  type CustomCodeRoot,
  type SavedTemplate,
} from '@craftkit/builder-schema';

import { TREE_FIXTURE_VOCAB, treeFixtureDocument } from '../../clipboard/tree-commands.fixture';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { LIBRARY_ELEMENT_PRESETS } from './library-presets';
import { previewSrcdoc, treeClassNames } from './library-preview';
import { LibraryPanel } from './LibraryPanel';
import { LIBRARY_PANEL_LABELS_AR } from './LibraryPanel.labels';

const makeKernel = () =>
  createBuilder({
    document: treeFixtureDocument(),
    extensions: [TREE_FIXTURE_VOCAB],
    ports: { clock: fixedClock(0, 5_000), ids: seededIds('lib') },
  });
type Kernel = ReturnType<typeof makeKernel>;
const treeOf = (kernel: Kernel, id: string) => kernel.getDocument().nodes[id]?.props['tree'] as unknown as CustomCodeRoot;

describe('LibraryPanel', () => {
  beforeAll(() => {
    installBrowserStandIns();
  });

  it.each(['en', 'ar'] as const)('every Elements preset is a valid tree node (%s)', (language) => {
    expect(LIBRARY_ELEMENT_PRESETS).toHaveLength(20);
    for (const preset of LIBRARY_ELEMENT_PRESETS) {
      const tree = { kind: 'root', children: [preset.node(language)] };
      expect({ id: preset.id, problems: customCodeTreeProblems(tree) }).toEqual({ id: preset.id, problems: [] });
      expect(customCodeTreeSchema.safeParse(tree).success, preset.id).toBe(true);
    }
  });

  it('clicking an element inserts it after the focused element — one transaction, one undo', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    act(() => {
      kernel.focusElement('rA', [0]);
    });
    render(<LibraryPanel kernel={kernel} />);
    await user.click(screen.getByRole('button', { name: 'Insert Heading' }));
    const children = treeOf(kernel, 'rA').children;
    expect(children).toHaveLength(3);
    expect(children[1]).toMatchObject({ kind: 'element', tag: 'h2', text: 'A clear heading' });
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Insert · Heading “A clear heading”');
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: 'rA', path: [1] });
    act(() => {
      kernel.undo();
    });
    expect(treeOf(kernel, 'rA').children).toHaveLength(2);
  });

  it('with nothing editable selected an element becomes a new custom section', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(<LibraryPanel kernel={kernel} labels={LIBRARY_PANEL_LABELS_AR} />);
    await user.click(screen.getByRole('button', { name: 'إدراج بطاقة' }));
    const root = kernel.getDocument().nodes['root'];
    expect(root?.slots?.['default']).toHaveLength(4);
    const created = root?.slots?.['default']?.[3] ?? '';
    expect(treeOf(kernel, created).children[0]).toMatchObject({ tag: 'article' });
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: created, path: [0] });
  });

  it('search filters across both languages', async () => {
    const user = userEvent.setup();
    render(<LibraryPanel kernel={makeKernel()} />);
    await user.type(screen.getByRole('searchbox'), 'خريطة');
    const tiles = screen.getAllByRole('button', { name: /^Insert / });
    expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual(['Insert Map embed']);
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzzz');
    expect(screen.getByText('Nothing matches. Try another word.')).toBeInTheDocument();
  });

  it('Sections insert a whole new region; Saved lists templates, inserts and removes them', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    const onRemoveTemplate = vi.fn();
    const sectionTree: CustomCodeRoot = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'section', className: 'p-8', children: [{ kind: 'element', tag: 'h2', text: 'Hero' }] }],
    };
    const templates: Record<string, SavedTemplate> = {
      quote: {
        id: 'quote',
        name: 'Pull quote',
        kind: 'element',
        tree: { kind: 'root', children: [{ kind: 'element', tag: 'blockquote', text: 'Well said.' }] },
        savedAt: '2026-10-05T10:00:00.000Z',
      },
    };
    act(() => {
      kernel.focusElement('rB', [0]);
    });
    render(
      <LibraryPanel
        kernel={kernel}
        sections={[{ id: 'hero-split', name: 'Split hero', group: 'hero', tree: sectionTree }]}
        templates={templates}
        onRemoveTemplate={onRemoveTemplate}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'Sections' }));
    await user.click(screen.getByRole('button', { name: 'Insert Split hero' }));
    const slots = kernel.getDocument().nodes['root']?.slots?.['default'] ?? [];
    expect(slots).toHaveLength(4);
    // After the selected region (rB), not at the end.
    expect(slots[2]).not.toBe('t1');
    expect(treeOf(kernel, slots[2] ?? '').children[0]).toMatchObject({ tag: 'section' });

    await user.click(screen.getByRole('tab', { name: /Saved/u }));
    const saved = screen.getByRole('tabpanel');
    expect(within(saved).getByText('Pull quote')).toBeInTheDocument();
    await user.click(within(saved).getByRole('button', { name: 'Remove Pull quote from Saved' }));
    expect(onRemoveTemplate).toHaveBeenCalledWith('quote');
  });

  it('the Blocks tab is the Palette, composed', async () => {
    const user = userEvent.setup();
    render(<LibraryPanel kernel={makeKernel()} />);
    await user.click(screen.getByRole('tab', { name: 'Blocks' }));
    expect(screen.getByRole('navigation', { name: 'Block palette' })).toBeInTheDocument();
  });

  it('builds thumbnails from the classes a tree uses, sandboxed and directional', () => {
    const tree: CustomCodeRoot = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', className: 'p-4 flex', children: [{ kind: 'icon', name: 'star', className: 'text-accent' }] }],
    };
    expect(treeClassNames(tree)).toEqual(['p-4', 'flex', 'text-accent']);
    const doc = previewSrcdoc({ markup: '<p>Hi</p>', css: 'p{color:red}</style><script>', dir: 'rtl', lang: 'ar' });
    expect(doc).toContain('<html dir="rtl" lang="ar">');
    expect(doc).not.toContain('</style><script>');
  });
});
