import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { BlogGrid } from './BlogGrid';
import { blogGridExamples } from './examples';
import { blogGridSchema } from './schema';

const node: Node = { id: 'blog-story', type: 'blogGrid', props: {} };
const exampleProps = (index: number) =>
  blogGridSchema.props.parse((blogGridExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Blog Grid',
  component: BlogGrid,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BlogGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FeaturedInsights: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('article')).toHaveLength(3);
    await expect(canvas.getByRole('link', { name: /Read insight Why the best/i })).toBeVisible();
  },
};

export const ArabicEditorial: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'blog-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const EmptyState: Story = {
  args: {
    node: { ...node, id: 'blog-empty' },
    props: blogGridSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: true,
  },
};

/* Block parts (DESIGN §4.4): every card line is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node: { ...node, id: 'blog-parts' },
    props: blogGridSchema.props.parse({
      ...(blogGridExamples[0]?.node as { props: Record<string, unknown> }).props,
      partStyles: {
        'post.title': { className: 'text-accent' },
        'post.title@0': { className: 'underline' },
      },
    }),
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const titles = canvasElement.querySelectorAll('[data-ck-part="post.title"]');
    await expect(titles).toHaveLength(3);
    await expect(titles[1]).toHaveAttribute('data-ck-bind', 'posts.1.title');
    await expect(titles[1]).toHaveClass('text-accent');
    await expect(titles[0]).toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="post.link"]')).toHaveAttribute(
      'data-ck-bind',
      'posts.0.title',
    );
  },
};
