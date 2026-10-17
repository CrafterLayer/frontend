import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { JobsList } from './JobsList';
import { jobsListExamples } from './examples';
import { jobsListSchema } from './schema';

const node: Node = { id: 'jobs-list-story', type: 'jobsList', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  jobsListSchema.props.parse({
    ...(jobsListExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof jobsListSchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/JobsList',
  component: JobsList,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof JobsList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rows: Story = {
  args: story('jobs-list-rows', exampleProps(0)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: 'Backend Engineer (Go)' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Send an open application' })).toBeVisible();
  },
};

/* RTL cards: the meta icons sit before the words on the right, the arrow points left. */
export const ArabicCards: Story = {
  globals: { direction: 'rtl' },
  args: story('jobs-list-arabic', exampleProps(1)),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: 'محاسب أول' })).toBeVisible();
  },
};

export const NothingOpen: Story = {
  args: story('jobs-list-empty', exampleProps(2)),
};

/* The library card: what a person sees the moment they insert one. */
export const LibraryDefault: Story = {
  args: story('jobs-list-default', jobsListSchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): every title, team, place and type is a part on the canvas. */
export const Parts: Story = {
  args: story(
    'jobs-list-parts',
    exampleProps(0, { partStyles: { 'job.team': { className: 'text-accent' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const team = canvasElement.querySelector('[data-ck-part="job.team"]');
    await expect(team).toHaveAttribute('data-ck-bind', 'jobs.0.team');
    await expect(team).toHaveClass('text-accent');
  },
};

/* A 390px column: each row stacks its title, meta and apply affordance. */
export const Mobile: Story = {
  args: story('jobs-list-mobile', exampleProps(1, { layout: 'rows' })),
  globals: { direction: 'rtl' },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
