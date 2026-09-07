import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { COLOR_TOKENS, MEASUREMENT_TOKENS, defaultDesignSystem } from '@craftkit/builder-schema';

import { TokenSwatchGrid } from './TokenSwatchGrid';

const tokens = defaultDesignSystem().tokens;

const meta = {
  title: 'Shell/TokenSwatchGrid',
  component: TokenSwatchGrid,
  parameters: { layout: 'padded' },
  args: { tokens, names: COLOR_TOKENS, label: 'Colour tokens', columns: 3 },
  argTypes: { tokens: { control: false }, names: { control: false } },
} satisfies Meta<typeof TokenSwatchGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The colour roles a design system publishes, each named and valued in text. */
export const ColourRoles: Story = {};

/** Measurements share the grid: they have no colour, and needed no second component. */
export const Measurements: Story = {
  args: { names: MEASUREMENT_TOKENS, label: 'Measurement tokens' },
};

/** Every token at once — the case a narrow panel has to survive. */
export const Overflow: Story = {
  args: { names: [...COLOR_TOKENS, ...MEASUREMENT_TOKENS], label: 'Every token', columns: 2 },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '18rem', border: '1px dashed var(--bldr-panel-border)' }}>
        <Story />
      </div>
    ),
  ],
};

/** Arrow keys move by row and column; one Tab gets past the whole grid. */
export const Keyboard: Story = {
  args: { onSelect: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');

    await userEvent.tab();
    await expect(buttons[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{ArrowDown}');
    await expect(buttons[4]).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
  },
};

/** RTL: the grid reads right to left and the arrow keys still mean row and column. */
export const RightToLeft: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};
