import { expect, userEvent, waitFor, within } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { TREE_FIXTURE_VOCAB, treeFixtureDocument } from '../../clipboard/tree-commands.fixture';
import { createElementSelection } from '../../selection/element-selection';
import { LayersTree } from './LayersTree';
import { LAYERS_TREE_LABELS_AR } from './LayersTree.labels';

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

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'layers-story-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block(
        'page',
        'The page root. Holds top-level sections in order. Exactly one per document; never nested.',
        { default: { allow: ['hero', 'section'] } },
      ),
      block(
        'hero',
        'Opening section at the top of a page: a large heading, optional supporting body, and up to two call-to-action buttons. Use once per page.',
        { default: { allow: ['cta'] } },
      ),
      block(
        'cta',
        'A call-to-action button with a short label and an emphasis level; optionally a small supporting note underneath.',
      ),
      block('section', 'A structural section that groups related page content.', {
        default: { allow: ['text', 'section'] },
      }),
      block('text', 'A paragraph of editable text content.'),
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['hero', 'body'] } },
    hero: {
      id: 'hero',
      type: 'hero',
      props: {},
      slots: { default: ['cta-start', 'cta-docs'] },
    },
    'cta-start': { id: 'cta-start', type: 'cta', props: {} },
    'cta-docs': { id: 'cta-docs', type: 'cta', props: {} },
    body: { id: 'body', type: 'section', props: {}, slots: { default: ['p1', 'nested'] } },
    p1: { id: 'p1', type: 'text', props: {} },
    nested: { id: 'nested', type: 'section', props: {}, slots: { default: ['p2'] } },
    p2: { id: 'p2', type: 'text', props: {} },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('ls') },
  });

const meta = {
  title: 'Builder/Shell/LayersTree',
  component: LayersTree,
  decorators: [
    (Story) => (
      <div className="bldr-root">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LayersTree>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { kernel: makeKernel() },
};

export const DeepNesting: Story = {
  args: { kernel: makeKernel() },
};

const syncKernel = makeKernel();
export const SelectionSync: Story = {
  args: { kernel: syncKernel },
  play: async ({ canvasElement }) => {
    // Idempotent both directions: click a row ⇒ kernel selection; set the
    // kernel ⇒ row highlight.
    const rows = within(canvasElement).getAllByRole('treeitem');
    const heroRow = rows.at(1);
    if (heroRow === undefined) {
      throw new Error('expected a hero row');
    }
    await userEvent.click(heroRow);
    await expect(syncKernel.context.store.getState().selection).toEqual(['hero']);

    syncKernel.setSelection(['p2']);
    await waitFor(async () => {
      const selected = within(canvasElement)
        .getAllByRole('treeitem')
        .find((row) => row.getAttribute('aria-selected') === 'true');
      await expect(selected?.textContent).toContain('Text');
    });
  },
};

// ── P8-manual-editor: element trees (style-manager DESIGN.md §E) ──

const elementKernel = (dir: 'ltr' | 'rtl' = 'ltr') =>
  createBuilder({
    document: treeFixtureDocument(dir),
    extensions: [TREE_FIXTURE_VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('layers-elements') },
  });

const treeKernel = elementKernel();
export const ElementTrees: Story = {
  args: {
    kernel: treeKernel,
    selection: createElementSelection(treeKernel),
    bucket: 'mobile',
    onSaveTemplate: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Our story')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Hide Heading on mobile' }));
    await expect(canvas.getByRole('button', { name: 'Hide Heading on mobile' })).toHaveAttribute('aria-pressed', 'true');
  },
};

const rtlKernel = elementKernel('rtl');
export const ArabicElementTrees: Story = {
  args: { kernel: rtlKernel, selection: createElementSelection(rtlKernel), labels: LAYERS_TREE_LABELS_AR },
  render: (args) => (
    <div dir="rtl" lang="ar" style={{ inlineSize: 'var(--bldr-inspector-width)' }}>
      <LayersTree {...args} />
    </div>
  ),
};
