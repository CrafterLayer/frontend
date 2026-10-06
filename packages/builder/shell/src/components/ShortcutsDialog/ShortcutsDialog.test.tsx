import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { EDITOR_SHORTCUTS } from '../../keyboard/editor-shortcuts';
import { ShortcutsDialog } from './ShortcutsDialog';
import { SHORTCUTS_DIALOG_LABELS_AR } from './ShortcutsDialog.labels';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Help
      </button>
      <ShortcutsDialog
        open={open}
        platform="mac"
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

describe('ShortcutsDialog', () => {
  it('lists every keymap row, grouped, with platform key names', () => {
    render(<ShortcutsDialog open platform="other" onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    for (const def of EDITOR_SHORTCUTS) {
      const row = dialog.querySelector(`[data-shortcut="${def.id}"]`);
      expect(row?.querySelector('dt')).toHaveTextContent(def.labels.en);
    }
    const undo = dialog.querySelector('[data-shortcut="undo"]');
    expect(undo).toHaveTextContent('CtrlZ');
    const redo = dialog.querySelector('[data-shortcut="redo"]');
    expect(redo).toHaveTextContent('or');
    expect(within(dialog).getByRole('region', { name: 'Copy and paste' })).toBeInTheDocument();
  });

  it('prints ⌘ and ⌥ on macOS and speaks Arabic', () => {
    render(<ShortcutsDialog open platform="mac" labels={SHORTCUTS_DIALOG_LABELS_AR} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'اختصارات لوحة المفاتيح' });
    expect(dialog.querySelector('[data-shortcut="copyStyle"]')).toHaveTextContent('⌘⌥C');
    expect(within(dialog).getByText('نسخ التنسيق')).toBeInTheDocument();
  });

  it('takes focus on open, keeps Tab inside, closes on Escape and gives focus back', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Help' });
    await user.click(trigger);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('renders nothing while closed', () => {
    render(<ShortcutsDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
