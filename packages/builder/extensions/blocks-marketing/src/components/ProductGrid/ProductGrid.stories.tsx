import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { ProductGrid } from './ProductGrid';
import { productGridExamples } from './examples';
import { productGridSchema } from './schema';

const node: Node = { id: 'product-grid-story', type: 'productGrid', props: {} };
const exampleProps = (index: number) =>
  productGridSchema.props.parse((productGridExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Product Grid',
  component: ProductGrid,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProductGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FeaturedCollection: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('article')).toHaveLength(3);
    await expect(canvas.getByRole('img', { name: /Rated 4.9 out of 5/i })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Shop product: Arc task lamp' })).toBeVisible();
  },
};

export const ArabicCatalog: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'product-grid-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const EmptyState: Story = {
  args: {
    node: { ...node, id: 'product-grid-empty' },
    props: productGridSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: true,
  },
};
