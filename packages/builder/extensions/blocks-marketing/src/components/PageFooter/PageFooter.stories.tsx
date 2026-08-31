import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { PageFooter } from './PageFooter';
import { pageFooterSchema } from './schema';

const node: Node = { id: 'page-footer-story', type: 'pageFooter', props: {} };
const populatedSlots = {
  default: (
    <div>
      <strong>CraftKit</strong>
      <p>Composable pages for growing teams.</p>
    </div>
  ),
  bottom: (
    <div>
      <small>© 2026 CraftKit</small>
      <nav aria-label="Footer utilities">
        <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
      </nav>
    </div>
  ),
};

const meta = {
  title: 'Builder/Blocks/PageFooter',
  component: PageFooter,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PageFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node,
    props: pageFooterSchema.props.parse({}),
    slots: populatedSlots,
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('contentinfo')).toBeInTheDocument();
    await expect(canvas.getByText('Composable pages for growing teams.')).toBeInTheDocument();
    await expect(canvas.getByRole('navigation', { name: 'Footer utilities' })).toBeInTheDocument();
  },
};

export const Split: Story = {
  args: {
    ...Default.args,
    props: pageFooterSchema.props.parse({ layout: 'split' }),
  },
};

export const BottomBar: Story = {
  args: {
    ...Default.args,
    props: pageFooterSchema.props.parse({ bottomBar: true }),
  },
  play: async ({ canvasElement }) => {
    const bottomBar = canvasElement.querySelector('[data-page-footer-region="bottom"]');

    await expect(bottomBar).toContainElement(within(canvasElement).getByText('© 2026 CraftKit'));
  },
};

export const InverseColour: Story = {
  args: {
    ...Default.args,
    props: pageFooterSchema.props.parse({
      background: 'surfaceInverse',
      textColor: 'textInverse',
    }),
  },
  play: async ({ canvasElement }) => {
    const footer = within(canvasElement).getByRole('contentinfo');

    await expect(footer.style.background).toBe('var(--t-surface-inverse)');
    await expect(footer.style.color).toBe('var(--t-text-inverse)');
  },
};
