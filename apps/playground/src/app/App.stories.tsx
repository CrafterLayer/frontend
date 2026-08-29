import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { App } from './App';

const meta = {
  title: 'Playground/App',
  component: App,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof App>;
export default meta;

type Story = StoryObj<typeof meta>;

function previewBody(frame: HTMLIFrameElement): HTMLElement {
  const body = frame.contentDocument?.body;
  if (body === undefined) {
    throw new Error('the same-origin preview frame must expose its document body');
  }
  return body;
}

export const UnsupportedClaimsAreAbsent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Positive anchor: the real preview action proves the top bar mounted.
    await expect(canvas.getByRole('button', { name: 'Preview' })).toBeVisible();
    // Mutations that kill these lines: remove the app-scoped omission rule for
    // either half of the unsupported split action. A visible no-op Publish
    // control must never return to the running playground.
    await expect(canvas.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Publish options' })).not.toBeInTheDocument();

    // Opening the harness makes Edit mode reachable at both wide and narrow
    // story viewports without rendering a second copy of the control.
    await userEvent.click(canvas.getByRole('button', { name: 'Harness' }));
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Edit mode' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Harness' }));
    const status = await canvas.findByRole('region', { name: 'Editor status' });

    // Non-vacuous anchor: the status bar is mounted and carries the one real
    // view fact the app owns.
    await expect(within(status).getByText('Desktop · 1280 px')).toBeVisible();
    // Mutation that kills this line: restore `saveState="saved"` in App.
    await expect(
      within(status).queryByRole('status', { name: 'Save status' }),
    ).not.toBeInTheDocument();
    // Mutation that kills this line: restore the width/baseline ratio as the
    // StatusBar's `zoom` prop. Width without scaling is not zoom.
    await expect(within(status).queryByLabelText(/^Zoom /u)).not.toBeInTheDocument();
  },
};

export const DefaultPreviewUsesTheSelectedBreakpoint: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Harness' }));
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Edit mode' }));
    // Close the overlay before testing the rail and inspector. Mutation that
    // kills the next line: delete this click so the named group remains open.
    await userEvent.click(canvas.getByRole('button', { name: 'Harness' }));
    await expect(canvas.queryByRole('group', { name: 'Scenario harness' })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Layers' }));

    const tree = await canvas.findByRole('tree', { name: 'Document structure' });
    const hero = within(tree)
      .getAllByRole('treeitem')
      .find((item) => item.textContent.includes('Hero'));
    if (hero === undefined) {
      throw new Error('the landing fixture must expose its Hero in the layers tree');
    }
    await userEvent.click(within(hero).getByText('Hero', { exact: true }));

    await userEvent.click(canvas.getByRole('radio', { name: 'Tablet' }));
    const heading = canvas.getByRole('textbox', { name: 'heading' });
    await userEvent.click(heading);
    await userEvent.paste('Tablet preview truth');

    // Leave editing without resetting the selected device. The default branch
    // is the exact branch that used to ignore the selector.
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Edit mode' }));
    const preview = await canvas.findByTitle<HTMLIFrameElement>('Preview');
    await waitFor(async () => {
      // Mutation that kills this line: remove `breakpoint={breakpoint}` from
      // the default Builder. The base heading then remains visible instead.
      await expect(previewBody(preview)).toHaveTextContent('Tablet preview truth');
    });

    await userEvent.click(canvas.getByRole('radio', { name: 'Desktop' }));
    await waitFor(async () => {
      await expect(previewBody(preview)).toHaveTextContent('Build pages your kernel can prove');
    });
  },
};
