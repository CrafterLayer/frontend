import { useRef, useState, type CSSProperties } from 'react';

import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TextBubble, type TextBubbleAction } from './TextBubble';

const meta = {
  title: 'Builder/Shell/TextBubble',
  component: TextBubble,
  args: { onReturnFocus: () => true },
} satisfies Meta<typeof TextBubble>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Mimics the floating host's DOM writes (`.bldr-floating`, overlay.css): a
 * positioned origin moved by transform, `data-placement`, and the
 * `--bldr-arrow-x` custom property the arrow reads. No placement math here —
 * geometry belongs to the host, this story only demonstrates the content.
 */
const hostStyle = {
  left: 0,
  position: 'absolute',
  top: 0,
  transform: 'translate(16px, 12px)',
  zIndex: 2,
  '--bldr-arrow-x': '52px',
} as CSSProperties;

function BubbleDemo({
  dir,
  initialBold = false,
  disableLink = false,
}: {
  dir: 'ltr' | 'rtl';
  initialBold?: boolean | undefined;
  disableLink?: boolean | undefined;
}) {
  const [bold, setBold] = useState(initialBold);
  const [italic, setItalic] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const editorRef = useRef<HTMLParagraphElement | null>(null);
  const ran = () => {
    setRunCount((current) => current + 1);
  };
  const actions: TextBubbleAction[] = [
    {
      id: 'bold',
      label: 'Bold',
      pressed: bold,
      run: () => {
        setBold((current) => !current);
        ran();
      },
    },
    {
      id: 'italic',
      label: 'Italic',
      pressed: italic,
      run: () => {
        setItalic((current) => !current);
        ran();
      },
    },
    // A one-shot action: no pressed state, so no aria-pressed.
    {
      id: 'link',
      label: 'Link',
      ...(disableLink ? { disabled: true } : {}),
      run: ran,
    },
  ];
  return (
    <div
      dir={dir}
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 480,
        padding: '3.5rem 1rem 1rem',
        position: 'relative',
      }}
    >
      <div data-placement="above" style={hostStyle}>
        <TextBubble
          dir={dir}
          actions={actions}
          onReturnFocus={() => {
            const editor = editorRef.current;
            if (editor === null) {
              return false;
            }
            editor.focus({ preventScroll: true });
            return editor.ownerDocument.activeElement === editor;
          }}
        />
      </div>
      <p
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-testid="editor"
        style={{
          border: '1px dashed #cbd5e1',
          borderRadius: 4,
          margin: 0,
          outline: 'none',
          padding: '0.5rem',
        }}
      >
        Click into this editable text, then format it — the bubble never steals focus.
      </p>
      <p data-testid="run-count" style={{ color: '#64748b', fontSize: 12 }}>
        {runCount}
      </p>
    </div>
  );
}

export const Default: Story = {
  args: { dir: 'ltr', actions: [] },
  render: (args) => <BubbleDemo dir={args.dir} />,
  play: async ({ canvasElement }) => {
    // Idempotent: Bold is toggled ON and back OFF; the run counter is only
    // ever compared RELATIVELY, so reruns never accumulate into a failure.
    const canvas = within(canvasElement);
    const editor = canvas.getByTestId('editor');
    await userEvent.click(editor);
    await expect(editor).toHaveFocus();

    const bold = canvas.getByRole('button', { name: 'Bold' });
    const count = canvas.getByTestId('run-count');
    const before = Number(count.textContent);
    await userEvent.click(bold);
    // (c) the toggle reports its state…
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    // (a) …the cancelled pointer-down kept focus in the editor (risk 2)…
    await expect(editor).toHaveFocus();
    // (b) …and the action ran exactly once.
    await expect(count.textContent).toBe(String(before + 1));

    await userEvent.click(bold);
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
    await expect(editor).toHaveFocus();

    // Keyboard users can leave host chrome without ending their edit.
    bold.focus();
    await userEvent.keyboard('{Escape}');
    await expect(editor).toHaveFocus();
  },
};

export const WithPressedState: Story = {
  args: { dir: 'ltr', actions: [] },
  render: (args) => <BubbleDemo dir={args.dir} initialBold />,
  play: async ({ canvasElement }) => {
    // Assertion-only, so rerunning cannot drift state.
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(canvas.getByRole('button', { name: 'Italic' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // One-shot actions carry NO aria-pressed at all.
    await expect(canvas.getByRole('button', { name: 'Link' })).not.toHaveAttribute('aria-pressed');
  },
};

export const DisabledAction: Story = {
  args: { dir: 'ltr', actions: [] },
  render: (args) => <BubbleDemo dir={args.dir} disableLink />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('button', { name: 'Link' });
    await expect(link).toBeDisabled();
    // Clicking a disabled control emits nothing — the counter must not move.
    const count = canvas.getByTestId('run-count');
    const before = Number(count.textContent);
    await userEvent.click(link);
    await expect(count.textContent).toBe(String(before));
  },
};

export const RightToLeft: Story = {
  args: { dir: 'rtl', actions: [] },
  render: (args) => <BubbleDemo dir={args.dir} />,
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    // Assertion-only: the group carries the direction; the arrow offset stays
    // physical because the host's measured geometry already accounts for it.
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: 'Formatting' })).toHaveAttribute('dir', 'rtl');
  },
};

/** P7: the one-field prompt (the link address while formatting tree text). */
export const LinkPrompt: Story = {
  args: {
    dir: 'ltr',
    actions: [],
    prompt: {
      label: 'Link address',
      submitLabel: 'Apply',
      cancelLabel: 'Cancel',
      initialValue: 'https://',
      onSubmit: () => undefined,
      onCancel: () => undefined,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Link address')).toHaveValue('https://');
    await expect(canvas.queryByRole('button', { name: 'Bold' })).toBeNull();
  },
};
