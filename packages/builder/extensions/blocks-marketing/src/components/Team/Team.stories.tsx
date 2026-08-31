import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { teamExamples } from './examples';
import { teamSchema } from './schema';
import { Team } from './Team';

const node: Node = { id: 'team-story', type: 'team', props: {} };
const exampleProps = (index: number) =>
  teamSchema.props.parse((teamExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Team',
  component: Team,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Team>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LeadershipCards: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: /Built by people/i })).toBeInTheDocument();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
  },
};

export const ArabicEditorial: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'team-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const EmptyState: Story = {
  args: {
    node: { ...node, id: 'team-empty' },
    props: teamSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: true,
  },
};
