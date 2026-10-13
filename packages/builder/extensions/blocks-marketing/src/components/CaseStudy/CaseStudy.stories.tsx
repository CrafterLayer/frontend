import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { CaseStudy } from './CaseStudy';
import { caseStudyExamples } from './examples';
import { caseStudySchema } from './schema';

const node: Node = { id: 'case-study-story', type: 'caseStudy', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  caseStudySchema.props.parse({
    ...(caseStudyExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof caseStudySchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/CaseStudy',
  component: CaseStudy,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CaseStudy>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Logistics: Story = {
  args: story('case-study-logistics', exampleProps(0)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('32%')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Read the full story' })).toBeVisible();
  },
};

/* RTL: the result bars sit on the right, the quote card at the inline start. */
export const Arabic: Story = {
  globals: { direction: 'rtl' },
  args: story('case-study-arabic', exampleProps(1)),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('مطاعم السنبلة')).toBeVisible();
  },
};

export const DarkSection: Story = {
  args: story('case-study-dark', exampleProps(0, { tone: 'dark' })),
};

/* The library card: what a person sees the moment they insert one. */
export const LibraryDefault: Story = {
  args: story('case-study-default', caseStudySchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): every result's value and label is a part on the canvas. */
export const Parts: Story = {
  args: story(
    'case-study-parts',
    exampleProps(0, { partStyles: { 'metric.value': { className: 'text-accent' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const value = canvasElement.querySelector('[data-ck-part="metric.value"]');
    await expect(value).toHaveAttribute('data-ck-bind', 'metrics.0.value');
    await expect(value).toHaveClass('text-accent');
  },
};

/* A 390px column: results in one column, the story, then the image and quote. */
export const Mobile: Story = {
  args: story('case-study-mobile', exampleProps(0)),
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
