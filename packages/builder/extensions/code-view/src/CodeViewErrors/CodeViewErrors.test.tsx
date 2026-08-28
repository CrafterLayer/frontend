import { createRef } from 'react';

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodeViewErrors } from './CodeViewErrors';

afterEach(cleanup);

const errors = [
  { line: 2, message: 'Expected a property name.' },
  { line: 4, message: 'Unknown block type "ghost".' },
] as const;

function renderErrors(overrides: Partial<React.ComponentProps<typeof CodeViewErrors>> = {}) {
  const textareaRef = createRef<HTMLTextAreaElement>();
  const view = render(
    <>
      <textarea
        ref={textareaRef}
        aria-label="Document code"
        defaultValue={'one\ntwo words\nthree\nfour'}
      />
      <CodeViewErrors
        errors={errors}
        source={'one\ntwo words\nthree\nfour'}
        textareaRef={textareaRef}
        announcement="2 code errors found."
        announcementNonce={1}
        {...overrides}
      />
    </>,
  );
  return { textareaRef, view };
}

describe('CodeViewErrors (011 contract p6)', () => {
  it('renders no list for no errors while retaining ONE settled announcement region', () => {
    renderErrors({ errors: [], announcement: 'Code is valid.' });

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    const announcements = screen.getAllByRole('status', { name: 'Code view messages' });
    expect(announcements).toHaveLength(1);
    expect(announcements[0]).toHaveTextContent('Code is valid.');
  });

  it('uses native list semantics and announces the settled parse once, never once per error', () => {
    renderErrors();

    const list = screen.getByRole('list', { name: 'Code errors' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('status', { name: 'Code view messages' })).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Code view messages' })).toHaveTextContent(
      '2 code errors found.',
    );
  });

  it('exposes the supplied stable error-region id exactly while the error list exists', () => {
    const { view } = renderErrors({ id: 'stable-code-errors' });

    expect(screen.getByRole('list', { name: 'Code errors' })).toHaveAttribute(
      'id',
      'stable-code-errors',
    );

    view.unmount();
    renderErrors({ errors: [], id: 'stable-code-errors' });

    expect(document.getElementById('stable-code-errors')).not.toBeInTheDocument();
  });

  it('choosing an error focuses the textarea and selects exactly its one-based source line', async () => {
    const user = userEvent.setup();
    const { textareaRef } = renderErrors();
    const textarea = textareaRef.current;
    if (textarea === null) {
      throw new Error('The textarea ref must be connected.');
    }
    const selection = vi.spyOn(textarea, 'setSelectionRange');

    await user.click(screen.getByRole('button', { name: /line 2.*expected a property name/i }));

    expect(textarea).toHaveFocus();
    expect(selection).toHaveBeenCalledWith(4, 13);
    expect(textarea.selectionStart).toBe(4);
    expect(textarea.selectionEnd).toBe(13);
  });

  it('clamps an out-of-range diagnostic to the source end without throwing', async () => {
    const user = userEvent.setup();
    const { textareaRef } = renderErrors({
      errors: [{ line: 99, message: 'Unexpected end.' }],
      announcement: '1 code error found.',
    });

    await user.click(screen.getByRole('button', { name: /line 99.*unexpected end/i }));

    expect(textareaRef.current).toHaveFocus();
    expect(textareaRef.current?.selectionStart).toBe(24);
    expect(textareaRef.current?.selectionEnd).toBe(24);
  });

  it('keeps line numbers decorative and updates the one live region once per settlement', async () => {
    const { view } = renderErrors();
    const status = screen.getByRole('status', { name: 'Code view messages' });
    const first = status.textContent;
    const list = screen.getByRole('list', { name: 'Code errors' });
    expect(list.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((mutations) => {
      records.push(...mutations);
    });
    observer.observe(status, { characterData: true, childList: true, subtree: true });
    const textareaRef = createRef<HTMLTextAreaElement>();

    view.rerender(
      <>
        <textarea
          ref={textareaRef}
          aria-label="Document code"
          defaultValue={'one\ntwo words\nthree\nfour'}
        />
        <CodeViewErrors
          errors={errors}
          source={'one\ntwo words\nthree\nfour'}
          textareaRef={textareaRef}
          announcement="2 code errors found."
          announcementNonce={2}
        />
      </>,
    );

    await waitFor(() => {
      expect(status.textContent).not.toBe(first);
    });
    observer.disconnect();
    expect(records).toHaveLength(1);
    expect(screen.getAllByRole('status', { name: 'Code view messages' })).toHaveLength(1);
  });
});

describe('CodeViewErrors — line selection edges (011 §4 p6)', () => {
  /** The helper pins one fixed source; these cases need the textarea to match theirs. */
  function renderWithSource(source: string, line: number) {
    const textareaRef = createRef<HTMLTextAreaElement>();
    const view = render(
      <>
        <textarea ref={textareaRef} aria-label="Document code" defaultValue={source} />
        <CodeViewErrors
          errors={[{ line, message: 'Expected a value.' }]}
          source={source}
          textareaRef={textareaRef}
          announcement="1 code error found."
          announcementNonce={1}
        />
      </>,
    );
    const textarea = screen.getByRole('textbox');
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('the harness must render a textarea');
    }
    return { view, textarea };
  }

  it('selects the FIRST line, and a single-line source has no line ending to trim', async () => {
    const source = '{ "broken';
    const { view, textarea } = renderWithSource(source, 1);

    await userEvent.setup().click(screen.getByRole('button', { name: /Line 1:/ }));

    expect(textarea).toHaveFocus();
    expect(textarea.selectionStart).toBe(0);
    // No newline exists, so the selection ends at the text, not past it.
    expect(textarea.selectionEnd).toBe(source.length);
    view.unmount();
  });

  it('clamps a line BEYOND the source instead of selecting nothing addressable', async () => {
    // A parser and an editor can disagree by a line at the very end of a
    // truncated document; the caret must still land somewhere real.
    const source = 'line one\nline two';
    const { view, textarea } = renderWithSource(source, 9);

    await userEvent.setup().click(screen.getByRole('button', { name: /Line 9:/ }));

    expect(textarea).toHaveFocus();
    expect(textarea.selectionStart).toBe(source.length);
    expect(textarea.selectionEnd).toBe(source.length);
    view.unmount();
  });

  it('does nothing at all when the textarea it points at is gone', async () => {
    // The list can outlive a render where the ref has not attached; activating
    // an error then must be inert rather than throw at the author.
    const view = render(
      <CodeViewErrors
        errors={[{ line: 1, message: 'Expected a value.' }]}
        source={'{ "broken'}
        textareaRef={createRef<HTMLTextAreaElement>()}
        announcement="1 code error found."
        announcementNonce={1}
      />,
    );

    await expect(
      userEvent.setup().click(screen.getByRole('button', { name: /Line 1:/ })),
    ).resolves.toBeUndefined();
    view.unmount();
  });
});
