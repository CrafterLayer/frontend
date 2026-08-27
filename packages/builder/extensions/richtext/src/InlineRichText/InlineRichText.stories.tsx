import { useState } from 'react';

import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Editor } from '@tiptap/react';

import type { RichTextDoc } from '@craftkit/builder-schema';

import { InlineRichText } from './InlineRichText';
import type { SelectionAnchor } from './selection-anchor';

const seed = (text: string): RichTextDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

/**
 * The inline surface inherits its host's typography — the wrapper here plays
 * the role of the BLOCK the text lives in on the canvas.
 */
function SurfaceHarness({
  text,
  label,
  dir,
  onSelectionChange,
  onEditorReady,
  onCommit,
  onExit,
}: {
  text: string;
  label: string;
  dir?: 'rtl';
  onSelectionChange?: (anchor: SelectionAnchor | null) => void;
  onEditorReady?: (editor: Editor) => void;
  onCommit?: (next: RichTextDoc) => void;
  onExit?: () => void;
}) {
  const [value, setValue] = useState<unknown>(seed(text));
  return (
    <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.375rem', lineHeight: 1.5 }} dir={dir}>
      <InlineRichText
        label={label}
        value={value}
        onCommit={(next) => {
          setValue(next);
          onCommit?.(next);
        }}
        onExit={onExit}
        onSelectionChange={onSelectionChange}
        onEditorReady={onEditorReady}
      />
    </div>
  );
}

const meta = {
  title: 'Builder/Extensions/InlineRichText',
  component: InlineRichText,
  args: {
    value: seed('Editable inline text'),
    onCommit: () => undefined,
  },
} satisfies Meta<typeof InlineRichText>;
export default meta;

type Story = StoryObj<typeof meta>;

export const InlineSurface: Story = {
  render: () => <SurfaceHarness text="Editable inline text" label="Article body" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const surface = await canvas.findByRole('textbox', { name: 'Article body' });
    await expect(surface).toHaveAttribute('aria-multiline', 'true');
    await expect(surface).toHaveAttribute('dir', 'auto');
    // The floating bubble replaces the block toolbar on the canvas (§4 t2).
    await expect(canvas.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('group', { name: 'Formatting' })).not.toBeInTheDocument();
  },
};

const commitLog = { count: 0 };
let commitEditor: Editor | null = null;

export const CommitLaw: Story = {
  render: () => (
    <SurfaceHarness
      text="Editable inline text"
      label="Article body"
      onCommit={() => {
        commitLog.count += 1;
      }}
      onEditorReady={(instance) => {
        commitEditor = instance;
      }}
    />
  ),
  play: async () => {
    // Idempotent: inserts, then deletes the SAME range — asserts the commit
    // ARITHMETIC (one commit per update, none on mount), never an absolute
    // document state. Deliberately no editor-local undo here: its interplay
    // with the commit echo is timing-sensitive in a real browser and is a
    // question for the kernel-history convergence pass, not this proof.
    await waitFor(async () => {
      await expect(commitEditor).not.toBeNull();
    });
    const ed = commitEditor;
    if (ed === null) {
      throw new Error('editor not ready');
    }
    const before = commitLog.count;
    const size = ed.state.doc.content.size;
    ed.chain().focus('end').insertContent(' +').run();
    await waitFor(async () => {
      await expect(commitLog.count).toBe(before + 1);
    });
    // Delete exactly what was inserted — a plain transaction, rerun-safe.
    ed.chain()
      .focus()
      .deleteRange({ from: size - 1, to: ed.state.doc.content.size - 1 })
      .run();
    await waitFor(async () => {
      await expect(commitLog.count).toBe(before + 2);
    });
    // Polled: the echo settles on React's rhythm, not the click's.
    await waitFor(async () => {
      await expect(ed.getText()).toBe('Editable inline text');
    });
  },
};

let selectionEditor: Editor | null = null;

function SelectionHarness() {
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);
  return (
    <div>
      <SurfaceHarness
        text="Select some of this text"
        label="Article body"
        onSelectionChange={setAnchor}
        onEditorReady={(instance) => {
          selectionEditor = instance;
        }}
      />
      <p data-testid="anchor-status">
        {anchor === null ? 'no anchor' : `anchor over ${String(anchor.rects.length)} line rect(s)`}
      </p>
    </div>
  );
}

export const SelectionChannel: Story = {
  render: () => <SelectionHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(selectionEditor).not.toBeNull();
    });
    const ed = selectionEditor;
    if (ed === null) {
      throw new Error('editor not ready');
    }
    ed.view.dom.focus();
    ed.commands.setTextSelection({ from: 1, to: 12 });
    await waitFor(async () => {
      await expect(canvas.getByTestId('anchor-status')).toHaveTextContent(
        /anchor over \d+ line rect/,
      );
    });
    // Collapsing the selection closes the channel — ends where a rerun starts.
    ed.commands.setTextSelection({ from: 1, to: 1 });
    await waitFor(async () => {
      await expect(canvas.getByTestId('anchor-status')).toHaveTextContent('no anchor');
    });
  },
};

function ExitHarness() {
  const [exits, setExits] = useState(0);
  return (
    <div>
      <SurfaceHarness
        text="Press Escape to leave"
        label="Article body"
        onExit={() => {
          setExits((count) => count + 1);
        }}
      />
      <p data-testid="exit-status">{`exits: ${String(exits)}`}</p>
    </div>
  );
}

export const ExitOnEscape: Story = {
  render: () => <ExitHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const surface = await canvas.findByRole('textbox', { name: 'Article body' });
    surface.focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(canvas.getByTestId('exit-status')).toHaveTextContent(/exits: [1-9]/);
    });
  },
};

export const RightToLeft: Story = {
  render: () => <SurfaceHarness dir="rtl" text="نص عربي يحرَّر في مكانه" label="نص المقال" />,
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const surface = await canvas.findByRole('textbox', { name: 'نص المقال' });
    // Mixed ar/en prose: the surface follows its own content's direction.
    await expect(surface).toHaveAttribute('dir', 'auto');
  },
};
