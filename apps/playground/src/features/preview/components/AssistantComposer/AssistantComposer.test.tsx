import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AssistantComposerProps } from './AssistantComposer';
import { AssistantComposer } from './AssistantComposer';

/**
 * The composer is CONTROLLED: it renders the `draft` it is handed and reports
 * changes upward. A test that hands it a constant string and a spy therefore
 * types into a field that never grows — every keystroke replaces the last, so
 * `@` then `h` reads as the single character `h` and no mention is ever open.
 *
 * This harness holds the draft the way the panel does, and spies alongside.
 */
function Harness({ spy, ...props }: AssistantComposerProps & { spy: (draft: string) => void }) {
  const [draft, setDraft] = useState(props.draft);
  return (
    <AssistantComposer
      {...props}
      draft={draft}
      onDraftChange={(next) => {
        setDraft(next);
        spy(next);
      }}
    />
  );
}

function renderComposer(overrides: Partial<AssistantComposerProps> = {}) {
  const onDraftChange = vi.fn();
  const props: AssistantComposerProps = {
    draft: '',
    onDraftChange,
    inputId: 'composer',
    busy: false,
    onSend: vi.fn(),
    onStop: vi.fn(),
    onFocusChange: vi.fn(),
    mentionQuery: null,
    onMentionQueryChange: vi.fn(),
    mentionCandidates: [],
    onPickMention: vi.fn(),
    mode: 'auto',
    onModeChange: vi.fn(),
    modeLockId: 'mode-lock',
    locale: 'ar',
    ...overrides,
  };
  render(<Harness {...props} spy={onDraftChange} />);
  return props;
}

describe('AssistantComposer', () => {
  it('cannot send an empty request', () => {
    renderComposer();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('sends on Enter and writes a line on Shift+Enter', async () => {
    const props = renderComposer({ draft: 'أضف قسم أسعار' });
    const field = screen.getByRole('textbox');
    await userEvent.type(field, '{Enter}');
    expect(props.onSend).toHaveBeenCalledOnce();
    await userEvent.type(field, '{Shift>}{Enter}{/Shift}');
    expect(props.onSend).toHaveBeenCalledOnce();
  });

  it('reads the mention from the text BEFORE the caret', async () => {
    const props = renderComposer();
    await userEvent.type(screen.getByRole('textbox'), '@he');
    expect(props.onMentionQueryChange).toHaveBeenLastCalledWith('he');
  });

  it('does not open a picker for a mention the caret is not inside', async () => {
    /*
      The caret is put at the START of a field that already ends in `@hero`, and
      one character is typed there. Reading the whole value would match that
      trailing mention and open a picker at the other end of the line, under no
      caret at all — which is exactly what the slice prevents. Typing at the end
      would not catch it: the pattern is anchored, so both readings agree there.
    */
    const props = renderComposer({ draft: '@hero' });
    await userEvent.type(screen.getByRole('textbox'), 'ب', {
      initialSelectionStart: 0,
      initialSelectionEnd: 0,
    });
    expect(props.onMentionQueryChange).toHaveBeenLastCalledWith(null);
  });

  it('closes the picker once the mention is finished by a space', async () => {
    const props = renderComposer();
    await userEvent.type(screen.getByRole('textbox'), '@hero ');
    expect(props.onMentionQueryChange).toHaveBeenLastCalledWith(null);
  });

  it('closes the open picker on Escape without sending', async () => {
    const props = renderComposer({ mentionQuery: 'he' });
    await userEvent.type(screen.getByRole('textbox'), '{Escape}');
    expect(props.onMentionQueryChange).toHaveBeenLastCalledWith(null);
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('shows the picker only while a mention is open', () => {
    renderComposer();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('lists the candidates it was handed', () => {
    renderComposer({
      mentionQuery: 'he',
      mentionCandidates: [{ id: 'hero', type: 'hero' }],
    });
    expect(screen.getByRole('option', { name: /@hero/ })).toBeInTheDocument();
  });

  describe('while a run is in flight', () => {
    it('keeps the field writable for one next request and turns the send slot into Stop', async () => {
      const props = renderComposer({ busy: true, draft: 'أضف قسم' });
      expect(screen.getByRole('textbox')).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Queue next' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
      expect(props.onStop).toHaveBeenCalledOnce();
      expect(props.onSend).not.toHaveBeenCalled();
    });

    it('accepts only one queued request while leaving its draft readable', () => {
      renderComposer({ busy: true, queued: true, draft: 'Already queued' });
      expect(screen.getByRole('textbox')).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Queue next' })).toBeDisabled();
    });

    it('says why the modes are locked, on the line that carries mode information', () => {
      renderComposer({ busy: true });
      const hint = screen.getByText('Stop the request to change mode.');
      expect(hint).toHaveAttribute('id', 'mode-lock');
      // The explanation is NOT inside the radiogroup: that is what wrapped over
      // the action row and made the composer look broken.
      expect(screen.getByRole('radiogroup')).not.toContainElement(hint);
    });

    it('never leaves the run unreachable — Stop is always the last control', () => {
      renderComposer({ busy: true });
      expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
    });
  });

  it('keeps model choice beside the mode controls', async () => {
    const onSelectModel = vi.fn();
    renderComposer({
      models: ['openai/gpt-5.6-luna', 'openai/gpt-5.6-sol'],
      model: 'openai/gpt-5.6-luna',
      onSelectModel,
    });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Model' }), 'openai/gpt-5.6-sol');
    expect(onSelectModel).toHaveBeenCalledWith('openai/gpt-5.6-sol');
  });

  it('describes the chosen mode when idle', () => {
    renderComposer();
    expect(screen.queryByText('Stop the request to change mode.')).toBeNull();
    expect(document.getElementById('mode-lock')?.textContent).not.toBe('');
  });

  it('does not restate the undo guarantee in the composer', () => {
    /*
      The owner took this line out (it is still in the source, commented, at
      AssistantComposer.tsx). The claim was true and still is — every apply is
      one entry in history — but it was being said in the one place a person is
      composing rather than deciding, on every keystroke. The plan card carries
      it at the moment it matters.

      Asserting its ABSENCE rather than deleting the test: if it comes back, this
      fails and says so, instead of the change landing unnoticed.
    */
    renderComposer();
    expect(screen.queryByText('One change. One undo.')).toBeNull();
  });
});
