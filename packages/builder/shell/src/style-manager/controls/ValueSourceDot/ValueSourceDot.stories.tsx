import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ValueSourceDot } from './ValueSourceDot';
import { VALUE_SOURCE_DOT_LABELS_AR } from './ValueSourceDot.labels';

const meta = {
  title: 'Builder/Shell/StyleManager/ValueSourceDot',
  component: ValueSourceDot,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { origin: 'here', property: 'Padding', className: 'p-4', onReset: fn() },
} satisfies Meta<typeof ValueSourceDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SetHere: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Padding: Set here' }));
    await userEvent.click(body.getByRole('button', { name: 'Reset' }));
    await expect(args.onReset).toHaveBeenCalledTimes(1);
  },
};

export const InheritedFromLargerScreen: Story = {
  args: { origin: 'larger-bucket', className: 'p-8' },
};

export const FromNamedStyle: Story = {
  args: { origin: 'named-style', className: 'ck-s-card' },
};

export const CustomBreakpoint: Story = {
  args: { customBreakpoint: true, className: 'gap-4' },
};

export const Arabic: Story = {
  args: { property: 'الحشو', labels: VALUE_SOURCE_DOT_LABELS_AR },
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};
