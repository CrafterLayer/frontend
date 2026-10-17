import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MentionPicker } from './MentionPicker';

const candidates = [
  { id: 'hero', type: 'hero', excerpt: 'ابنِ موقعك' },
  { id: 'spacer-1', type: 'spacer' },
];

describe('MentionPicker', () => {
  it('is a listbox of options', () => {
    render(<MentionPicker candidates={candidates} onPick={() => undefined} />);
    expect(screen.getByRole('listbox', { name: 'Mention a block' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('shows each block by id, type and its first words', () => {
    render(<MentionPicker candidates={candidates} onPick={() => undefined} />);
    const row = screen.getByRole('option', { name: /@hero/ });
    expect(row).toHaveTextContent('hero');
    expect(row).toHaveTextContent('ابنِ موقعك');
  });

  it('renders a block with no words by id and type alone', () => {
    render(<MentionPicker candidates={candidates} onPick={() => undefined} />);
    const row = screen.getByRole('option', { name: /@spacer-1/ });
    expect(row).toHaveTextContent('spacer');
    expect(row.querySelector('.pg-chat__mention-excerpt')).toBeNull();
  });

  it('reports no keyboard selection, because there is no cursor to move', () => {
    render(<MentionPicker candidates={candidates} onPick={() => undefined} />);
    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('hands the picked id back', async () => {
    const onPick = vi.fn();
    render(<MentionPicker candidates={candidates} onPick={onPick} />);
    await userEvent.click(screen.getByRole('option', { name: /@spacer-1/ }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith('spacer-1');
  });

  it('stays open and says so when nothing matches', () => {
    render(<MentionPicker candidates={[]} onPick={() => undefined} />);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('No matching block.')).toBeInTheDocument();
  });
});
