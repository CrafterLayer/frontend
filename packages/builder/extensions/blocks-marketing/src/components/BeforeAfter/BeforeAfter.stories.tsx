import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { BeforeAfter } from './BeforeAfter';
import { beforeAfterExamples } from './examples';
import { beforeAfterSchema } from './schema';

const node: Node = { id: 'before-after-story', type: 'beforeAfter', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  beforeAfterSchema.props.parse({
    ...(beforeAfterExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof beforeAfterSchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/BeforeAfter',
  component: BeforeAfter,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BeforeAfter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LivingRoom: Story = {
  args: story('before-after-room', exampleProps(0)),
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole('slider', {
      name: 'Drag to compare before and after',
    });
    await fireEvent.input(slider, { target: { value: '25' } });
    await expect(slider).toHaveAttribute('aria-valuetext', '25%');
  },
};

/* RTL: "before" sits on the right, the inline start, and the range runs right to left. */
export const Arabic: Story = {
  globals: { direction: 'rtl' },
  args: story('before-after-arabic', exampleProps(1)),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('slider', { name: 'اسحب للمقارنة بين قبل وبعد' }),
    ).toHaveValue('40');
  },
};

export const DarkPortrait: Story = {
  args: story('before-after-dark', exampleProps(0, { tone: 'dark', aspect: 'portrait' })),
};

/* The library card: what a person sees the moment they insert one — two drawn placeholders. */
export const LibraryDefault: Story = {
  args: story('before-after-default', beforeAfterSchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): both labels and both photos are parts on the canvas. */
export const Parts: Story = {
  args: story(
    'before-after-parts',
    exampleProps(0, { partStyles: { beforeLabel: { className: 'bg-accent text-accent-text' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const label = canvasElement.querySelector('[data-ck-part="beforeLabel"]');
    await expect(label).toHaveAttribute('data-ck-bind', 'beforeLabel');
    await expect(label).toHaveClass('bg-accent');
  },
};

/* A 390px column: the frame keeps its aspect and the handle stays reachable. */
export const Mobile: Story = {
  args: story('before-after-mobile', exampleProps(1)),
  globals: { direction: 'rtl' },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
