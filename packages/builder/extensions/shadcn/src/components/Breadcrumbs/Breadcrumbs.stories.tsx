import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Breadcrumbs } from './Breadcrumbs';
import { breadcrumbsSchema } from './schema';

const node: Node = { id: 'breadcrumbs-story', type: 'breadcrumbs', props: {} };

const meta = {
  title: 'Builder/Shadcn/Breadcrumbs',
  component: Breadcrumbs,
  parameters: { layout: 'padded' },
  args: {
    node,
    props: breadcrumbsSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: false,
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
    await expect(canvas.getByText('Current page')).toHaveAttribute('aria-current', 'page');
  },
};

export const LongResponsiveTrail: Story = {
  args: {
    props: breadcrumbsSchema.props.parse({
      label: 'Product breadcrumb',
      items: [
        { label: 'Home', href: '/' },
        { label: 'Store', href: '/store' },
        { label: 'Furniture', href: '/store/furniture' },
        { label: 'Seating', href: '/store/furniture/seating' },
        { label: 'Lounge chairs', href: '/store/furniture/seating/lounge-chairs' },
        { label: 'Sora chair', current: true },
      ],
      collapse: 'responsive',
    }),
  },
};

export const InverseSlash: Story = {
  args: {
    props: breadcrumbsSchema.props.parse({
      label: 'Documentation breadcrumb',
      items: [
        { label: 'Docs', href: '/docs' },
        { label: 'Components', href: '/docs/components' },
        { label: 'Breadcrumbs', current: true },
      ],
      separator: 'slash',
      collapse: 'none',
      tone: 'inverse',
      size: 'small',
    }),
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    props: breadcrumbsSchema.props.parse({
      label: 'مسار التنقل',
      items: [
        { label: 'الرئيسية', href: '/' },
        { label: 'المتجر', href: '/shop' },
        { label: 'الإضاءة', current: true },
      ],
      separator: 'chevron',
      size: 'large',
    }),
  },
};

/* Block parts (DESIGN §4.4): each inner element is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node,
    props: {
      ...breadcrumbsSchema.props.parse({
        items: [
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          { label: 'Lamp', current: true },
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
