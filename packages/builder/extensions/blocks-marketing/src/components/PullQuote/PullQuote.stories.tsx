import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { PullQuote } from './PullQuote';
import { pullQuoteExamples } from './examples';
import { pullQuoteSchema } from './schema';

const node: Node = { id: 'pull-quote-story', type: 'pullQuote', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  pullQuoteSchema.props.parse({
    ...(pullQuoteExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof pullQuoteSchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/PullQuote',
  component: PullQuote,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PullQuote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Founder: Story = {
  args: story('pull-quote-founder', exampleProps(0)),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('blockquote')).toBeVisible();
    await expect(within(canvasElement).getByText('Lina Haddad')).toBeVisible();
  },
};

/* RTL: the editorial bar sits on the right, the inline start, and the source is a link. */
export const ArabicRule: Story = {
  globals: { direction: 'rtl' },
  args: story('pull-quote-arabic', exampleProps(1)),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: 'صحيفة الرياض' })).toBeVisible();
  },
};

export const DarkCard: Story = {
  args: story('pull-quote-card', exampleProps(2)),
};

/* The library card: what a person sees the moment they insert one. */
export const LibraryDefault: Story = {
  args: story('pull-quote-default', pullQuoteSchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): the quote and its attribution are parts on the canvas. */
export const Parts: Story = {
  args: story(
    'pull-quote-parts',
    exampleProps(0, { partStyles: { author: { className: 'text-accent' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const author = canvasElement.querySelector('[data-ck-part="author"]');
    await expect(author).toHaveAttribute('data-ck-bind', 'author');
    await expect(author).toHaveClass('text-accent');
  },
};

/* A 390px column: the quote steps down a size and the caption wraps under the portrait. */
export const Mobile: Story = {
  args: story('pull-quote-mobile', exampleProps(0)),
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
