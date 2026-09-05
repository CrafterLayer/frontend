import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LATEST_SCHEMA_VERSION, type BuilderDocument } from '@craftkit/builder';

import '../../../../app/App.css';
import { createPlaygroundKernel } from '../../create-playground-kernel';
import { PlanPreviewDialog } from './PlanPreviewDialog';

const kernel = createPlaygroundKernel({ fixture: 'landing' });

const EMPTY: BuilderDocument = {
  schemaVersion: LATEST_SCHEMA_VERSION,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: { root: { id: 'root', type: 'page', props: {} } },
};

const meta = {
  title: 'Playground/PlanPreviewDialog',
  component: PlanPreviewDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    document: kernel.getDocument(),
    blocks: kernel.context.registry.block,
    canApply: true,
    onApply: fn(),
    onClose: fn(),
  },
  argTypes: { document: { control: false }, blocks: { control: false } },
} satisfies Meta<typeof PlanPreviewDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The would-be page, drawn by the same renderer the published path uses. */
export const Default: Story = {};

/** Plan mode: no Apply anywhere, and the reason in its place. */
export const PlanningOnly: Story = { args: { canApply: false } };

/** An empty result: a plan can rehearse to a page with nothing on it. */
export const EmptyPage: Story = { args: { document: EMPTY } };

/** Applying is one press, and it closes with it. */
export const Apply: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Apply' }));
    await expect(args.onApply).toHaveBeenCalled();
  },
};

/** A click INSIDE the dialog does not dismiss it. */
export const ClickInsideKeepsItOpen: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('dialog', { name: 'Preview' }));
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};
