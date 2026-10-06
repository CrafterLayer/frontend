import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { z } from 'zod';

import type { AssetEntry, AssetLibraryPort } from '@craftkit/builder-schema';

import { FieldServicesProvider } from '../field-services';
import { ImageUrlField } from './ImageUrlField';

const swatch = (from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><defs><linearGradient id="g"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="120" height="80" fill="url(#g)"/></svg>`,
  )}`;

const ENTRIES: AssetEntry[] = [
  {
    id: 'dusk',
    url: swatch('#c2410c', '#7c2d12'),
    description: 'Dusk',
    mood: [],
    palette: [],
    alt: 'Dusk wash',
    width: 120,
    height: 80,
  },
  {
    id: 'sea',
    url: swatch('#0e7490', '#155e75'),
    description: 'Sea',
    mood: [],
    palette: [],
    alt: 'Sea wash',
    width: 120,
    height: 80,
  },
];
const library: AssetLibraryPort = { list: () => Promise.resolve(ENTRIES) };

function Harness() {
  const [value, setValue] = useState<unknown>(ENTRIES[0]?.url ?? '');
  return (
    <label style={{ display: 'grid', gap: '0.25rem', maxInlineSize: '18rem', padding: '1rem' }}>
      Image
      <ImageUrlField
        schema={z.string()}
        value={value}
        path={['props', 'imageSrc']}
        onChange={setValue}
      />
    </label>
  );
}

const meta = {
  title: 'Builder/Shell/Fields/ImageUrlField',
  component: ImageUrlField,
  args: { schema: z.string(), value: '', path: ['props', 'imageSrc'], onChange: () => undefined },
} satisfies Meta<typeof ImageUrlField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const WithLibrary: Story = {
  render: () => (
    <FieldServicesProvider value={{ assetLibrary: library }}>
      <Harness />
    </FieldServicesProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Choose from library' }));
    await userEvent.click(await canvas.findByRole('button', { name: /Sea/u }));
    await expect(canvas.getByRole('button', { name: 'Choose from library' })).toBeInTheDocument();
  },
};

export const UrlEntryOnly: Story = { render: () => <Harness /> };

export const Arabic: Story = {
  render: () => (
    <FieldServicesProvider value={{ assetLibrary: library, locale: 'ar' }}>
      <div dir="rtl">
        <Harness />
      </div>
    </FieldServicesProvider>
  ),
  globals: { direction: 'rtl' },
};
