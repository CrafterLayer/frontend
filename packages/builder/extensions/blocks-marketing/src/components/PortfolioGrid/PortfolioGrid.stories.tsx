import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { PortfolioGrid } from './PortfolioGrid';
import { portfolioGridExamples } from './examples';
import { portfolioGridSchema } from './schema';

const node: Node = { id: 'portfolio-story', type: 'portfolioGrid', props: {} };
const exampleProps = (index: number) =>
  portfolioGridSchema.props.parse((portfolioGridExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Portfolio Grid',
  component: PortfolioGrid,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PortfolioGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OutcomeGrid: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('article')).toHaveLength(3);
    await expect(
      canvas.getByRole('link', { name: /Read the case study A calmer way/i }),
    ).toBeVisible();
  },
};

export const ArabicEditorial: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'portfolio-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const EmptyState: Story = {
  args: {
    node: { ...node, id: 'portfolio-empty' },
    props: portfolioGridSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: true,
  },
};

/* Block parts (DESIGN §4.4): every card line and outcome metric is a part on the canvas. */
export const Parts: Story = {
  args: {
    node: { ...node, id: 'portfolio-parts' },
    props: portfolioGridSchema.props.parse({
      ...(portfolioGridExamples[0]?.node as { props: Record<string, unknown> }).props,
      partStyles: {
        'item.title': { className: 'text-accent' },
        'item.metric.value@0.0': { className: 'underline' },
      },
    }),
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const titles = canvasElement.querySelectorAll('[data-ck-part="item.title"]');
    await expect(titles[1]).toHaveAttribute('data-ck-bind', 'items.1.title');
    await expect(titles[1]).toHaveClass('text-accent');
    const values = canvasElement.querySelectorAll('[data-ck-part="item.metric.value"]');
    await expect(values[0]).toHaveAttribute('data-ck-bind', 'items.0.metrics.0.value');
    await expect(values[0]).toHaveClass('underline');
  },
};
