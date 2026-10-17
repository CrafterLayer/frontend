import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { AssetEntry, AssetLibraryPort } from '@craftkit/builder-schema';

import { AssetPicker } from './AssetPicker';

const svg = (from: string, to: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="300" height="200" fill="url(#g)"/></svg>`,
  )}`;

const ENTRIES: readonly AssetEntry[] = [
  {
    id: 'ember',
    url: svg('#c2410c', '#7c2d12'),
    description: 'A warm amber and rust gradient',
    mood: ['warm', 'craft'],
    palette: ['#c2410c', '#7c2d12'],
    alt: 'A warm gradient moving from amber to deep rust',
    width: 300,
    height: 200,
  },
  {
    id: 'slate',
    url: svg('#1e293b', '#0f172a'),
    description: 'A deep slate gradient, almost black at one edge',
    mood: ['formal', 'quiet'],
    palette: ['#1e293b', '#0f172a'],
    alt: 'A dark gradient moving from slate to near black',
    width: 300,
    height: 200,
  },
  {
    id: 'sea',
    url: svg('#0e7490', '#155e75'),
    description: 'A cool teal gradient, calm and even',
    mood: ['calm', 'clean'],
    palette: ['#0e7490', '#155e75'],
    alt: 'A calm gradient moving between two shades of teal',
    width: 300,
    height: 200,
  },
];

const libraryOf = (entries: readonly AssetEntry[]): AssetLibraryPort => ({
  list: () => Promise.resolve(entries),
});

const meta = {
  title: 'Builder/Shell/AssetPicker',
  component: AssetPicker,
  parameters: { layout: 'padded' },
  args: { label: 'Site pictures', library: libraryOf(ENTRIES), onSelect: fn() },
} satisfies Meta<typeof AssetPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const pick = await canvas.findByRole('button', { name: /warm amber/u });
    await userEvent.click(pick);
    await expect(args.onSelect).toHaveBeenCalledWith(ENTRIES[0]);
  },
};

export const Selected: Story = {
  args: { selected: 'slate' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: /deep slate/u })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
};

/** A new project. The state says so; it is not a blank rectangle. */
export const EmptyLibrary: Story = {
  args: { library: libraryOf([]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'There are no pictures in this library yet.',
    );
    await expect(canvas.getByLabelText('Filter pictures')).toBeDisabled();
  },
};

/** The library's own words, carried through, because they say where to look. */
export const Unavailable: Story = {
  args: {
    library: { list: () => Promise.reject(new Error('the store is down for maintenance')) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('status')).toHaveTextContent('down for maintenance');
  },
};

/** A word that matches nothing is named back, so it can be corrected. */
export const FilteredToNothing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('img', { name: /amber/u });
    await userEvent.type(canvas.getByLabelText('Filter pictures'), 'submarine');
    await expect(await canvas.findByRole('status')).toHaveTextContent('submarine');
  },
};

export const FilteredByMood: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('img', { name: /amber/u });
    await userEvent.type(canvas.getByLabelText('Filter pictures'), 'calm');
    await expect(await canvas.findByRole('img', { name: /teal/u })).toBeVisible();
    await expect(canvas.getAllByRole('img')).toHaveLength(1);
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: { label: 'صور الموقع', filterLabel: 'ابحث في الصور' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText('ابحث في الصور')).toBeVisible();
  },
};
