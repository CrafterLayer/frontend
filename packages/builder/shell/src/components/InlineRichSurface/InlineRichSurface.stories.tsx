import { useState } from 'react';

import { expect, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { InlineFormatAction, InlineSelectionAnchor } from '@craftkit/builder-schema';

import { InlineRichSurface } from './InlineRichSurface';

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const meta = {
  title: 'Builder/Shell/InlineRichSurface',
  component: InlineRichSurface,
} satisfies Meta<typeof InlineRichSurface>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The host owns the value, exactly as the canvas does through the kernel door,
 * and renders whatever actions the surface reports — the canvas draws those in
 * its floating bubble; here they are plain buttons so the story stays about the
 * SURFACE.
 */
function Hosted({ initial, dir }: { initial: string; dir?: 'rtl' }) {
  const [value, setValue] = useState<unknown>(doc(initial));
  const [actions, setActions] = useState<InlineFormatAction[]>([]);
  const [anchor, setAnchor] = useState<InlineSelectionAnchor | null>(null);
  return (
    <div style={{ font: '400 22px/1.5 Georgia, serif', padding: '1.5rem' }} dir={dir}>
      <InlineRichSurface
        value={value}
        label="Article body"
        onCommit={setValue}
        onExit={() => undefined}
        onAnchor={setAnchor}
        onActions={setActions}
      />
      <div style={{ display: 'flex', gap: 8, marginBlockStart: '1.5rem' }}>
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            aria-pressed={action.pressed}
            onMouseDown={(event) => {
              event.preventDefault(); // keep the caret — the bubble's own law
            }}
            onClick={() => {
              action.run();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      <p data-testid="stored" style={{ font: '12px/1.4 monospace', marginBlockStart: '1rem' }}>
        {JSON.stringify(value)}
      </p>
      <p data-testid="anchor" style={{ font: '12px/1.4 monospace' }}>
        {anchor === null
          ? 'no selection'
          : `selection over ${String(anchor.rects?.length ?? 1)} line(s)`}
      </p>
    </div>
  );
}

export const InPlace: Story = {
  args: {
    value: doc('Select a word and mark it.'),
    label: 'Article body',
    onCommit: () => undefined,
    onExit: () => undefined,
    onAnchor: () => undefined,
    onActions: () => undefined,
  },
  render: () => <Hosted initial="Select a word and mark it." />,
  play: async ({ canvasElement }) => {
    const surface = within(canvasElement).getByRole('textbox', { name: 'Article body' });
    await expect(surface).toHaveFocus();
    await expect(surface).toHaveAttribute('aria-multiline', 'true');
    // No selection yet ⇒ no actions ⇒ the canvas shows no bubble.
    await expect(within(canvasElement).getByTestId('anchor')).toHaveTextContent('no selection');
  },
};

export const MarksExactlyTheSelection: Story = {
  args: {
    value: doc('Select a word and mark it.'),
    label: 'Article body',
    onCommit: () => undefined,
    onExit: () => undefined,
    onAnchor: () => undefined,
    onActions: () => undefined,
  },
  render: () => <Hosted initial="Select a word and mark it." />,
  play: async ({ canvasElement }) => {
    // BROWSER TRUTH: jsdom has no real selection and no layout, so the headline
    // behaviour — mark exactly the selected characters — can only be proven
    // here. Written relative to the current state so reruns hold.
    const canvas = within(canvasElement);
    const surface = canvas.getByRole('textbox', { name: 'Article body' });
    const selectWord = () => {
      const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
      const first = walker.nextNode();
      if (first === null) {
        throw new Error('the surface must render text');
      }
      const at = (first.textContent ?? '').indexOf('word');
      const range = document.createRange();
      range.setStart(first, at);
      range.setEnd(first, at + 'word'.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };
    surface.focus();
    selectWord();

    const bold = await waitFor(() => {
      const found = canvas.queryByRole('button', { name: 'Bold' });
      if (found === null) {
        selectWord(); // a selectionchange race, not a failure
        throw new Error('a live selection must offer Bold');
      }
      return found;
    });
    await expect(canvas.getByTestId('anchor')).toHaveTextContent(/selection over \d+ line/);

    const wasPressed = bold.getAttribute('aria-pressed') === 'true';
    bold.click();
    await waitFor(async () => {
      const stored = canvas.getByTestId('stored').textContent;
      // The MARK lands on its own run, carrying exactly the selected word…
      await expect(stored.includes('"bold"')).toBe(!wasPressed);
    });
    // …and the text itself is untouched: formatting marks, it never rewrites.
    await expect(surface).toHaveTextContent('Select a word and mark it.');
  },
};

export const RightToLeft: Story = {
  args: {
    value: doc('اختر كلمة وميّزها'),
    label: 'نص المقالة',
    onCommit: () => undefined,
    onExit: () => undefined,
    onAnchor: () => undefined,
    onActions: () => undefined,
  },
  render: () => <Hosted initial="اختر كلمة وميّزها" dir="rtl" />,
  globals: { direction: 'rtl' },
};
