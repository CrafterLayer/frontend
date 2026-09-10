import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '../../../../app/App.css';
import { PageActionsMenu } from './PageActionsMenu';

const meta = {
  title: 'Playground/PageActionsMenu',
  component: PageActionsMenu,
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', inlineSize: 320, justifyContent: 'flex-end' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    page: { id: 'about', title: 'About', address: '/about' },
    pageCount: 4,
    canMoveUp: true,
    canMoveDown: true,
    onAction: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof PageActionsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for About' }));
    await expect(canvas.getByRole('menu', { name: 'About actions' })).toBeVisible();
  },
};

export const Home: Story = {
  args: {
    page: { id: 'home', title: 'Home', address: '/' },
    replacementHomePageId: 'about',
    replacementHomeTitle: 'About',
  },
};

export const LastPage: Story = {
  args: { page: { id: 'home', title: 'Home', address: '/' }, pageCount: 1 },
};

export const Linked: Story = {
  args: { inboundLinkCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for About' }));
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Delete page' }));
    await expect(canvas.getByRole('alertdialog')).toHaveTextContent('3 internal links');
  },
};
