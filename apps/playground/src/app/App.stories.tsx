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
    // The bar's Publish is the real one (static site files), named for what it does;
    // no bare no-op "Publish" and no options half may return to the running playground.
    await expect(canvas.getByRole('button', { name: 'Publish site' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Publish options' })).not.toBeInTheDocument();

    // Scenario controls live in the Settings rail, under the Settings heading,
    // rather than acting as an action-band button.
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    const harness = await canvas.findByRole('region', { name: 'Scenario harness' });
    await expect(within(harness).getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(within(harness).getByRole('combobox', { name: 'Fixture' })).toBeVisible();
    const status = await canvas.findByRole('region', { name: 'Editor status' });

    // Non-vacuous anchor: the status bar is mounted and carries the one real
    // view fact the app owns.
    await expect(within(status).getByText('Desktop · 1280 px')).toBeVisible();
    // The save slot reports the vault's own acknowledgement, never a constant: it
    // appears once storage has answered, and it reads what storage said. (It used to
    // be a hard-coded `saveState="saved"`; a fixed "Saved" is the lie this pins.)
    await waitFor(async () => {
      await expect(within(status).getByRole('status', { name: 'Save status' })).toHaveTextContent(
        /^(Saved|Saving)$/u,
      );
    });
    // Saved is a quiet fact in the bar, not a floating pill over the rail and the
    // agent panel's header (the owner's screenshot, 2026-09-28).
    await expect(
      canvas.queryByRole('status', { name: 'Project save status' }),
    ).not.toBeInTheDocument();
    // Mutation that kills this line: restore the width/baseline ratio as the
    // StatusBar's `zoom` prop. Width without scaling is not zoom.
    await expect(within(status).queryByLabelText(/^Zoom /u)).not.toBeInTheDocument();
  },
};

export const DefaultPreviewUsesTheSelectedBreakpoint: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    const harness = await canvas.findByRole('region', { name: 'Scenario harness' });
    await expect(within(harness).getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(within(harness).getByRole('combobox', { name: 'Fixture' })).toBeVisible();
    // A person leaves Settings by choosing the real Layers rail destination.
    await userEvent.click(canvas.getByRole('button', { name: 'Layers' }));
    await expect(
      canvas.queryByRole('region', { name: 'Scenario harness' }),
    ).not.toBeInTheDocument();

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

    // Preview carries the selected device into the publish-safe frame.
    await userEvent.click(canvas.getByRole('button', { name: 'Preview' }));
    const preview = await canvas.findByTitle<HTMLIFrameElement>('Preview');
    await waitFor(async () => {
      // Mutation that kills this line: remove `breakpoint={breakpoint}` from
      // the default Builder. The base heading then remains visible instead.
      await expect(previewBody(preview)).toHaveTextContent('Tablet preview truth');
    });

    await userEvent.click(canvas.getByRole('button', { name: 'Exit preview' }));
    await userEvent.click(await canvas.findByRole('radio', { name: 'Desktop' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Preview' }));
    const desktopPreview = await canvas.findByTitle<HTMLIFrameElement>('Preview');
    await waitFor(async () => {
      await expect(previewBody(desktopPreview)).toHaveTextContent(
        'Build pages your kernel can prove',
      );
    });
  },
};
