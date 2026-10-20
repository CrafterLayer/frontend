import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { MetricTrend } from './MetricTrend';

const meta = {
  title: 'Builder/Blocks/MetricTrend',
  component: MetricTrend,
  args: { label: 'Revenue observations', values: [18, 21, 19, 24, 29, 32] },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MetricTrend>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('img', { name: 'Revenue observations' }),
    ).toHaveAccessibleDescription('18 → 21 → 19 → 24 → 29 → 32');
  },
};
export const Flat: Story = { args: { label: 'Stable observations', values: [10, 10, 10] } };
export const Signed: Story = { args: { label: 'Net results', values: [-20, -10, 0, 15] } };
export const Empty: Story = { args: { values: [] } };
export const Invalid: Story = { args: { values: [1, Number.NaN] } };
export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: { label: 'الإيرادات عبر الفترات', values: [12, 18, 16, 24] },
};
