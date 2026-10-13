import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { DownloadList } from './DownloadList';
import { downloadListExamples } from './examples';
import { downloadListSchema } from './schema';

const node: Node = { id: 'download-list-story', type: 'downloadList', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  downloadListSchema.props.parse({
    ...(downloadListExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof downloadListSchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/DownloadList',
  component: DownloadList,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DownloadList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resources: Story = {
  args: story('download-list-resources', exampleProps(0)),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Company profile 2026' });
    await expect(link).toHaveAttribute('download', '');
    await expect(link).toHaveAccessibleDescription('PDF 3.2 MB');
  },
};

/* RTL cards: the file icon on the right, the download glyph on the left. */
export const ArabicCards: Story = {
  globals: { direction: 'rtl' },
  args: story('download-list-arabic', exampleProps(1)),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: 'قائمة الطعام' })).toBeVisible();
  },
};

export const DarkSection: Story = {
  args: story('download-list-dark', exampleProps(0, { tone: 'dark', layout: 'cards' })),
};

/* The library card: what a person sees the moment they insert one. */
export const LibraryDefault: Story = {
  args: story('download-list-default', downloadListSchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): every title, format and size is a part on the canvas. */
export const Parts: Story = {
  args: story(
    'download-list-parts',
    exampleProps(0, { partStyles: { 'file.size': { className: 'text-accent' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const size = canvasElement.querySelector('[data-ck-part="file.size"]');
    await expect(size).toHaveAttribute('data-ck-bind', 'files.0.size');
    await expect(size).toHaveClass('text-accent');
  },
};

/* A 390px column: the download word folds away and the glyph remains. */
export const Mobile: Story = {
  args: story('download-list-mobile', exampleProps(1, { layout: 'list' })),
  globals: { direction: 'rtl' },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
