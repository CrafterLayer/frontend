import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { AssetEntry, BlockRenderProps, Node } from '@craftkit/builder-schema';
import { AssetTableProvider } from '@craftkit/builder-renderer';

import { Image } from './Image';
import { imageSchema, type ImageProps } from './schema';

const SOURCE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0" x2="1"%3E%3Cstop stop-color="%234f46e5"/%3E%3Cstop offset="1" stop-color="%2306b6d4"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="320" height="180" fill="url(%23g)"/%3E%3Ccircle cx="240" cy="54" r="28" fill="%23ffffff" fill-opacity=".8"/%3E%3Cpath d="M0 170L105 70l55 55 35-30 125 75" fill="%23111827" fill-opacity=".55"/%3E%3C/svg%3E';
const node: Node = { id: 'image-story', type: 'image', props: {} };

const args = (props: Partial<ImageProps>, isCanvas = false): BlockRenderProps<ImageProps> => ({
  node,
  props: imageSchema.props.parse({ src: SOURCE, alt: 'Abstract mountain landscape', ...props }),
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/Image',
  component: Image,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Image>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: args({}),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const image = canvas.getByRole('img', { name: 'Abstract mountain landscape' });
    await expect(image).toHaveAttribute('loading', 'lazy');
    await expect(image).toHaveAttribute('decoding', 'async');
  },
};

export const ContainedOnInverseGround: Story = {
  args: args({
    fit: 'contain',
    ratio: 'wide',
    radius: 'md',
    background: 'surfaceInverse',
  }),
};

export const Decorative: Story = {
  args: args({ alt: 'Ignored description', decorative: true }),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('img[alt=""]')).not.toBeNull();
    await expect(within(canvasElement).queryByText('This image needs alt text.')).toBeNull();
  },
};

export const CanvasNeedsAltText: Story = {
  args: args({ alt: '' }, true),
};

export const CanvasPlaceholder: Story = {
  args: {
    ...args({}, true),
    props: imageSchema.props.parse({ ratio: 'wide', radius: 'md' }),
  },
};

const KILN: AssetEntry = {
  id: 'kiln',
  url: SOURCE,
  description: 'A ceramics kiln glowing in a workshop',
  mood: ['warm'],
  palette: ['#4f46e5'],
  alt: 'A kiln glowing orange in a dim ceramics workshop',
  width: 320,
  height: 180,
};

const withLibrary =
  (assets: Readonly<Record<string, AssetEntry>>) =>
  (Story: () => React.JSX.Element): React.JSX.Element => (
    <AssetTableProvider assets={assets}>
      <Story />
    </AssetTableProvider>
  );

/** A picture chosen from the library, resolved through the site's asset table. */
export const FromTheLibrary: Story = {
  decorators: [withLibrary({ kiln: KILN })],
  args: {
    ...args({}, true),
    props: imageSchema.props.parse({ asset: { assetId: 'kiln' }, ratio: 'wide', radius: 'md' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: KILN.alt })).toHaveAttribute('src', KILN.url);
  },
};

/** Nothing matched, and the position says so in the words it was given. */
export const LabelledAbsence: Story = {
  decorators: [withLibrary({ kiln: KILN })],
  args: {
    ...args({}, true),
    props: imageSchema.props.parse({
      asset: { absent: true, reason: 'Nothing in the library matches "a kiln at work".' },
      ratio: 'wide',
      radius: 'md',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Nothing in the library matches "a kiln at work".'),
    ).toBeVisible();
  },
};

/** Rendered outside its site, so the table cannot resolve it. It is named, not hidden. */
export const UnresolvableReference: Story = {
  decorators: [withLibrary({})],
  args: {
    ...args({}, true),
    props: imageSchema.props.parse({ asset: { assetId: 'kiln' }, ratio: 'wide', radius: 'md' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/not in the asset table this page was rendered with/u),
    ).toBeVisible();
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: args({ alt: 'مشهد جبلي تجريدي', ratio: 'wide', align: 'end' }),
};

export const SquareGeometryContract: Story = {
  args: args({
    alt: 'Square landscape crop',
    fit: 'cover',
    ratio: 'square',
    radius: 'md',
    width: 'full',
  }),
  parameters: { layout: 'fullscreen' },
  render: (storyArgs) => (
    <div
      data-testid="image-column"
      style={{ inlineSize: '20rem', maxInlineSize: '100%', padding: '1rem' }}
    >
      <Image {...storyArgs} />
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const column = canvas.getByTestId('image-column');
    const image = canvas.getByRole('img', { name: 'Square landscape crop' });

    await step('square ratio resolves to equal measured dimensions', async () => {
      const rect = image.getBoundingClientRect();
      await expect(Math.abs(rect.width - rect.height)).toBeLessThanOrEqual(0.5);
      await expect(getComputedStyle(image).objectFit).toBe('cover');
    });

    await step('image remains inside the supplied column', async () => {
      const imageRect = image.getBoundingClientRect();
      const columnRect = column.getBoundingClientRect();
      await expect(imageRect.width).toBeGreaterThan(0);
      await expect(imageRect.width).toBeLessThanOrEqual(columnRect.width + 0.5);
      await expect(imageRect.right).toBeLessThanOrEqual(columnRect.right + 0.5);
      await expect(imageRect.left).toBeGreaterThanOrEqual(columnRect.left - 0.5);
    });
  },
};
