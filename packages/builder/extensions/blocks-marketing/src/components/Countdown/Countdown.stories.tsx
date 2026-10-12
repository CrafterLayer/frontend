import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Countdown } from './Countdown';
import { countdownExamples } from './examples';
import { countdownSchema } from './schema';

const node: Node = { id: 'countdown-story', type: 'countdown', props: {} };
const exampleProps = (index: number, overrides: Record<string, unknown> = {}) =>
  countdownSchema.props.parse({
    ...(countdownExamples[index]?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
const story = (id: string, props: unknown, isCanvas = false) => ({
  node: { ...node, id },
  props: props as ReturnType<typeof countdownSchema.props.parse>,
  slots: {},
  data: {},
  isCanvas,
});

const meta = {
  title: 'Builder/Blocks/Countdown',
  component: Countdown,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Countdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ArabicOpening: Story = {
  globals: { direction: 'rtl' },
  args: story('countdown-arabic', exampleProps(0)),
  play: async ({ canvasElement }) => {
    const clock = canvasElement.querySelector('[data-ck-countdown-clock]');
    await expect(clock).toBeVisible();
    await expect(clock).toHaveAttribute('aria-hidden', 'true');
    await expect(within(canvasElement).getByRole('link', { name: 'احجز مكانك' })).toBeVisible();
  },
};

export const ProductLaunch: Story = {
  args: story('countdown-launch', exampleProps(1)),
};

export const MinimalConference: Story = {
  args: story('countdown-conference', exampleProps(2)),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ck-countdown-unit]')).toHaveLength(3);
  },
};

/* Once the moment has passed: the clock and the date give way to the ended message. */
export const Ended: Story = {
  args: story('countdown-ended', exampleProps(1, { target: '2025-01-01T00:00:00Z' })),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Version 3 is out — update now.')).toBeVisible();
    await expect(canvasElement.querySelector('[data-ck-countdown-clock]')).not.toBeVisible();
  },
};

/* The library card: what a person sees the moment they insert a Countdown. */
export const LibraryDefault: Story = {
  args: story('countdown-default', countdownSchema.props.parse({}), true),
};

/* Block parts (DESIGN §4.4): the unit labels, the date lead-in and the time zone are parts on the canvas. */
export const Parts: Story = {
  args: story(
    'countdown-parts',
    exampleProps(1, { partStyles: { daysLabel: { className: 'text-accent' } } }),
    true,
  ),
  play: async ({ canvasElement }) => {
    const days = canvasElement.querySelector('[data-ck-part="daysLabel"]');
    await expect(days).toHaveAttribute('data-ck-bind', 'daysLabel');
    await expect(days).toHaveClass('text-accent');
  },
};

export const Mobile: Story = {
  args: story('countdown-mobile', exampleProps(1)),
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 390, marginInline: 'auto' }}>
        <Story />
      </div>
    ),
  ],
};
