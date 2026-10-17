import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { partStylesProp, type BlockParts } from '@craftkit/builder-schema';

import { FieldServicesProvider } from '../field-services';
import { PartStylesField } from './PartStylesField';

const PARTS: BlockParts = {
  eyebrow: { kind: 'text', bind: 'eyebrow', label: { en: 'Eyebrow', ar: 'الشارة' } },
  heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' } },
  'item.title': {
    kind: 'text',
    bind: 'items.*.title',
    label: { en: 'Item title', ar: 'عنوان العنصر' },
  },
};

function Harness() {
  const [value, setValue] = useState<Record<string, unknown>>({
    heading: { className: 'ps-4 text-accent', dir: 'ltr' },
    'item.title@1': { className: 'font-semibold' },
  });
  return (
    <div style={{ maxInlineSize: '18rem', padding: '1rem' }}>
      <PartStylesField
        schema={partStylesProp()}
        value={value}
        path={['props', 'partStyles']}
        onChange={() => undefined}
        parts={PARTS}
        onReset={(key) => {
          setValue((current) =>
            Object.fromEntries(Object.entries(current).filter(([k]) => k !== key)),
          );
          return { ok: true };
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Builder/Shell/Fields/PartStylesField',
  component: PartStylesField,
  args: {
    schema: partStylesProp(),
    value: undefined,
    path: ['props', 'partStyles'],
    onChange: () => undefined,
  },
} satisfies Meta<typeof PartStylesField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const CustomisedParts: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset Heading' }));
    await expect(canvas.queryByText('Heading')).toBeNull();
    await expect(canvas.getByText('Item title 2')).toBeInTheDocument();
  },
};

export const Empty: Story = { args: { value: undefined } };

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
