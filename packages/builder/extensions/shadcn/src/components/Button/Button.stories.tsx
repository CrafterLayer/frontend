import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { Button } from './Button';
import { buttonSchema } from './schema';

const node: Node = { id: 'button-story', type: 'button', props: {} };

const meta = {
  title: 'Builder/Shadcn/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    node,
    props: buttonSchema.props.parse({
      label: 'Start building',
      href: '/signup',
      size: 'large',
      radius: 'pill',
      icon: 'arrow',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Solid: Story = {};

export const Outline: Story = {
  args: { props: buttonSchema.props.parse({ label: 'View work', variant: 'outline' }) },
};

export const Ghost: Story = {
  args: { props: buttonSchema.props.parse({ label: 'Maybe later', variant: 'ghost' }) },
};

export const FullWidth: Story = {
  args: {
    props: buttonSchema.props.parse({ label: 'Continue', width: 'full', icon: 'arrow' }),
  },
};
