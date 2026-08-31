import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { PageHeader } from './PageHeader';
import { pageHeaderSchema } from './schema';

const node: Node = { id: 'page-header-story', type: 'pageHeader', props: {} };

const populatedSlots = {
  start: <strong>CraftKit</strong>,
  center: (
    <nav aria-label="Primary">
      <a href="#work">Work</a> <a href="#about">About</a>
    </nav>
  ),
  end: <a href="#start">Start building</a>,
};

const meta = {
  title: 'Builder/Blocks/PageHeader',
  component: PageHeader,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node,
    props: pageHeaderSchema.props.parse({}),
    slots: populatedSlots,
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('banner');

    await expect(header).not.toHaveAttribute('aria-labelledby');
    await expect(canvas.getByText('CraftKit')).toBeInTheDocument();
    await expect(canvas.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Start building' })).toBeInTheDocument();
  },
};

export const InverseColour: Story = {
  args: {
    ...Default.args,
    props: pageHeaderSchema.props.parse({
      background: 'surfaceInverse',
      textColor: 'textInverse',
    }),
  },
  play: async ({ canvasElement }) => {
    const header = within(canvasElement).getByRole('banner');

    await expect(header.style.background).toBe('var(--t-surface-inverse)');
    await expect(header.style.color).toBe('var(--t-text-inverse)');
  },
};

export const Sticky: Story = {
  args: {
    ...Default.args,
    props: pageHeaderSchema.props.parse({ sticky: true, translucent: true }),
  },
  play: async ({ canvasElement }) => {
    const header = within(canvasElement).getByRole('banner');

    await expect(header).toHaveClass('sticky', 'bg-current/5', 'backdrop-blur-md');
  },
};
