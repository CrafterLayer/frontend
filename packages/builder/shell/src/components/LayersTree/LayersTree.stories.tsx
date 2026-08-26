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
  name: 'layers-story-vocab',
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
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['hero', 'body'] } },
    hero: { id: 'hero', type: 'section', props: {}, slots: { default: ['h1'] } },
    h1: { id: 'h1', type: 'text', props: {} },
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
