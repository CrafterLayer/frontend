import type { ReactNode } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';
import type {
  BlockRenderComponent,
  BlockRenderProps,
  TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { NodeView, type InlineEditSeam } from './NodeView';

function storyKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('story') },
  });
}

const meta = {
  title: 'Builder/Renderer/NodeView',
  component: NodeView,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof NodeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleNode: Story = {
  args: { kernel: storyKernel(), id: 'p1', breakpoint: 'desktop' },
};

export const UnknownType: Story = {
  args: { kernel: createBuilder(), id: 'root', breakpoint: 'desktop' },
};

// ── block-parts (2026-10-06) ──
const ListBlock = (({ props }: BlockRenderProps<Record<string, unknown>>) => {
  const items = (Array.isArray(props['items']) ? props['items'] : []) as readonly {
    title: ReactNode;
  }[];
  return (
    <ol>
      {items.map((item, index) => (
        <li key={index} data-testid={`item-${String(index)}`}>
          {item.title}
        </li>
      ))}
    </ol>
  );
}) as BlockRenderComponent;

const listBlocks: TrustedExtensionManifest = {
  ...fixtureBlocks,
  name: 'node-view-story-list',
  contributes: {
    ...fixtureBlocks.contributes,
    blocks: (fixtureBlocks.contributes?.blocks ?? []).map((contribution) =>
      contribution.schema.type === 'text' ? { ...contribution, render: ListBlock } : contribution,
    ),
  },
};

function listKernel() {
  const document = landingFixture();
  const paragraph = document.nodes['p1'];
  const nodes =
    paragraph === undefined
      ? document.nodes
      : {
          ...document.nodes,
          p1: {
            ...paragraph,
            props: {
              ...paragraph.props,
              items: [{ title: 'Fast' }, { title: 'سريع ومرن' }, { title: 'Accessible' }],
            },
          },
        };
  return createBuilder({
    document: { ...document, nodes },
    extensions: [listBlocks],
    ports: { clock: fixedClock(), ids: seededIds('story-list') },
  });
}

/** A fixed seam: the second item's title is open for editing. */
const nestedSeam: InlineEditSeam = {
  subscribe: () => () => undefined,
  getSnapshot: (nodeId) =>
    nodeId === 'p1'
      ? {
          propKey: 'items',
          bind: 'items.1.title',
          render: ({ value }) => (
            <mark data-testid="editor" dir="auto">
              {typeof value === 'string' ? value : ''}
            </mark>
          ),
        }
      : null,
};

/**
 * A block part inside an array edits IN PLACE: only `items.1.title` becomes the
 * editor; the other items render exactly as stored.
 */
export const NestedPartEdit: Story = {
  args: { kernel: listKernel(), id: 'p1', breakpoint: 'desktop', inlineEdit: nestedSeam },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('item-1')).toContainElement(canvas.getByTestId('editor'));
    await expect(canvas.getByTestId('editor')).toHaveTextContent('سريع ومرن');
    await expect(canvas.getByTestId('item-0')).toHaveTextContent('Fast');
    await expect(canvas.getByTestId('item-2')).toHaveTextContent('Accessible');
  },
};
// ── /block-parts ──
