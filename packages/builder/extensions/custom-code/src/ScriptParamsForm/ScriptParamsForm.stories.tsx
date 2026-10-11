import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type CSSProperties } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { ScriptParamsForm } from './index';
import { SCRIPT_PARAMS_FORM_SPEC } from './ScriptParamsForm.fixture';

const meta = {
  title: 'Builder/Extensions/ScriptParamsForm',
  component: ScriptParamsForm,
  parameters: { layout: 'centered' },
  args: { spec: SCRIPT_PARAMS_FORM_SPEC, values: {}, onChange: fn() },
  render: function Render(args) {
    // Portable story tests do not re-render on useArgs updates. React state
    // represents the host's committed values in both the catalog and Chromium.
    const [stored, setStored] = useState({ initial: args.values, values: args.values });
    const values = stored.initial === args.values ? stored.values : args.values;
    return (
      <div className="bldr-root" style={{ inlineSize: 288, maxInlineSize: '100%' }}>
        <ScriptParamsForm
          {...args}
          values={values}
          onChange={(values, change) => {
            args.onChange(values, change);
            if (change.commit) setStored({ initial: args.values, values });
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof ScriptParamsForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const pointer = canvas.getByRole('switch');
    const next = pointer.getAttribute('aria-checked') !== 'true';
    await userEvent.click(pointer);
    await expect(pointer).toHaveAttribute('aria-checked', String(next));
    await expect(args.onChange).toHaveBeenLastCalledWith(next ? { pointer: true } : {}, {
      commit: true,
    });
  },
};
export const Changed: Story = {
  args: { values: { title: 'Welcome', speed: 2, color: '#4f46e5' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole('textbox', { name: 'Title' });
    // A rerun of Interactions must exercise reset again, not rely on initial args.
    if (canvas.queryByRole('button', { name: 'Reset Title' }) === null) {
      await userEvent.clear(title);
      await userEvent.type(title, 'Welcome{Enter}');
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Reset Title' }));
    await expect(title).toHaveValue('Hello');
  },
};
export const CustomPalette: Story = { args: { values: { palette: ['#e8a33d', '#2f6f73'] } } };
export const AssetsAndSounds: Story = {
  args: {
    assets: [
      {
        id: 'photo',
        label: 'Site photo',
        url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      },
    ],
    soundOptions: [{ value: 'lib:chime', label: { en: 'Chime', ar: 'رنين' } }],
  },
};
export const Empty: Story = { args: { spec: [] } };
export const Disabled: Story = {
  args: { disabled: true, values: { pointer: true, palette: ['#e8a33d'] } },
};
export const Arabic: Story = { args: { locale: 'ar', dir: 'rtl' }, globals: { direction: 'rtl' } };
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div
        style={
          {
            background: '#111827',
            padding: 16,
            '--ck-bg': '#111827',
            '--ck-fg': '#f9fafb',
            '--ck-border': '#4b5563',
            '--ck-fg-muted': '#cbd5e1',
          } as CSSProperties
        }
      >
        <Story />
      </div>
    ),
  ],
};
export const InvalidColour: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hex = canvas.getByRole('textbox', { name: 'Accent hex' });
    await userEvent.clear(hex);
    await userEvent.type(hex, 'invalid');
    await expect(hex).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByRole('status')).toHaveTextContent('Use a #hex colour');
  },
};
