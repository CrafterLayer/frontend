import { expect, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { EDITOR_CANVAS_LABELS_AR, EDITOR_CANVAS_LABELS_EN } from '../EditorCanvas.labels';
import { CanvasAnnouncements } from './CanvasAnnouncements';

const meta = {
  title: 'Builder/Shell/EditorCanvas/CanvasAnnouncements',
  component: CanvasAnnouncements,
  args: {
    selection: { text: EDITOR_CANVAS_LABELS_EN.selected('Hero'), nonce: 1 },
    gesture: { text: '', nonce: 0 },
    selectionLabel: EDITOR_CANVAS_LABELS_EN.selectionRegion,
    gestureLabel: EDITOR_CANVAS_LABELS_EN.gestureRegion,
  },
} satisfies Meta<typeof CanvasAnnouncements>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A selection announced; the regions are visually hidden (inspect the accessibility tree). */
export const Selected: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole('status', { name: EDITOR_CANVAS_LABELS_EN.selectionRegion });
    await expect(region).toHaveTextContent('Hero');
  },
};

/** Nothing selected. */
export const Cleared: Story = {
  args: { selection: { text: EDITOR_CANVAS_LABELS_EN.selectionCleared, nonce: 2 } },
};

/** A gesture outcome in its own region. */
export const GestureOutcome: Story = {
  args: { gesture: { text: 'Already last', nonce: 3 } },
};

/** The Arabic editor's words. */
export const Arabic: Story = {
  args: {
    selection: { text: EDITOR_CANVAS_LABELS_AR.selected('البطل'), nonce: 1 },
    selectionLabel: EDITOR_CANVAS_LABELS_AR.selectionRegion,
    gestureLabel: EDITOR_CANVAS_LABELS_AR.gestureRegion,
  },
};
