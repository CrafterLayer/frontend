import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Gallery } from './Gallery';
import { galleryExamples } from './examples';
import { gallerySchema } from './schema';

const node: Node = { id: 'gallery-story', type: 'gallery', props: {} };
const exampleProps = (index: number) =>
  gallerySchema.props.parse((galleryExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Gallery',
  component: Gallery,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editorial: Story = {
  args: {
    node,
    props: exampleProps(0),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: /Quiet architecture/i })).toBeVisible();
    await expect(canvas.getAllByRole('figure')).toHaveLength(3);
  },
};

export const FourColumnGrid: Story = {
  args: {
    ...Editorial.args,
    node: { ...node, id: 'gallery-grid' },
    props: gallerySchema.props.parse({
      ...(galleryExamples[0]?.node as { props: Record<string, unknown> }).props,
      layout: 'grid',
      columns: '4',
      aspect: 'square',
      captionStyle: 'overlay',
    }),
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    ...Editorial.args,
    node: { ...node, id: 'gallery-arabic' },
    props: exampleProps(1),
  },
};

export const EmptyCanvas: Story = {
  args: {
    ...Editorial.args,
    node: { ...node, id: 'gallery-empty' },
    props: gallerySchema.props.parse({}),
    isCanvas: true,
  },
};
