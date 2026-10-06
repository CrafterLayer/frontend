import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { ContentSection } from './ContentSection';
import { contentSectionExamples } from './examples';
import { contentSectionSchema } from './schema';

const node: Node = { id: 'content-story', type: 'content-section', props: {} };
const exampleProps = (index: number) =>
  contentSectionSchema.props.parse(
    (contentSectionExamples[index]?.node as { props: unknown }).props,
  );

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

/* Block parts (DESIGN §4.4): each inner element is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node,
    props: {
      ...contentSectionSchema.props.parse({
        eyebrow: 'Story',
        heading: 'A clearer way forward.',
        body: 'Tell the story behind the work.',
        highlights: [
          { title: 'Faster', body: 'Pages ship in days.' },
          { title: 'Safer', body: 'Every edit is undoable.' },
        ],
        imageSrc: '/images/story.jpg',
        imageAlt: 'The team at work',
        caption: 'Our studio.',
        link: { label: 'Read the story', href: '/story' },
      }),
      partStyles: {
        'highlight.title': { className: 'text-accent' },
        'highlight.title@0': { className: 'underline' },
      },
    },
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const styled = canvasElement.querySelectorAll('[data-ck-part="highlight.title"]');
    await expect(styled.length).toBeGreaterThan(1);
    await expect(styled[0]).toHaveAttribute('data-ck-bind', 'highlights.0.title');
    await expect(styled[0]).toHaveClass('underline');
    await expect(styled[1]).toHaveClass('text-accent');
    await expect(styled[1]).not.toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="highlights"]')).toHaveAttribute(
      'data-ck-bind',
      'highlights',
    );
  },
};
