import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { ReviewSummary } from './ReviewSummary';
import { reviewSummaryExamples } from './examples';
import { reviewSummarySchema } from './schema';

const node: Node = { id: 'review-summary-story', type: 'reviewSummary', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  reviewSummarySchema.props.parse({
    ...(reviewSummaryExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof reviewSummarySchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/ReviewSummary',
  component: ReviewSummary,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ReviewSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Clinic: Story = {
  args: story('review-summary-clinic', exampleProps(0)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: '4.9 out of 5 stars' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Read all reviews' })).toBeVisible();
  },
};

/* RTL with Arabic-Indic digits: the bars fill from the right, the partial star too. */
export const Arabic: Story = {
  globals: { direction: 'rtl' },
  args: story('review-summary-arabic', exampleProps(1)),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: '٤٫٦ من ٥ نجوم' })).toBeVisible();
  },
};

export const DarkSection: Story = {
  args: story('review-summary-dark', exampleProps(0, { tone: 'dark' })),
};

/* The library card: what a person sees the moment they insert one. */
export const LibraryDefault: Story = {
  args: story('review-summary-default', reviewSummarySchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): every level label and every review's words are parts. */
export const Parts: Story = {
  args: story(
    'review-summary-parts',
    exampleProps(0, { partStyles: { 'review.quote': { className: 'italic' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const quote = canvasElement.querySelector('[data-ck-part="review.quote"]');
    await expect(quote).toHaveAttribute('data-ck-bind', 'reviews.0.quote');
    await expect(quote).toHaveClass('italic');
  },
};

/* A 390px column: the card above, the reviews in one column below it. */
export const Mobile: Story = {
  args: story('review-summary-mobile', exampleProps(1)),
  globals: { direction: 'rtl' },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
