import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { DocumentView } from './DocumentView';

function storyKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('story') },
  });
}

const meta = {
  title: 'Builder/Renderer/DocumentView',
  component: DocumentView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DocumentView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LandingFixture: Story = {
  args: { kernel: storyKernel() },
};

export const MobileBreakpoint: Story = {
  args: { kernel: storyKernel(), breakpoint: 'mobile' },
};
