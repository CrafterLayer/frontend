import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder';

import { Announcement } from './Announcement';

const node: Node = { id: 'ann-story', type: 'announcement', props: {} };

const meta = {
  title: 'Playground/Announcement',
  component: Announcement,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Announcement>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: {
    node,
    props: { message: 'Registered at runtime — no reload.', tone: 'info' },
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const SuccessArabic: Story = {
  globals: { direction: 'rtl' },
  args: {
    ...Info.args,
    props: { message: 'شحن مجاني هذا الأسبوع', tone: 'success' },
  },
};
