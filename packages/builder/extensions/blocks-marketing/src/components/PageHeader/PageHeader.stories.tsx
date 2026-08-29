import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { PageHeader } from './PageHeader';
import { pageHeaderSchema } from './schema';

const node: Node = { id: 'page-header-story', type: 'pageHeader', props: {} };

const meta = {
  title: 'Builder/Blocks/PageHeader',
  component: PageHeader,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node,
    props: pageHeaderSchema.props.parse({
      brand: 'CraftKit',
      links: [
        { label: 'Docs', href: '/docs' },
        { label: 'Pricing', href: '/pricing' },
      ],
      tagline: 'Composable pages',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('banner', { name: 'CraftKit' });
    const brand = canvas.getByText('CraftKit', { selector: 'strong' });

    await expect(header).toHaveAttribute('aria-labelledby', brand.id);
    await expect(canvas.getByRole('navigation', { name: 'Page' })).toBeInTheDocument();
  },
};

export const InverseColour: Story = {
  args: {
    ...Default.args,
    props: pageHeaderSchema.props.parse({
      brand: 'CraftKit',
      background: 'surfaceInverse',
      textColor: 'accentText',
      links: [{ label: 'Explore', href: '/explore' }],
    }),
  },
  play: async ({ canvasElement }) => {
    const header = within(canvasElement).getByRole('banner', { name: 'CraftKit' });

    await expect(header.style.background).toBe('var(--t-surface-inverse)');
    await expect(header.style.color).toBe('var(--t-accent-text)');
  },
};

export const Sticky: Story = {
  args: {
    ...Default.args,
    props: pageHeaderSchema.props.parse({
      brand: 'CraftKit',
      links: [{ label: 'Start', href: '/start' }],
      sticky: true,
    }),
  },
  play: async ({ canvasElement }) => {
    const header = within(canvasElement).getByRole('banner', { name: 'CraftKit' });

    await expect(header).toHaveClass('mkt-header--sticky');
  },
};
