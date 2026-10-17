import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { AppDownload } from './AppDownload';
import { appDownloadExamples } from './examples';
import { appDownloadSchema } from './schema';

const node: Node = { id: 'app-download-story', type: 'appDownload', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  appDownloadSchema.props.parse({
    ...(appDownloadExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof appDownloadSchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/AppDownload',
  component: AppDownload,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppDownload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SplitWithScreenshot: Story = {
  args: story('app-download-split', exampleProps(0)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: 'Download on the App Store' })).toBeVisible();
    await expect(canvas.getByRole('img', { name: /finance dashboard/u })).toBeVisible();
  },
};

/* RTL on a dark band: the buttons turn light, the stack is centred. */
export const ArabicCentred: Story = {
  globals: { direction: 'rtl' },
  args: story('app-download-arabic', exampleProps(1)),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('link', { name: 'احصل عليه من Google Play' }),
    ).toBeVisible();
  },
};

/* RTL split: the device sits at the inline start, the left edge in Arabic is the end. */
export const ArabicMediaStart: Story = {
  globals: { direction: 'rtl' },
  args: story(
    'app-download-arabic-start',
    exampleProps(1, { layout: 'split', showDevice: true, mediaPosition: 'start', tone: 'light' }),
  ),
};

/* The library card: the drawn device and placeholder screen, before any screenshot. */
export const LibraryDefault: Story = {
  args: story('app-download-default', appDownloadSchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): every benefit, button and lead-in is a part on the canvas. */
export const Parts: Story = {
  args: story(
    'app-download-parts',
    exampleProps(0, { partStyles: { 'store.kicker': { className: 'uppercase' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const kicker = canvasElement.querySelector('[data-ck-part="store.kicker"]');
    await expect(kicker).toHaveAttribute('data-ck-bind', 'stores.0.kicker');
    await expect(kicker).toHaveClass('uppercase');
  },
};

/* A 390px column: copy first, the device below it, buttons wrapping. */
export const Mobile: Story = {
  args: story('app-download-mobile', exampleProps(0)),
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
