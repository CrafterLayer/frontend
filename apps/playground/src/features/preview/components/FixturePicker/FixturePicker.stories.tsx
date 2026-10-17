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

export const Arabic: Story = {
  args: {
    value: 'empty',
    onChange: () => undefined,
    labels: {
      label: 'المستند التجريبي',
      fixtures: {
        landing: 'صفحة تسويقية',
        empty: 'صفحة فارغة',
        inline: 'تحرير مباشر',
        'code-view': 'عرض الشيفرة',
        'code-page': 'صفحة TSX مكتوبة',
      },
    },
  },
};
