import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  TREE_TEXT_ACTION_LABELS_AR,
  TREE_TEXT_ACTION_LABELS_EN,
} from '../../../overlay/tree-text-actions';
import { TreeTextBubble } from './TreeTextBubble';

/** A recorded stand-in for the open in-place edit: the bubble only formats and refocuses. */
const session = {
  format: fn(() => ({ ok: true, message: '' })),
  refocus: fn(),
  suspendBlur: fn(),
};

const MARKS = [
  { id: 'bold', label: 'Bold', run: fn() },
  { id: 'italic', label: 'Italic', run: fn() },
  { id: 'link', label: 'Link', run: fn() },
];

const meta = {
  title: 'Builder/Shell/EditorCanvas/TreeTextBubble',
  component: TreeTextBubble,
  args: {
    dir: 'ltr',
    labels: TREE_TEXT_ACTION_LABELS_EN,
    actions: MARKS,
    session,
    linkRange: null,
    onCloseLink: fn(),
    onAnnounce: fn(),
  },
} satisfies Meta<typeof TreeTextBubble>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The marks over a selected range of tree text. */
export const Marks: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Bold' }));
    await expect(args.actions[0]?.run).toHaveBeenCalled();
  },
};

/** The link-address prompt replaces the marks; Apply formats the remembered range. */
export const LinkPrompt: Story = {
  args: { linkRange: { start: 0, end: 5 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: 'Link address' });
    await userEvent.type(field, 'https://example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }));
    await expect(args.onCloseLink).toHaveBeenCalled();
    await expect(args.session.format).toHaveBeenCalledWith(
      { mark: 'a', href: 'https://example.com', label: 'Link' },
      { start: 0, end: 5 },
    );
  },
};

/** A disabled mark (e.g. Link while no range is selected) cannot be pressed. */
export const DisabledMark: Story = {
  args: {
    actions: [
      { id: 'bold', label: 'Bold', run: fn() },
      { id: 'link', label: 'Link', disabled: true, run: fn() },
    ],
  },
};

/** An Arabic canvas: Arabic words, mirrored reading order. */
export const Arabic: Story = {
  args: {
    dir: 'rtl',
    labels: TREE_TEXT_ACTION_LABELS_AR,
    actions: [
      { id: 'bold', label: TREE_TEXT_ACTION_LABELS_AR.bold, run: fn() },
      { id: 'italic', label: TREE_TEXT_ACTION_LABELS_AR.italic, run: fn() },
    ],
  },
};
