import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { NavLinks } from './NavLinks';
import { navLinksSchema } from './schema';

const node: Node = { id: 'nav-links-story', type: 'navLinks', props: {} };

const meta = {
  title: 'Builder/Blocks/NavLinks',
  component: NavLinks,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof NavLinks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainRow: Story = {
  args: {
    node,
    props: navLinksSchema.props.parse({
      links: [
        { label: 'Product', href: '/product' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'About', href: '/about' },
      ],
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('navigation', { name: 'Navigation links' })).toBeVisible();
    await expect(canvas.getAllByRole('link')).toHaveLength(3);
  },
};

export const UnderlineWrapped: Story = {
  args: {
    ...PlainRow.args,
    props: navLinksSchema.props.parse({
      links: [
        { label: 'Documentation', href: '/docs' },
        { label: 'Components', href: '/components' },
        { label: 'Examples', href: '/examples' },
        { label: 'Changelog', href: '/changelog' },
      ],
      style: 'underline',
      gap: 'lg',
      wrap: 'wrap',
    }),
  },
};

export const PillColumn: Story = {
  args: {
    ...PlainRow.args,
    props: navLinksSchema.props.parse({
      links: [
        { label: 'Account', href: '/account' },
        { label: 'Orders', href: '/orders' },
        { label: 'Support', href: '/support' },
      ],
      direction: 'column',
      style: 'pill',
      textCase: 'uppercase',
      fontWeight: 'semibold',
      gap: 'sm',
      wrap: 'nowrap',
    }),
  },
};

export const EmptyCanvas: Story = {
  args: {
    ...PlainRow.args,
    props: navLinksSchema.props.parse({}),
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('This block has no links yet.')).toBeVisible();
    await expect(canvas.queryByRole('navigation')).not.toBeInTheDocument();
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    ...PlainRow.args,
    props: navLinksSchema.props.parse({
      links: [
        { label: 'الرئيسية', href: '/' },
        { label: 'المنتجات', href: '/products' },
        { label: 'تواصل معنا', href: '/contact' },
      ],
      style: 'underline',
      fontWeight: 'medium',
    }),
  },
};
