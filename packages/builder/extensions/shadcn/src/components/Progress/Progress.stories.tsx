import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Progress } from './Progress';
import { progressSchema } from './schema';

const node: Node = { id: 'progress-story', type: 'progress', props: {} };

const meta = {
  title: 'Builder/Shadcn/Progress',
  component: Progress,
  parameters: { layout: 'padded' },
  args: {
    node,
    props: progressSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: false,
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('progressbar', { name: 'Project progress' })).toHaveAttribute(
      'aria-valuetext',
      '64%',
    );
  },
};

export const CompletedSuccess: Story = {
  args: {
    props: progressSchema.props.parse({
      label: 'Onboarding complete',
      value: 5,
      max: 5,
      variant: 'success',
      size: 'small',
    }),
  },
};

export const LargeNeutral: Story = {
  args: {
    props: progressSchema.props.parse({
      label: 'Storage used',
      value: 780,
      max: 1000,
      variant: 'neutral',
      size: 'large',
      radius: 'large',
    }),
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    props: progressSchema.props.parse({
      label: 'اكتمل إعداد المتجر',
      value: 7,
      max: 10,
      size: 'large',
    }),
  },
};
