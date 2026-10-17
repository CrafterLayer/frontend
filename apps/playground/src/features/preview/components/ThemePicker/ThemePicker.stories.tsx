import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ThemePicker, type ThemeName } from './ThemePicker';

const meta = {
  title: 'Playground/ThemePicker',
  component: ThemePicker,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ThemePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveThemePicker() {
  const [value, setValue] = useState<ThemeName>('light');
  return <ThemePicker value={value} onChange={setValue} />;
}

export const Interactive: Story = {
  args: { value: 'light', onChange: () => undefined },
  render: () => <InteractiveThemePicker />,
};

export const Arabic: Story = {
  args: {
    value: 'light',
    onChange: () => undefined,
    labels: { legend: 'سمة الصفحة', choices: { light: 'فاتحة', dark: 'داكنة' } },
  },
};
