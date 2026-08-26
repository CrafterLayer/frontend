import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { EditMode } from './EditMode';

const meta = {
  title: 'Playground/EditMode',
  component: EditMode,
  args: { value: false, onChange: () => undefined },
} satisfies Meta<typeof EditMode>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = { args: { value: true } };

export const Toggles: Story = {
  render: function ToggleDemo() {
    const [value, setValue] = useState(false);
    return <EditMode value={value} onChange={setValue} />;
  },
  play: async ({ canvasElement }) => {
    const checkbox = within(canvasElement).getByRole('checkbox', { name: 'Edit mode' });
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  },
};
