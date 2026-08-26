import { useState } from 'react';

import { expect, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { InlineTextSurface } from './InlineTextSurface';

const meta = {
  title: 'Builder/Shell/InlineTextSurface',
  component: InlineTextSurface,
} satisfies Meta<typeof InlineTextSurface>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The host owns the value — exactly as the canvas does through the door. */
function Hosted({ initial, singleLine }: { initial: string; singleLine?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ font: '600 28px/1.2 system-ui', padding: '1.5rem' }}>
      <InlineTextSurface
        value={value}
        label="heading"
        singleLine={singleLine}
        onCommit={setValue}
      />
      <p data-testid="stored" style={{ font: '12px/1.4 monospace', marginBlockStart: '1.5rem' }}>
        stored: {value}
      </p>
    </div>
  );
}

export const InPlace: Story = {
  args: { value: 'Edit me where I live', onCommit: () => undefined },
  render: () => <Hosted initial="Edit me where I live" />,
  play: async ({ canvasElement }) => {
    // Browser truth: the surface takes focus and edits look like the result.
    const surface = within(canvasElement).getByRole('textbox', { name: 'heading' });
    await expect(surface).toHaveFocus();
    await expect(within(canvasElement).getByTestId('stored')).toHaveTextContent(
      'Edit me where I live',
    );
  },
};

export const TypingCommits: Story = {
  args: { value: 'Type here', onCommit: () => undefined },
  render: () => <Hosted initial="Type here" />,
  play: async ({ canvasElement }) => {
    // BROWSER TRUTH — what this proves and what it does not, stated plainly:
    // `userEvent.type` refuses `contenteditable="plaintext-only"` (its guard
    // accepts only "true"), so the story fires the real `InputEvent` a browser
    // fires. That proves, in Chromium, that the surface is focusable and live
    // on first paint and that the NATIVE listener commits — the exact path a
    // React `onInput` would miss across the frame boundary. Character-by-
    // character key handling is covered by the unit suite.
    const surface = within(canvasElement).getByRole('textbox', { name: 'heading' });
    surface.focus();
    await expect(surface).toHaveFocus();
    await expect(surface).toHaveAttribute('contenteditable', 'plaintext-only');
    surface.textContent = 'Type here!';
    surface.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '!' }),
    );
    // A NATIVE listener's setState is batched by React's scheduler, so the host
    // update lands after this tick — wait for it rather than racing it.
    await waitFor(async () => {
      await expect(within(canvasElement).getByTestId('stored')).toHaveTextContent('Type here!');
    });
  },
};

export const SingleLine: Story = {
  args: { value: 'One line only', singleLine: true, onCommit: () => undefined },
  render: () => <Hosted initial="One line only" singleLine />,
  play: async ({ canvasElement }) => {
    const surface = within(canvasElement).getByRole('textbox', { name: 'heading' });
    await expect(surface).not.toHaveAttribute('aria-multiline');
  },
};

export const RightToLeft: Story = {
  args: { value: 'حرّر النص في مكانه', onCommit: () => undefined },
  render: () => <Hosted initial="حرّر النص في مكانه" />,
  globals: { direction: 'rtl' },
};
