import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { PageFooter } from './PageFooter';
import { pageFooterSchema } from './schema';

const node: Node = { id: 'page-footer-story', type: 'pageFooter', props: {} };

const meta = {
  title: 'Builder/Blocks/PageFooter',
  component: PageFooter,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof PageFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node,
    props: pageFooterSchema.props.parse({
      columns: [
        { heading: 'Product', links: [{ label: 'Features', href: '/features' }] },
        { heading: 'Company', links: [{ label: 'About', href: '/about' }] },
      ],
      legal: '© 2026 CraftKit',
      statement: 'Composable pages for growing teams.',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('contentinfo')).toBeInTheDocument();
    await expect(canvas.getByRole('navigation', { name: 'Product' })).toBeInTheDocument();
  },
};

export const InverseColour: Story = {
  args: {
    ...Default.args,
    props: pageFooterSchema.props.parse({
      background: 'surfaceInverse',
      columns: [{ heading: 'Resources', links: [{ label: 'Guides', href: '/guides' }] }],
      legal: '© 2026 CraftKit',
      textColor: 'accentText',
    }),
  },
  play: async ({ canvasElement }) => {
    const footer = within(canvasElement).getByRole('contentinfo');

    await expect(footer.style.background).toBe('var(--t-surface-inverse)');
    await expect(footer.style.color).toBe('var(--t-accent-text)');
  },
};
