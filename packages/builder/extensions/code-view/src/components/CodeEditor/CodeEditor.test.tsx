import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { CodeEditor, type CodeEditorController } from './CodeEditor';

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

afterEach(cleanup);

/*
  CodeMirror arrives through a lazy import, which outlives testing-library's 1s
  findBy default under a full parallel run. The budget only bounds a hang.
*/
const LAZY_EDITOR_BUDGET = { timeout: 10_000 };

async function readyEditor(label = 'Page source'): Promise<HTMLElement> {
  return screen.findByRole('textbox', { name: label }, LAZY_EDITOR_BUDGET);
}

describe('CodeEditor', () => {
  it('loads CodeMirror lazily and reports real content edits', async () => {
    const onChange = vi.fn();
    render(
      <CodeEditor
        value="const title = 'Before';"
        language="ts"
        label="Page source"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading code editor');
    const editor = await readyEditor();
    await userEvent.click(editor);
    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard("const title = 'After';");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("const title = 'After';");
    });
  });

  it('allows an invalid TSX draft to be saved while exposing its error state', async () => {
    const onSave = vi.fn();
    const source = 'export default () => <main>';
    render(
      <CodeEditor
        value={source}
        language="tsx"
        label="Page source"
        diagnostics={[
          {
            code: 'tsx/close-tag',
            message: 'Expected a closing tag.',
            severity: 'error',
            line: 1,
            column: 27,
          },
        ]}
        onSave={onSave}
      />,
    );

    const editor = await readyEditor();
    expect(editor).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(editor);
    await userEvent.keyboard('{Control>}s{/Control}');
    expect(onSave).toHaveBeenCalledWith(source);
  });

  it('moves the source selection to an activated diagnostic', async () => {
    let controller: CodeEditorController | null = null;
    render(
      <CodeEditor
        value={'first line\nconst broken = ;\nlast line'}
        language="ts"
        label="Page source"
        diagnostics={[
          {
            code: 'ts/expression',
            message: 'Expression expected.',
            severity: 'error',
            line: 2,
            column: 6,
          },
        ]}
        onReady={(next) => {
          controller = next;
        }}
      />,
    );

    const editor = await readyEditor();
    await userEvent.click(screen.getByRole('button', { name: /Expression expected/ }));
    expect(editor).toHaveFocus();
    expect(controller).not.toBeNull();
    expect((controller as CodeEditorController | null)?.getSelection()).toEqual({
      from: 17,
      to: 18,
    });
  });

  it('opens completion from the supplied managed catalog only', async () => {
    let controller: CodeEditorController | null = null;
    render(
      <CodeEditor
        value="But"
        language="tsx"
        label="Page source"
        completions={[
          { label: 'Button', type: 'class', detail: '@craftkit/ui' },
          { label: 'Card', type: 'class', detail: '@craftkit/ui' },
        ]}
        onReady={(next) => {
          controller = next;
        }}
      />,
    );

    await readyEditor();
    expect(controller).not.toBeNull();
    (controller as CodeEditorController | null)?.focus();
    expect((controller as CodeEditorController | null)?.openCompletion()).toBe(true);
    expect(await screen.findByText('Button')).toBeVisible();
    expect(screen.queryByText('UnmanagedWidget')).not.toBeInTheDocument();
  });

  it('renders a CodeMirror unified diff and keeps approval explicit', async () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const { container } = render(
      <CodeEditor
        value="export const title = 'New';"
        language="ts"
        diff={{
          original: "export const title = 'Old';",
          onApprove,
          onReject,
        }}
      />,
    );

    await readyEditor('Source code');
    await waitFor(() => {
      expect(container.querySelector('.cm-changedLine, .cm-deletedChunk')).not.toBeNull();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onApprove).toHaveBeenCalledOnce();
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('keeps source LTR inside RTL chrome and enforces read-only editing', async () => {
    const onChange = vi.fn();
    render(
      <div dir="rtl">
        <CodeEditor
          value="const answer = 42;"
          language="js"
          label="Read-only source"
          readOnly
          onChange={onChange}
        />
      </div>,
    );

    const editor = await readyEditor('Read-only source');
    expect(editor.closest('.bldr-code-editor__surface')).toHaveAttribute('dir', 'ltr');
    expect(editor).toHaveAttribute('contenteditable', 'false');
    await userEvent.click(editor);
    await userEvent.keyboard('changed');
    expect(onChange).not.toHaveBeenCalled();
  });
});
