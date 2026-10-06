import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { TREE_FIXTURE_VOCAB, treeFixtureDocument } from '../../clipboard/tree-commands.fixture';
import { LibraryPanel } from './LibraryPanel';
import { LIBRARY_PANEL_LABELS_AR } from './LibraryPanel.labels';

function kernel(dir: 'ltr' | 'rtl' = 'ltr') {
  const built = createBuilder({
    document: treeFixtureDocument(dir),
    extensions: [TREE_FIXTURE_VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('library-story') },
  });
  built.focusElement('rA', [0]);
  return built;
}

const meta = {
  title: 'Shell/LibraryPanel',
  component: LibraryPanel,
  args: { kernel: kernel() },
  render: (args) => (
    <div style={{ blockSize: '640px', inlineSize: 'var(--bldr-inspector-width)' }}>
      <LibraryPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof LibraryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Elements: Story = {};

export const Sections: Story = {
  args: {
    kernel: kernel(),
    defaultTab: 'sections',
    sections: [
      {
        id: 'hero-centered',
        name: 'Centered hero',
        nameAr: 'بطل في المنتصف',
        group: 'hero',
        tree: {
          kind: 'root',
          children: [
            {
              kind: 'element',
              tag: 'section',
              className: 'flex flex-col items-center gap-4 p-12 text-center',
              children: [{ kind: 'element', tag: 'h1', className: 'text-5xl font-bold', text: 'Make it yours' }],
            },
          ],
        },
      },
    ],
  },
};

export const Saved: Story = {
  args: {
    kernel: kernel(),
    defaultTab: 'saved',
    templates: {
      quote: {
        id: 'quote',
        name: 'Pull quote',
        kind: 'element',
        tree: { kind: 'root', children: [{ kind: 'element', tag: 'blockquote', text: 'Well said.' }] },
        savedAt: '2026-10-05T10:00:00.000Z',
      },
    },
    onRemoveTemplate: () => undefined,
  },
};

export const Arabic: Story = {
  args: { kernel: kernel('rtl'), labels: LIBRARY_PANEL_LABELS_AR },
  render: (args) => (
    <div dir="rtl" lang="ar" style={{ blockSize: '640px', inlineSize: 'var(--bldr-inspector-width)' }}>
      <LibraryPanel {...args} />
    </div>
  ),
};

export const ClickInserts: Story = {
  args: { kernel: kernel() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Insert Divider' }));
    const tree = args.kernel.getDocument().nodes['rA']?.props['tree'] as { children: unknown[] };
    await expect(tree.children).toHaveLength(3);
  },
};
