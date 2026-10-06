import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { z } from 'zod';

import { FieldServicesProvider } from '../field-services';
import { LinkField } from './LinkField';

const schema = z.object({ label: z.string().max(60), href: z.string().max(400) });

function Harness({ initial }: { initial: { label: string; href: string } }) {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <div style={{ maxInlineSize: '18rem', padding: '1rem' }}>
      <LinkField
        schema={schema}
        value={value}
        path={['props', 'link']}
        textKey="label"
        hrefKey="href"
        commit={(next) => {
          setValue(next);
          return { ok: true };
        }}
      />
      <output data-testid="stored">{JSON.stringify(value)}</output>
    </div>
  );
}

const meta = {
  title: 'Builder/Shell/Fields/LinkField',
  component: LinkField,
  args: { schema, value: undefined, path: ['props', 'link'], commit: () => ({ ok: true }) },
} satisfies Meta<typeof LinkField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const LabelAndAddress: Story = {
  render: () => <Harness initial={{ label: 'See the architecture', href: '#architecture' }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const href = canvas.getByRole('textbox', { name: 'Link address' });
    await userEvent.clear(href);
    await userEvent.type(href, 'javascript:void(0){Enter}');
    await expect(canvas.getByRole('alert')).toBeInTheDocument();
  },
};

export const WithPagePicker: Story = {
  render: () => (
    <FieldServicesProvider
      value={{
        pages: [
          { path: '/', title: 'Home' },
          { path: '/pricing', title: 'Pricing' },
        ],
      }}
    >
      <Harness initial={{ label: 'Get started', href: '/' }} />
    </FieldServicesProvider>
  ),
};

export const Arabic: Story = {
  render: () => (
    <FieldServicesProvider value={{ locale: 'ar' }}>
      <div dir="rtl">
        <Harness initial={{ label: 'اقرأ التوثيق', href: '/docs' }} />
      </div>
    </FieldServicesProvider>
  ),
  globals: { direction: 'rtl' },
};
