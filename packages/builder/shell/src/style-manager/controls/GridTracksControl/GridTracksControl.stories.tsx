import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StyleValue } from '@craftkit/builder-schema';

import { GridTracksControl, type GridTracksControlProps } from './GridTracksControl';

function Controlled(props: GridTracksControlProps) {
  const [value, setValue] = useState<StyleValue | undefined>(props.value);
  return (
    <GridTracksControl
      {...props}
      value={value}
      onCommit={(next) => {
        setValue(next ?? undefined);
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/GridTracksControl',
  component: GridTracksControl,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { label: 'Grid columns', value: { kind: 'raw', css: '1fr 2fr 1fr' }, onCommit: () => undefined },
} satisfies Meta<typeof GridTracksControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Template: Story = {};
export const CountOnly: Story = { args: { mode: 'tokens', value: { kind: 'token', token: '3' } } };
