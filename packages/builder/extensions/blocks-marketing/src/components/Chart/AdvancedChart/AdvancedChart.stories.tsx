import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { AdvancedChart } from './AdvancedChart';
import { exampleDrawing } from './fixtures';

const meta = {
  title: 'Builder/Blocks/Chart/AdvancedChart',
  component: AdvancedChart,
  parameters: { layout: 'padded' },
  args: { drawing: exampleDrawing('waterfall') },
} satisfies Meta<typeof AdvancedChart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Waterfall: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('img', { name: 'Operating cash movements' }),
    ).toBeVisible();
  },
};
export const Heatmap: Story = {
  args: { drawing: exampleDrawing('heatmap') },
  globals: { direction: 'rtl' },
};
export const Treemap: Story = { args: { drawing: exampleDrawing('treemap') } };
export const Histogram: Story = { args: { drawing: exampleDrawing('histogram') } };
export const Bubble: Story = { args: { drawing: exampleDrawing('bubble') } };
export const Boxplot: Story = { args: { drawing: exampleDrawing('boxplot') } };
export const Candlestick: Story = { args: { drawing: exampleDrawing('candlestick') } };
export const Lollipop: Story = {
  args: { drawing: exampleDrawing('lollipop') },
  globals: { direction: 'rtl' },
};
export const Bullet: Story = { args: { drawing: exampleDrawing('bullet') } };
export const InvalidData: Story = {
  args: {
    drawing: exampleDrawing('boxplot', { series: [{ name: 'Missing roles', values: [1, 2, 3] }] }),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Min, Q1, Median, Q3, Max',
    );
  },
};
export const Empty: Story = {
  args: { drawing: exampleDrawing('heatmap', { categories: [], series: [] }) },
};
export const Phone: Story = {
  args: { drawing: exampleDrawing('bullet') },
  decorators: [
    (Story) => (
      <div style={{ maxInlineSize: 320 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('img').getBoundingClientRect().width,
    ).toBeLessThanOrEqual(320);
  },
};
