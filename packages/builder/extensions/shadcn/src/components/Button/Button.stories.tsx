import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { Button } from './Button';
import { buttonSchema } from './schema';

const node: Node = { id: 'button-story', type: 'button', props: {} };

const meta = {
  title: 'Builder/Shadcn/Button',
  component: Button,
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

/**
 * Block parts on the canvas: every inner element carries its part address
 * (`data-ck-part` / `data-ck-bind`), which the canvas hit test, the outline,
 * the quick bar and inline editing read. A published render carries none.
 */
export const Parts: Story = {
  args: {
    node: { id: 'button-parts', type: 'button', props: {} },
    props: buttonSchema.props.parse({ label: 'Start building', href: '/signup', icon: 'arrow' }),
    slots: {},
    data: {},
    isCanvas: true,
  },
};
