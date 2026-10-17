import type { Meta, StoryObj } from '@storybook/react-vite';

import { ImageCropper } from './ImageCropper';
import { IMAGE_CROPPER_LABELS_AR } from './ImageCropper.labels';

/* An inline SVG, so the story needs no network. */
const PICTURE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#cbd5e1"/><circle cx="560" cy="200" r="90" fill="#0f766e"/><rect x="80" y="320" width="300" height="120" fill="#334155"/></svg>',
  );

const meta = {
  title: 'Builder/Shell/DesignSystem/ImageCropper',
  component: ImageCropper,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '22rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { src: PICTURE, alt: 'Shapes', onApply: () => undefined, onCancel: () => undefined },
} satisfies Meta<typeof ImageCropper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Widescreen: Story = { args: { defaultValue: { aspect: '16/9', x: 70, y: 40 } } };
export const Arabic: Story = { args: { labels: IMAGE_CROPPER_LABELS_AR, dir: 'rtl' } };
