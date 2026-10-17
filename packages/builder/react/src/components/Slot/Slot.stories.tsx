import type { Meta, StoryObj } from '@storybook/react-vite';

import { landingFixture } from '@craftkit/builder-core/testing';

import { Slot } from './Slot';

const heroNode = landingFixture().nodes['hero1'];
if (heroNode === undefined) {
  throw new Error('landing fixture changed: hero1 missing');
}

const meta = {
  title: 'Builder/React/Slot',
  component: Slot,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Slot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OrderedChildIds: Story = {
  args: {
    node: heroNode,
    name: 'actions',
    children: (ids) => (
      <ol>
        {ids.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ol>
    ),
  },
};

export const EmptySlot: Story = {
  args: {
    node: heroNode,
    name: 'missing-slot',
    children: (ids) => <p>{ids.length === 0 ? 'No children.' : 'Unexpected.'}</p>,
  },
};
