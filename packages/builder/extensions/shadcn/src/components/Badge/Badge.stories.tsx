import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { Badge } from './Badge';
import { badgeSchema } from './schema';

const node: Node = { id: 'badge', type: 'badge', props: {} };

const meta = {
  title: 'Builder/Shadcn/Badge',
  component: Badge,
  args: { node, slots: {}, data: {}, isCanvas: false },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accent: Story = { args: { props: badgeSchema.props.parse({ label: 'New' }) } };

export const Success: Story = {
  args: { props: badgeSchema.props.parse({ label: 'Most popular', variant: 'success' }) },
};

export const Outline: Story = {
  args: { props: badgeSchema.props.parse({ label: 'Beta', variant: 'outline', size: 'small' }) },
};

/** RTL is a standing requirement of this repository, not an extra. */
export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: { props: badgeSchema.props.parse({ label: 'الأكثر شيوعاً', variant: 'success' }) },
};

/**
 * Block parts on the canvas: every inner element carries its part address
 * (`data-ck-part` / `data-ck-bind`), which the canvas hit test, the outline,
 * the quick bar and inline editing read. A published render carries none.
 */
export const Parts: Story = {
  args: {
    node: { id: 'badge-parts', type: 'badge', props: {} },
    props: badgeSchema.props.parse({ label: 'Beta' }),
    slots: {},
    data: {},
    isCanvas: true,
  },
};
