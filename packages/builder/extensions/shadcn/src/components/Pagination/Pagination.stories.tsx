import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { paginationExamples } from './examples';
import { Pagination } from './Pagination';
import { paginationSchema } from './schema';

const node: Node = { id: 'pagination-story', type: 'pagination', props: {} };
const exampleProps = (index: number) =>
  paginationSchema.props.parse((paginationExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/shadcn/Pagination',
  component: Pagination,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GeneratedRange: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Page 5')).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getByRole('link', { name: 'Page 6' })).toBeVisible();
  },
};

export const ArabicCompactRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'pagination-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const ExplicitCollection: Story = {
  args: {
    node: { ...node, id: 'pagination-explicit' },
    props: exampleProps(2),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const LargeInverse: Story = {
  args: {
    node: { ...node, id: 'pagination-large' },
    props: paginationSchema.props.parse({
      currentPage: 8,
      pageCount: 24,
      pageHrefTemplate: '/catalog?page={page}',
      size: 'lg',
      tone: 'inverse',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

/* Block parts (DESIGN §4.4): each inner element is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node,
    props: {
      ...paginationSchema.props.parse({
        mode: 'explicit',
        previousHref: '/new',
        nextHref: '/archive',
        items: [
          { label: 'New', href: '/new' },
          { label: 'Popular', current: true },
          { label: 'Archive', href: '/archive' },
        ],
      }),
      partStyles: {
        'item.link': { className: 'text-accent' },
        'item.link@0': { className: 'underline' },
      },
    },
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const styled = canvasElement.querySelectorAll('[data-ck-part="item.link"]');
    await expect(styled.length).toBeGreaterThan(1);
    await expect(styled[0]).toHaveAttribute('data-ck-bind', 'items.0.label');
    await expect(styled[0]).toHaveClass('underline');
    await expect(styled[1]).toHaveClass('text-accent');
    await expect(styled[1]).not.toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="items"]')).toHaveAttribute(
      'data-ck-bind',
      'items',
    );
  },
};
