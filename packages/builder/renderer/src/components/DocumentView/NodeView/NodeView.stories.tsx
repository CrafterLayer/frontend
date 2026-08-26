import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { NodeView } from './NodeView';

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
