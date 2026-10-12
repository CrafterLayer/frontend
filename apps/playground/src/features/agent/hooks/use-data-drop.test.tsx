/**
 * useDataDrop (2026-10-12): a data file dragged over the panel shows what it takes, dropped it
 * fills the draft under the instruction line, and any other file is refused in the same place.
 * jsdom has no DataTransfer, so each event carries a stand-in with `types` and `files`.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { dropLabels } from '../copy/drop-labels';
import type { Locale } from '../model/view-types';
import { DATA_DROP_MAX_BYTES, dataDraft, useDataDrop } from './use-data-drop';

const EN = dropLabels('en');
const AR = dropLabels('ar');

function Host({
  locale = 'en',
  initial = '',
}: {
  readonly locale?: Locale;
  readonly initial?: string;
}) {
  const [draft, setDraft] = useState(initial);
  const root = useRef<HTMLElement | null>(null);
  const input = useRef<HTMLTextAreaElement | null>(null);
  useDataDrop(root, { locale, draft, setDraft, inputRef: input });
  return (
    <section ref={root} data-testid="panel">
      <textarea
        ref={input}
        aria-label="Message"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
    </section>
  );
}

function transfer(files: readonly File[] = [], types: readonly string[] = ['Files']) {
  return { dataTransfer: { types, files, dropEffect: 'none' } };
}

function setup(props: { readonly locale?: Locale; readonly initial?: string } = {}) {
  render(<Host {...props} />);
  return {
    panel: screen.getByTestId('panel'),
    field: screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' }),
  };
}

describe('dataDraft', () => {
  it('puts the rows under the instruction, or under the person’s own words', () => {
    expect(dataDraft('', 'A,B\r\nx,1\n', 'Chart this:')).toBe('Chart this:\nA,B\nx,1');
    expect(dataDraft('Bar chart of sales  ', 'A,B\nx,1', 'Chart this:')).toBe(
      'Bar chart of sales\nA,B\nx,1',
    );
  });
});

describe('useDataDrop', () => {
  it('shows what it takes while a file is dragged over, and lets go on leave', () => {
    const { panel } = setup();
    fireEvent.dragEnter(panel, transfer());
    expect(panel).toHaveAttribute('data-drop', 'over');
    expect(panel).toHaveAttribute('data-drop-label', EN.hint);
    fireEvent.dragLeave(panel, { relatedTarget: document.body });
    expect(panel).not.toHaveAttribute('data-drop');
  });

  it('ignores a drag that carries no file (a text selection)', () => {
    const { panel } = setup();
    const event = fireEvent.dragOver(panel, transfer([], ['text/plain']));
    expect(event).toBe(true);
    expect(panel).not.toHaveAttribute('data-drop');
  });

  it('fills the draft with the dropped rows under the instruction, caret at the end', async () => {
    const { panel, field } = setup();
    const csv = new File(['Month,Sales\nJan,120\n'], 'sales.csv', { type: 'text/csv' });
    fireEvent.dragOver(panel, transfer([csv]));
    const allowed = fireEvent.drop(panel, transfer([csv]));
    expect(allowed).toBe(false);
    await waitFor(() => {
      expect(field).toHaveValue('Chart this:\nMonth,Sales\nJan,120');
    });
    expect(field).toHaveFocus();
    expect(panel).not.toHaveAttribute('data-drop');
  });

  it('keeps the person’s words and writes the Arabic instruction in Arabic', async () => {
    const { panel, field } = setup({ locale: 'ar' });
    const md = new File(['| أ | ب |\n|---|---|\n| س | ١ |'], 'table.md', { type: 'text/markdown' });
    fireEvent.drop(panel, transfer([md]));
    await waitFor(() => {
      expect(field.value.startsWith(`${AR.instruction}\n| أ | ب |`)).toBe(true);
    });
  });

  it('refuses another file, or one too large, for a few seconds', () => {
    vi.useFakeTimers();
    try {
      const { panel, field } = setup({ initial: 'Keep me' });
      fireEvent.drop(panel, transfer([new File(['x'], 'photo.png', { type: 'image/png' })]));
      expect(panel).toHaveAttribute('data-drop', 'refused');
      expect(panel).toHaveAttribute('data-drop-label', EN.refused);
      act(() => {
        vi.advanceTimersByTime(3_100);
      });
      expect(panel).not.toHaveAttribute('data-drop');
      const big = new File(['a'.repeat(DATA_DROP_MAX_BYTES + 1)], 'big.csv', { type: 'text/csv' });
      fireEvent.drop(panel, transfer([big]));
      expect(panel).toHaveAttribute('data-drop-label', EN.tooLarge);
      expect(field).toHaveValue('Keep me');
    } finally {
      vi.useRealTimers();
    }
  });
});
