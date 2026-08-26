import { useState } from 'react';

import { expect, userEvent, within } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { NumberField } from './NumberField';
import { ReadOnlyField } from './ReadOnlyField';
import { SelectField } from './SelectField';
import { SwitchField } from './SwitchField';
import { TextField } from './TextField';
import type { FieldControlProps } from './field-control-props';

/**
 * The five in-repo defaults render as ONE catalog entry: they are a single
 * field library behind the Inspector (each row labels its control slot
 * structurally — the stories mirror that wrapping-label contract).
 */
const meta = {
  title: 'Builder/Shell/FieldControls',
  component: TextField,
} satisfies Meta<typeof TextField>;
export default meta;

type Story = StoryObj<typeof meta>;

function LabeledControl({
  label,
  children,
}: {
  label: string;
  children: (props: Pick<FieldControlProps, 'value' | 'onChange'>) => React.ReactNode;
}) {
  const [value, setValue] = useState<unknown>(undefined);
  return (
    <label style={{ display: 'grid', gap: '0.25rem', maxInlineSize: '16rem' }}>
      {label}
      {children({ value, onChange: setValue })}
    </label>
  );
}

const base = {
  schema: z.string() as z.ZodType,
  path: ['props', 'demo'],
};

export const AllControls: Story = {
  args: { ...base, value: 'Hello', onChange: () => undefined },
  render: () => (
    <div style={{ display: 'grid', gap: '0.75rem', padding: '1rem' }}>
      <LabeledControl label="text">
        {({ value, onChange }) => (
          <TextField {...base} value={value ?? 'Hello'} onChange={onChange} />
        )}
      </LabeledControl>
      <LabeledControl label="select">
        {({ value, onChange }) => (
          <SelectField
            schema={z.enum(['left', 'center', 'right'])}
            path={base.path}
            value={value ?? 'center'}
            onChange={onChange}
          />
        )}
      </LabeledControl>
      <LabeledControl label="switch">
        {({ value, onChange }) => (
          <SwitchField {...base} value={value ?? true} onChange={onChange} />
        )}
      </LabeledControl>
      <LabeledControl label="number">
        {({ value, onChange }) => <NumberField {...base} value={value ?? 3} onChange={onChange} />}
      </LabeledControl>
      <LabeledControl label="readonly">
        {() => <ReadOnlyField {...base} value={{ nested: [1, 2] }} onChange={() => undefined} />}
      </LabeledControl>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: 'text' })).toBeInTheDocument();
    await expect(canvas.getByRole('combobox', { name: 'select' })).toBeInTheDocument();
    await expect(canvas.getByRole('switch', { name: 'switch' })).toBeInTheDocument();
    await expect(canvas.getByRole('spinbutton', { name: 'number' })).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'readonly' })).toHaveAttribute('readonly');
    // Interaction truth: a select pick round-trips through onChange state.
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'select' }), 'left');
    await expect(canvas.getByRole('combobox', { name: 'select' })).toHaveValue('left');
  },
};

export const DisabledAndInherited: Story = {
  args: { ...base, value: undefined, onChange: () => undefined },
  render: () => (
    <div style={{ display: 'grid', gap: '0.75rem', padding: '1rem' }}>
      <LabeledControl label="disabled">
        {() => <TextField {...base} value="Frozen" onChange={() => undefined} disabled />}
      </LabeledControl>
      <LabeledControl label="inherited">
        {({ value, onChange }) => (
          <TextField {...base} value={value} onChange={onChange} placeholder="Base value" />
        )}
      </LabeledControl>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: 'disabled' })).toBeDisabled();
    await expect(canvas.getByRole('textbox', { name: 'inherited' })).toHaveAttribute(
      'placeholder',
      'Base value',
    );
  },
};

export const RightToLeft: Story = {
  args: { ...base, value: 'مرحبا', onChange: () => undefined },
  render: () => (
    <div style={{ display: 'grid', gap: '0.75rem', padding: '1rem' }}>
      <LabeledControl label="text">
        {({ value, onChange }) => (
          <TextField {...base} value={value ?? 'مرحبا'} onChange={onChange} />
        )}
      </LabeledControl>
      <LabeledControl label="number">
        {({ value, onChange }) => <NumberField {...base} value={value ?? 7} onChange={onChange} />}
      </LabeledControl>
    </div>
  ),
  globals: { direction: 'rtl' },
};
