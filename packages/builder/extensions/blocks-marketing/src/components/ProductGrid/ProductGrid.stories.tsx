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

/* Block parts (DESIGN §4.4): every card line, image and price is a part on the canvas. */
export const Parts: Story = {
  args: {
    node: { ...node, id: 'product-grid-parts' },
    props: productGridSchema.props.parse({
      ...(productGridExamples[0]?.node as { props: Record<string, unknown> }).props,
      partStyles: {
        'product.price': { className: 'text-accent' },
        'product.name@0': { className: 'underline' },
      },
    }),
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const names = canvasElement.querySelectorAll('[data-ck-part="product.name"]');
    await expect(names[1]).toHaveAttribute('data-ck-bind', 'products.1.name');
    await expect(names[0]).toHaveClass('underline');
    const prices = canvasElement.querySelectorAll('[data-ck-part="product.price"]');
    await expect(prices[1]).toHaveClass('text-accent');
  },
};

/*
  Balanced featured layout (blocks-polish 2026-10-08): the featured product
  owns a full row; the other four use the column count that divides them
  evenly, so no row ends with an empty cell.
*/
export const FeaturedBalanced: Story = {
  args: {
    node: { ...node, id: 'products-balanced' },
    props: productGridSchema.props.parse({
      heading: 'New in the studio',
      variant: 'featured',
      columns: '3',
      products: [
        { name: 'Arc task lamp', price: '$180', href: '/p/lamp', featured: true, description: 'Hand-finished brass with a dimmable warm light.' },
        { name: 'Still carafe', price: '$64', href: '/p/carafe' },
        { name: 'Fold tray', price: '$38', href: '/p/tray' },
        { name: 'Oak stool', price: '$220', href: '/p/stool' },
        { name: 'Linen throw', price: '$95', href: '/p/throw' },
      ],
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const featured = canvasElement.querySelector('[data-product-span="row"]');
    await expect(featured).not.toBeNull();
    await expect(canvasElement.querySelectorAll('[data-product-media="placeholder"]').length).toBeGreaterThan(0);
  },
};
