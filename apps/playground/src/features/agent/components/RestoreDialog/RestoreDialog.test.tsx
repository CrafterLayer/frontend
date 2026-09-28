/**
 * RestoreDialog (SPEC §4.15): a Radix Dialog that confirms restoring the page to before a
 * request, and refuses honestly on a conflict.
 *
 * Focus is the contract (SPEC §6.3), asserted by name: opening focuses Cancel, the answer
 * that changes nothing; closing returns focus to the record's `[⋯]` (the menu item that
 * opened the dialog is gone); a refusal moves focus to Close, the one answer left.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Locale, RestoreResult } from '../../model/view-types';
import { restoreAnswering, restorePending } from '../../testing/wp-13-decisions-fixtures';

import { RestoreDialog } from './RestoreDialog';

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'RestoreDialog',
    'RestoreDialog.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/** A record's [⋯] that opens the dialog, as RecordMenu's "Restore page…" item would. */
function Record({
  onRestore,
  locale = 'en',
}: {
  readonly onRestore: () => Promise<RestoreResult>;
  readonly locale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="ck-agent" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        More options
      </button>
      <RestoreDialog
        locale={locale}
        open={open}
        onOpenChange={setOpen}
        onRestore={onRestore}
        returnFocusRef={trigger}
      />
    </div>
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'More options' }));
  return screen.getByRole('dialog', { name: 'Restore the page to before this request?' });
}

describe('RestoreDialog', () => {
  it('asks, says what it will do, and puts focus on Cancel', async () => {
    const user = userEvent.setup();
    render(<Record onRestore={restoreAnswering('restored')} />);
    const dialog = await openDialog(user);
    expect(dialog).toHaveAccessibleDescription(
      'This request and every page change after it are undone. The conversation stays.',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Restore page' })).toBeInTheDocument();
  });

  it('draws Restore page as an Alarm outline, never the Indigo primary', async () => {
    const user = userEvent.setup();
    render(<Record onRestore={restoreAnswering('restored')} />);
    await openDialog(user);
    const restore = screen.getByRole('button', { name: 'Restore page' });
    expect(restore).toHaveClass('ck-agent-restore__confirm');
    expect(restore).toHaveAttribute('data-ck-tone', 'secondary');
  });

  it('closes on Esc and returns focus to the record’s [⋯]', async () => {
    const user = userEvent.setup();
    render(<Record onRestore={restoreAnswering('restored')} />);
    await openDialog(user);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'More options' })).toHaveFocus();
  });

  it('closes with Cancel and returns focus to the record’s [⋯]', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn(restoreAnswering('restored'));
    render(<Record onRestore={onRestore} />);
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'More options' })).toHaveFocus();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('restores once and closes, focus back on [⋯]', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn(restoreAnswering('restored'));
    render(<Record onRestore={onRestore} />);
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Restore page' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'More options' })).toHaveFocus();
  });

  it('holds while the restore runs: Restore is unavailable and Esc does not dismiss it', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn(restorePending());
    render(<Record onRestore={onRestore} />);
    const dialog = await openDialog(user);
    const restore = screen.getByRole('button', { name: 'Restore page' });
    await user.click(restore);

    expect(restore).toHaveAttribute('aria-disabled', 'true');
    expect(restore).toHaveAccessibleDescription('Restoring the page');
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    await user.click(restore);
    expect(onRestore).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('refuses honestly on a conflict: says why in place, and offers only Close, focused', async () => {
    const user = userEvent.setup();
    render(<Record onRestore={restoreAnswering('conflict')} />);
    const dialog = await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Restore page' }));

    const close = await screen.findByRole('button', { name: 'Close' });
    await waitFor(() => {
      expect(close).toHaveFocus();
    });
    expect(dialog).toHaveAccessibleDescription(
      "Can't restore automatically: the same parts changed after this request.",
    );
    expect(screen.queryByRole('button', { name: 'Restore page' })).toBeNull();

    await user.click(close);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'More options' })).toHaveFocus();
  });

  it('asks afresh each time it opens', async () => {
    const user = userEvent.setup();
    render(<Record onRestore={restoreAnswering('conflict')} />);
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Restore page' }));
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await openDialog(user);
    expect(screen.getByRole('button', { name: 'Restore page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('speaks Arabic in Arabic, inside the panel', async () => {
    const user = userEvent.setup();
    render(<Record locale="ar" onRestore={restoreAnswering('restored')} />);
    await user.click(screen.getByRole('button', { name: 'More options' }));
    const dialog = screen.getByRole('dialog', { name: 'إرجاع الصفحة لما قبل هذا الطلب؟' });
    expect(dialog.closest('.ck-agent')).not.toBeNull();
    expect(dialog).toHaveAttribute('lang', 'ar');
    expect(dialog).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'إلغاء' })).toHaveFocus();
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
