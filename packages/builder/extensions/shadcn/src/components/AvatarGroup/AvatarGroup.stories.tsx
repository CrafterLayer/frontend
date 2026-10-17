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
    props: avatarGroupSchema.props.parse({ groupLabel: 'No people yet', people: [] }),
    slots: {},
    data: {},
    isCanvas: true,
  },
};

/* Block parts (DESIGN §4.4): each inner element is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node,
    props: {
      ...avatarGroupSchema.props.parse({
        people: [
          { name: 'Maya Chen', imageSrc: '/images/maya.jpg', initials: 'mc' },
          { name: 'Omar Haddad', initials: 'OH' },
        ],
      }),
      partStyles: {
        'person.initials': { className: 'text-accent' },
        'person.initials@0': { className: 'underline' },
      },
    },
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const styled = canvasElement.querySelectorAll('[data-ck-part="person.initials"]');
    await expect(styled.length).toBeGreaterThan(1);
    await expect(styled[0]).toHaveAttribute('data-ck-bind', 'people.0.initials');
    await expect(styled[0]).toHaveClass('underline');
    await expect(styled[1]).toHaveClass('text-accent');
    await expect(styled[1]).not.toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="people"]')).toHaveAttribute(
      'data-ck-bind',
      'people',
    );
  },
};
