import { useState } from 'react';
import { expect, screen, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StyleValue } from '@craftkit/builder-schema';

import { STYLE_COLOR_CONTROL_LABELS_AR } from '../StyleColorControl';
import { ColorField, type ColorFieldProps } from './ColorField';
import { COLOR_FIELD_LABELS_AR } from './ColorField.labels';

const tokens = [
  { id: 'surface', name: 'Surface', css: '#ffffff' },
  { id: 'text', name: 'Text', css: '#111827' },
  { id: 'text-muted', name: 'Muted text', css: '#9ca3af' },
  { id: 'accent', name: 'Accent', css: '#2563eb' },
];

function Controlled(props: ColorFieldProps) {
  const [value, setValue] = useState<StyleValue | undefined>(props.value);
  return (
    <ColorField
      {...props}
      value={value}
      onCommit={(next) => {
        setValue(next ?? undefined);
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/ColorField',
  component: ColorField,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story, context) => (
      <div
        className="bldr-root"
        data-bldr-theme={context.name.includes('Dark') ? 'dark' : 'light'}
        dir={context.args.dir}
        style={{ background: 'var(--bldr-panel)', maxInlineSize: '14rem', padding: '16px' }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'Background colour',
    value: { kind: 'token', token: 'accent' },
    mode: 'free',
    tokens,
    palette: [{ id: 'brand-600', name: 'Brand 600', css: '#0f766e' }],
    dir: 'ltr',
    onCommit: () => undefined,
  },
} satisfies Meta<typeof ColorField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /^Background colour:/u }));
    const group = await screen.findByRole('radiogroup', { name: 'Background colour' });
    await userEvent.click(within(group).getByRole('radio', { name: 'Surface' }));
    await expect(within(group).getByRole('radio', { name: 'Surface' })).toHaveAttribute('aria-checked', 'true');
  },
};
export const Dark: Story = {};
export const CustomHex: Story = { args: { value: { kind: 'raw', css: '#e11d48cc' } } };
export const LowContrast: Story = {
  args: { label: 'Text colour', value: { kind: 'token', token: 'text-muted' }, contrastWith: '#ffffff' },
};
export const Unset: Story = { args: { value: undefined } };
export const ArabicLight: Story = {
  args: {
    dir: 'rtl',
    label: 'لون الخلفية',
    labels: COLOR_FIELD_LABELS_AR,
    controlLabels: STYLE_COLOR_CONTROL_LABELS_AR,
  },
};
export const ArabicDark: Story = { args: { ...ArabicLight.args } };
