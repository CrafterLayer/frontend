import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { BlockRenderProps, Node } from '@craftkit/builder-schema';

import type { StackProps } from './schema';
import { Stack } from './Stack';

/**
 * The container's claims are all about SPACE, so every gate here measures
 * boxes. jsdom computes no layout at all, which is why none of this can be
 * proven in a unit test: a class name being present says nothing about whether
 * two blocks ended up side by side.
 */
const meta = {
  title: 'Marketing/Stack',
  component: Stack,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

const NODE: Node = { id: 'stack-1', type: 'stack', props: {} };

function child(label: string) {
  return (
    <div
      key={label}
      data-testid={`child-${label}`}
      style={{ background: '#e5e7eb', padding: 'var(--bldr-control-sm)' }}
    >
      {label}
    </div>
  );
}

function args(props: Partial<StackProps>): BlockRenderProps<StackProps> {
  return {
    node: NODE,
    props: {
      direction: 'column',
      justify: 'start',
      align: 'start',
      gap: 'md',
      wrap: 'wrap',
      tone: 'transparent',
      spacing: 'none',
      width: 'standard',
      ...props,
    },
    slots: { default: [child('a'), child('b')] },
    data: {},
    isCanvas: false,
  };
}

export const Row: Story = {
  args: args({ direction: 'row' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const a = canvas.getByTestId('child-a').getBoundingClientRect();
    const b = canvas.getByTestId('child-b').getBoundingClientRect();

    // Side by side, which is the entire promise of `row` — and the thing a
    // class-name assertion would have claimed without checking.
    await expect(b.left).toBeGreaterThan(a.left);
    await expect(Math.abs(b.top - a.top)).toBeLessThan(1);
  },
};

export const Column: Story = {
  args: args({ direction: 'column' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const a = canvas.getByTestId('child-a').getBoundingClientRect();
    const b = canvas.getByTestId('child-b').getBoundingClientRect();

    await expect(b.top).toBeGreaterThan(a.top);
  },
};

export const GapIsReal: Story = {
  args: args({ direction: 'row', gap: 'lg' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const a = canvas.getByTestId('child-a').getBoundingClientRect();
    const b = canvas.getByTestId('child-b').getBoundingClientRect();

    // Non-vacuous: a gap token that resolved to nothing would leave these
    // touching, and every "the class is applied" assertion would still pass.
    await expect(b.left - a.right).toBeGreaterThan(8);
  },
};

export const Empty: Story = {
  args: { ...args({}), slots: {} },
  play: async ({ canvasElement }) => {
    // An empty container must still be a target: rendering nothing collapses it
    // to zero height and the block a person just added appears to vanish.
    const empty = canvasElement.querySelector('.mkt-stack__empty');
    await expect(empty).not.toBeNull();
    await expect((empty as HTMLElement).getBoundingClientRect().height).toBeGreaterThan(20);
  },
};
