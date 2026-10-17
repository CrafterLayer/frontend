import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { darkTheme } from '@craftkit/builder-renderer';

import { defaultBlocks } from '../../default-blocks';
import { Builder } from './Builder';

function presetKernel(dir: 'ltr' | 'rtl' = 'ltr') {
  return createBuilder({
    dir,
    extensions: [defaultBlocks],
    ports: { clock: fixedClock(), ids: seededIds('story') },
  });
}

const meta = {
  title: 'Builder/Preset/Builder',
  component: Builder,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Builder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyPage: Story = {
  args: { kernel: presetKernel() },
};

export const DarkTheme: Story = {
  args: { kernel: presetKernel(), theme: darkTheme },
};

export const RightToLeft: Story = {
  args: { kernel: presetKernel('rtl') },
};
