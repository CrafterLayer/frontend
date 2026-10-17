import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ELEMENT_NAME_WORDS_AR } from '../../custom-code/element-target';
import { makePartTestKernel, PROMO_ID } from '../../style-manager/part-test-kernel';
import { buildLayerRows } from './layers-rows';
import { withPartRows, type PartLayerRow } from './layers-part-rows';
import { LayersPartRow } from './LayersPartRow';
import { LAYERS_PART_LABELS_EN } from './LayersPartRow.labels';
import { LayersTree } from './LayersTree';
import { LAYERS_TREE_LABELS_AR } from './LayersTree.labels';

function sampleRow(part: string, index: number[] = []): PartLayerRow {
  const kernel = makePartTestKernel();
  const doc = kernel.getDocument();
  const row = withPartRows(kernel, doc, buildLayerRows(kernel, doc, () => ['default'], new Set()), new Set()).find(
    (candidate): candidate is PartLayerRow =>
      candidate.kind === 'part' && candidate.ref.part === part && candidate.ref.index.join('.') === index.join('.'),
  );
  if (row === undefined) throw new Error(`no ${part} row`);
  return row;
}

const noop = () => undefined;

const meta = {
  title: 'Builder/Shell/LayersTree/LayersPartRow',
  component: LayersPartRow,
  decorators: [
    (Story) => (
      <div className="bldr-root bldr-layers" style={{ inlineSize: 'var(--bldr-inspector-width)' }}>
        <ul role="tree" className="bldr-layers__tree" aria-label="Parts">
          <Story />
        </ul>
      </div>
    ),
  ],
  args: {
    row: sampleRow('heading'),
    name: 'Heading',
    preview: 'Build faster',
    description: 'Heading · Promo',
    glyph: 'T',
    selected: false,
    tabbable: true,
    collapsed: false,
    labels: LAYERS_PART_LABELS_EN,
    registerRow: noop,
    onSelect: noop,
    onToggleExpanded: noop,
    onRowKeyDown: noop,
    onRowFocus: noop,
  },
} satisfies Meta<typeof LayersPartRow>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A text part: its label, a kind glyph and an isolated preview of its words. */
export const TextPart: Story = {};

/** A selected item: Duplicate, Move up / down and Remove stay in view. */
export const SelectedItem: Story = {
  args: {
    row: sampleRow('item', [1]),
    name: 'Feature 2',
    preview: 'Safe',
    description: 'Feature 2 · Promo',
    glyph: '•',
    selected: true,
    onAction: noop,
  },
};

/** An English preview in an Arabic tree: `<bdi>` keeps its full stop at the end. */
export const MixedDirectionPreview: Story = {
  args: { preview: 'Every edit is one undo.', name: 'الوصف', description: 'الوصف · Promo' },
  render: (args) => (
    <div dir="rtl" lang="ar">
      <LayersPartRow {...args} />
    </div>
  ),
};

const treeKernel = makePartTestKernel();
/** The whole tree: the block's parts below its row; a click focuses the part. */
export const InTheTree: Story = {
  render: () => <LayersTree kernel={treeKernel} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('treeitem', { name: /^Heading/u }));
    await expect(treeKernel.context.store.getState().partFocus).toEqual({
      id: PROMO_ID,
      part: 'heading',
      index: [],
    });
  },
};

const arabicKernel = makePartTestKernel({ dir: 'rtl' });
export const ArabicTree: Story = {
  render: () => (
    <div dir="rtl" lang="ar">
      <LayersTree kernel={arabicKernel} labels={LAYERS_TREE_LABELS_AR} words={ELEMENT_NAME_WORDS_AR} />
    </div>
  ),
};
