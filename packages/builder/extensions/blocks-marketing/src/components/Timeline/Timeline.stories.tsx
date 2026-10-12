import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Timeline } from './Timeline';
import { timelineExamples } from './examples';
import { timelineSchema } from './schema';

const node: Node = { id: 'timeline-story', type: 'timeline', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  timelineSchema.props.parse({
    ...(timelineExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof timelineSchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/Timeline',
  component: Timeline,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompanyHistory: Story = {
  args: story('timeline-history', exampleProps(0)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole('list');
    await expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    await expect(canvas.getByRole('heading', { level: 3, name: 'Online orders' })).toBeVisible();
  },
};

export const Roadmap: Story = {
  args: story('timeline-roadmap', exampleProps(1)),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('img', { name: 'Upcoming' })).toHaveLength(2);
  },
};

export const ArabicAgenda: Story = {
  globals: { direction: 'rtl' },
  args: story('timeline-arabic', exampleProps(2)),
};

export const ArabicAlternating: Story = {
  globals: { direction: 'rtl' },
  args: story(
    'timeline-arabic-alt',
    exampleProps(2, { layout: 'alternating', tone: 'transparent' }),
  ),
};

/* The library card: what a person sees the moment they insert a Timeline. */
export const LibraryDefault: Story = {
  args: story('timeline-default', timelineSchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): every milestone's date, title and description are parts on the canvas. */
export const Parts: Story = {
  args: story(
    'timeline-parts',
    exampleProps(1, { partStyles: { 'item.title': { className: 'text-accent' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const titles = canvasElement.querySelectorAll('[data-ck-part="item.title"]');
    await expect(titles[1]).toHaveAttribute('data-ck-bind', 'items.1.title');
    await expect(titles[1]).toHaveClass('text-accent');
  },
};

/* A 390px column: the alternating layout falls back to one rail at the inline start. */
export const Mobile: Story = {
  args: story('timeline-mobile', exampleProps(0)),
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
