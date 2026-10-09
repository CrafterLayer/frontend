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

// library-playground additions (2026-10-08): the top-level Templates tab of photo cards.
const STORY_CARDS = [
  {
    id: 'story-restaurant',
    templateKey: 'restaurant',
    lang: 'en',
    category: 'restaurant',
    name: { en: 'Restaurant', ar: 'مطعم بيت الزيتون' },
    description: { en: 'A menu with prices, a gallery and table booking.', ar: 'قائمة بالأسعار ومعرض صور وحجز طاولة.' },
    sections: 10,
    thumbnail: {
      src: 'https://images.pexels.com/photos/8585881/pexels-photo-8585881.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: 'Restaurant table filled with shared dishes',
    },
  },
  {
    id: 'story-restaurant-ar',
    templateKey: 'restaurant',
    lang: 'ar',
    category: 'restaurant',
    name: { en: 'Restaurant', ar: 'مطعم بيت الزيتون' },
    description: { en: 'A menu with prices, a gallery and table booking.', ar: 'قائمة بالأسعار ومعرض صور وحجز طاولة.' },
    sections: 10,
    thumbnail: {
      src: 'https://images.pexels.com/photos/8585881/pexels-photo-8585881.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: 'مائدة مطعم مليئة بالأطباق المشتركة',
    },
  },
] as const;

function templatesKernel() {
  const built = kernel();
  built.extensions.hydrateDeclarative({
    tier: 2,
    name: 'library-story-templates',
    version: '1.0.0',
    contributes: {
      compositions: STORY_CARDS.map((card) => ({
        id: card.id,
        name: card.name[card.lang],
        version: 1,
        surfaces: ['site'],
        rootId: `${card.id}-text`,
        nodes: { [`${card.id}-text`]: { id: `${card.id}-text`, type: 'text', props: {} } },
      })),
    },
  });
  return built;
}

export const Templates: Story = {
  args: { kernel: templatesKernel(), templateCards: STORY_CARDS, defaultTab: 'templates' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Other language' })).toBeInTheDocument();
    const [first] = canvas.getAllByRole('button', { name: 'Insert template Restaurant' });
    if (first !== undefined) await userEvent.click(first);
  },
};
// end library-playground additions
