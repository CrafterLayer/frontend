import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ChoiceGroup, type ChoiceGroupProps } from './ChoiceGroup';

const OPTIONS = [
  { value: 'block', label: 'Block' },
  { value: 'flex', label: 'Flex' },
  { value: 'grid', label: 'Grid' },
  { value: 'none', label: 'None' },
];

function Controlled(props: ChoiceGroupProps) {
  const [value, setValue] = useState(props.value);
  return <ChoiceGroup {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: 'Builder/Shell/StyleManager/ChoiceGroup',
  component: ChoiceGroup,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '18rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { label: 'Display', options: OPTIONS, value: 'flex', dir: 'ltr', onChange: () => undefined },
} satisfies Meta<typeof ChoiceGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('radio', { name: 'Flex' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('radio', { name: 'Grid' })).toHaveAttribute('aria-checked', 'true');
  },
};

export const RightToLeft: Story = { args: { dir: 'rtl' } };

export const Mixed: Story = { args: { mixed: true } };
