import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { ContentSection } from './ContentSection';
import { contentSectionExamples } from './examples';
import { contentSectionSchema } from './schema';

const node: Node = { id: 'content-story', type: 'content-section', props: {} };
const exampleProps = (index: number) =>
  contentSectionSchema.props.parse((contentSectionExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/ContentSection',
  component: ContentSection,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ContentSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SplitMedia: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Explore our approach' })).toBeVisible();
  },
};

export const ArabicEditorialRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'content-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const Stacked: Story = {
  args: {
    node: { ...node, id: 'content-stacked' },
    props: contentSectionSchema.props.parse({
      heading: 'A complete story, one chapter at a time',
      body: 'A stacked layout keeps long-form copy calm on narrower surfaces.',
      layout: 'stacked',
      imageSrc:
        'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1600&q=80',
      imageAlt: 'Bright collaborative workspace',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};
