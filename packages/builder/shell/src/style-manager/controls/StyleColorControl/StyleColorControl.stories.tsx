import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StyleValue } from '@craftkit/builder-schema';

import { StyleColorControl, type StyleColorControlProps } from './StyleColorControl';
import { STYLE_COLOR_CONTROL_LABELS_AR } from './StyleColorControl.labels';

function Controlled(props: StyleColorControlProps) {
  const [value, setValue] = useState<StyleValue | undefined>(props.value);
  return (
    <StyleColorControl
      {...props}
      value={value}
      onCommit={(next) => {
        setValue(next ?? undefined);
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/StyleColorControl',
  component: StyleColorControl,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'Text colour',
    value: { kind: 'token', token: 'accent' },
    mode: 'free',
    tokens: [
      { id: 'surface', name: 'Surface', css: '#ffffff' },
      { id: 'text', name: 'Text', css: '#111827' },
      { id: 'text-muted', name: 'Muted text', css: '#9ca3af' },
      { id: 'accent', name: 'Accent', css: '#2563eb' },
    ],
    palette: [
      { id: 'brand-600', name: 'Brand 600', css: '#0f766e' },
      { id: 'sand', name: 'Sand', css: '#e7d8b8' },
    ],
    contrastWith: '#ffffff',
    onCommit: () => undefined,
  },
} satisfies Meta<typeof StyleColorControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Free: Story = {};
export const TokensOnly: Story = { args: { mode: 'tokens' } };
export const LowContrast: Story = { args: { value: { kind: 'token', token: 'text-muted' } } };
export const Arabic: Story = {
  args: { labels: STYLE_COLOR_CONTROL_LABELS_AR, label: 'لون النص', dir: 'rtl' },
};
