import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { chromeThemeFor, type ChromeChoice } from './chrome-theme';
import { ChromePicker } from './ChromePicker';

const meta = {
  title: 'Playground/ChromePicker',
  component: ChromePicker,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ChromePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveChromePicker() {
  const [value, setValue] = useState<ChromeChoice>('system');
  return (
    <div>
      <ChromePicker value={value} onChange={setValue} />
      <p data-testid="resolved">{String(chromeThemeFor(value))}</p>
    </div>
  );
}

export const Interactive: Story = {
  args: { value: 'system', onChange: () => undefined },
  render: () => <InteractiveChromePicker />,
  play: async ({ canvas, userEvent }) => {
    // The claim worth proving in a real browser is the one jsdom cannot see:
    // that `system` really hands BuilderTheme nothing, so the machine decides.
    await expect(canvas.getByTestId('resolved')).toHaveTextContent('undefined');
    await userEvent.click(canvas.getByRole('radio', { name: 'Editor dark' }));
    await expect(canvas.getByTestId('resolved')).toHaveTextContent('dark');
    await userEvent.click(canvas.getByRole('radio', { name: 'Editor system' }));
    await expect(canvas.getByTestId('resolved')).toHaveTextContent('undefined');
  },
};

export const Overridden: Story = {
  args: { value: 'dark', onChange: () => undefined },
};
