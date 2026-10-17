import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '@craftkit/builder-core/testing';

import { HistoryList } from './HistoryList';
import { HISTORY_LIST_LABELS_AR } from './HistoryList.labels';

function kernelWithSteps() {
  const kernel = createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(0, 90_000), ids: seededIds('story') },
  });
  kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'A calmer welcome.' });
  kernel.dispatchGroup([{ command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Built by hand' } }], {
    author: 'ai',
    label: 'Heading · Hero',
  });
  kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Welcome back.' });
  return kernel;
}

const meta = {
  title: 'Shell/HistoryList',
  component: HistoryList,
  args: { kernel: kernelWithSteps(), now: () => 400_000, refreshMs: 0 },
  render: (args) => (
    <div style={{ inlineSize: 'var(--bldr-inspector-width)' }}>
      <HistoryList {...args} />
    </div>
  ),
} satisfies Meta<typeof HistoryList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const JumpBack: Story = {
  args: { kernel: kernelWithSteps() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [, first] = canvas.getAllByRole('button');
    if (first === undefined) throw new Error('expected a history step');
    await userEvent.click(first);
    await expect(first).toHaveAttribute('aria-current', 'step');
  },
};

export const Arabic: Story = {
  args: { kernel: kernelWithSteps(), labels: HISTORY_LIST_LABELS_AR },
  render: (args) => (
    <div dir="rtl" lang="ar" style={{ inlineSize: 'var(--bldr-inspector-width)' }}>
      <HistoryList {...args} />
    </div>
  ),
};

export const Empty: Story = {
  args: {
    kernel: createBuilder({ document: landingFixture(), extensions: [fixtureBlocks] }),
  },
};
