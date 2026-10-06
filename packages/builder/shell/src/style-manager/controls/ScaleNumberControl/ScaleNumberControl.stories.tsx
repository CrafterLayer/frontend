import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StyleValue } from '@craftkit/builder-schema';

import { ScaleNumberControl, type ScaleNumberControlProps } from './ScaleNumberControl';
import { spacingModel } from './spacing-model';

function Controlled(props: ScaleNumberControlProps) {
  const [value, setValue] = useState<StyleValue | undefined>(props.value);
  return (
    <ScaleNumberControl
      {...props}
      value={value}
      onCommit={(next) => {
        setValue(next ?? undefined);
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/ScaleNumberControl',
  component: ScaleNumberControl,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '12rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'Padding',
    value: { kind: 'token', token: '4' },
    model: spacingModel(['0', 'px', '1', '2', '3', '4', '6', '8', '12', '16']),
    units: ['px', 'rem', '%'],
    keywords: ['auto'],
    onCommit: () => undefined,
  },
} satisfies Meta<typeof ScaleNumberControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Spacing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton', { name: 'Padding' });
    input.focus();
    await userEvent.keyboard('{PageUp}');
    await expect(input).toHaveValue('24');
  },
};

export const TokensOnly: Story = { args: { mode: 'tokens' } };

export const Mixed: Story = { args: { mixed: true, value: undefined } };
