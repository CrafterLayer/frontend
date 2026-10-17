import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { z } from 'zod';

import { FieldServicesProvider } from '../field-services';
import { KeyValueField } from './KeyValueField';

const schema = z.record(z.string(), z.string().nullable());

function Harness() {
  const [value, setValue] = useState<unknown>({ 'aria-label': 'Close dialog', title: 'Close' });
  return (
    <div style={{ maxInlineSize: '18rem', padding: '1rem' }}>
      <KeyValueField
        schema={schema}
        value={value}
        path={['props', 'attributes']}
        onChange={setValue}
      />
    </div>
  );
}

const meta = {
  title: 'Builder/Shell/Fields/KeyValueField',
  component: KeyValueField,
  args: { schema, value: {}, path: ['props', 'attributes'], onChange: () => undefined },
} satisfies Meta<typeof KeyValueField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Entries: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove title' }));
    await expect(canvas.queryByRole('textbox', { name: 'Value title' })).toBeNull();
  },
};

export const Arabic: Story = {
  render: () => (
    <FieldServicesProvider value={{ locale: 'ar' }}>
      <div dir="rtl">
        <Harness />
      </div>
    </FieldServicesProvider>
  ),
  globals: { direction: 'rtl' },
};
