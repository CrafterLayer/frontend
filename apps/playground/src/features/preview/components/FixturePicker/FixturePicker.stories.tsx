import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { PlaygroundFixture } from '../../create-playground-kernel';
import { FixturePicker } from './FixturePicker';

const meta = {
  title: 'Playground/FixturePicker',
  component: FixturePicker,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof FixturePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveFixturePicker() {
  const [value, setValue] = useState<PlaygroundFixture>('landing');
  return <FixturePicker value={value} onChange={setValue} />;
}

export const Interactive: Story = {
  args: { value: 'landing', onChange: () => undefined },
  render: () => <InteractiveFixturePicker />,
};
