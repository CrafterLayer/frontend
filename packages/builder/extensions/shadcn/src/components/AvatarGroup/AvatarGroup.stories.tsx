import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { AvatarGroup } from './AvatarGroup';
import { avatarGroupExamples } from './examples';
import { avatarGroupSchema } from './schema';

const node: Node = { id: 'avatar-group-story', type: 'avatarGroup', props: {} };
const exampleProps = (index: number) =>
  avatarGroupSchema.props.parse((avatarGroupExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Shadcn/Avatar Group',
  component: AvatarGroup,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AvatarGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectTeam: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('list', { name: 'Project team' })).toBeVisible();
    await expect(canvas.getByRole('listitem', { name: 'More people: 1' })).toBeVisible();
  },
};

export const ArabicRounded: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'avatar-group-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const CompactCustomers: Story = {
  args: {
    node: { ...node, id: 'avatar-group-compact' },
    props: exampleProps(2),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const Empty: Story = {
  args: {
    node: { ...node, id: 'avatar-group-empty' },
    props: avatarGroupSchema.props.parse({ groupLabel: 'No people yet' }),
    slots: {},
    data: {},
    isCanvas: true,
  },
};
