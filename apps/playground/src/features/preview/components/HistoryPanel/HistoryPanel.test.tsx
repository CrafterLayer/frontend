import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import { createMemoryVaultStore, createSnapshotShelf, type SnapshotShelf } from '../../../vault';
import { HistoryPanel } from './HistoryPanel';
import { HISTORY_PANEL_LABELS_AR } from './HistoryPanel.labels';

/** A clock the test states, so "3 min ago" is an assertion and not a guess. */
function clock(start: number): { now: () => number; advance: (ms: number) => void } {
  let value = start;
  return {
    now: () => value,
    advance: (ms) => {
      value += ms;
    },
  };
}

function shelfFor(docId = 'doc'): SnapshotShelf {
  return createSnapshotShelf({ store: createMemoryVaultStore(), docId });
}

async function panel(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'History' });
}

describe('HistoryPanel', () => {
  it('says what will fill it before anything has been saved', async () => {
    render(
      <HistoryPanel kernel={createPlaygroundKernel({ fixture: 'empty' })} shelf={shelfFor()} />,
    );

    const region = await panel();
    // Not "No items": an empty state that does not say how it stops being
    // empty is a dead end in the interface.
    expect(within(region).getByText(/save a restore point/i)).toBeInTheDocument();
    expect(within(region).queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('saves a named restore point and lists the newest first', async () => {
    const time = clock(1_700_000_000_000);
    const user = userEvent.setup();
    render(
      <HistoryPanel
        kernel={createPlaygroundKernel({ fixture: 'empty' })}
        shelf={shelfFor()}
        now={time.now}
      />,
    );
    const region = await panel();

    await user.type(within(region).getByRole('textbox', { name: 'Name' }), 'First pass');
    await user.click(within(region).getByRole('button', { name: 'Save restore point' }));
    await waitFor(() => {
      expect(within(region).getAllByRole('listitem')).toHaveLength(1);
    });

    time.advance(4 * 60_000);
    await user.type(within(region).getByRole('textbox', { name: 'Name' }), 'Second pass');
    await user.click(within(region).getByRole('button', { name: 'Save restore point' }));
    await waitFor(() => {
      expect(within(region).getAllByRole('listitem')).toHaveLength(2);
    });

    const rows = within(region).getAllByRole('listitem');
    // Newest first — the order a person reads a history in.
    expect(rows[0]?.textContent).toContain('Second pass');
    expect(rows[1]?.textContent).toContain('First pass');
    // Age and size, both read off the stored entry rather than recomputed.
    expect(rows[0]?.textContent).toContain('just now');
    expect(rows[1]?.textContent).toContain('4 min ago');
    expect(rows[1]?.textContent).toMatch(/\d+ B|kB/);
  });

  it('restores a row as ONE change, and announces what happened', async () => {
    const user = userEvent.setup();
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    render(<HistoryPanel kernel={kernel} shelf={shelfFor()} />);
    const region = await panel();

    await user.type(within(region).getByRole('textbox', { name: 'Name' }), 'Left to right');
    await user.click(within(region).getByRole('button', { name: 'Save restore point' }));
    await waitFor(() => {
      expect(within(region).getAllByRole('listitem')).toHaveLength(1);
    });

    act(() => {
      kernel.dispatch('setDocMeta', { dir: 'rtl' });
    });
    expect(kernel.getDocument().dir).toBe('rtl');
    const before = kernel.transactions().length;

    await user.click(within(region).getByRole('button', { name: 'Restore Left to right' }));
    await waitFor(() => {
      expect(kernel.getDocument().dir).toBe('ltr');
    });
    // The revert is a forward change through the applyPatches door: exactly one
    // transaction, so exactly one undo puts the page back.
    expect(kernel.transactions()).toHaveLength(before + 1);
    expect(kernel.validate()).toEqual([]);
    expect(within(region).getByRole('status', { name: 'History status' })).toHaveTextContent(
      'Left to right',
    );

    act(() => {
      kernel.undo();
    });
    expect(kernel.getDocument().dir).toBe('rtl');
  });

  it('says so, and changes nothing, when the page already matches the restore point', async () => {
    const user = userEvent.setup();
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    render(<HistoryPanel kernel={kernel} shelf={shelfFor()} />);
    const region = await panel();

    await user.click(within(region).getByRole('button', { name: 'Save restore point' }));
    await waitFor(() => {
      expect(within(region).getAllByRole('listitem')).toHaveLength(1);
    });
    const before = kernel.transactions().length;

    await user.click(within(region).getByRole('button', { name: /^Restore / }));
    await waitFor(() => {
      expect(within(region).getByRole('status', { name: 'History status' })).toHaveTextContent(
        /already matches/i,
      );
    });
    // `applyPatches` refuses an empty batch, so a no-op revert must never reach
    // the door at all.
    expect(kernel.transactions()).toHaveLength(before);
  });

  it('clears the whole shelf, and the empty state comes back', async () => {
    const user = userEvent.setup();
    const shelf = shelfFor();
    render(<HistoryPanel kernel={createPlaygroundKernel({ fixture: 'empty' })} shelf={shelf} />);
    const region = await panel();

    await user.click(within(region).getByRole('button', { name: 'Save restore point' }));
    await waitFor(() => {
      expect(within(region).getAllByRole('listitem')).toHaveLength(1);
    });

    await user.click(within(region).getByRole('button', { name: 'Clear history' }));
    await waitFor(() => {
      expect(within(region).queryByRole('listitem')).not.toBeInTheDocument();
    });
    expect(await shelf.list()).toEqual([]);
    expect(within(region).getByText(/save a restore point/i)).toBeInTheDocument();
  });
  it('says the restore points could not be READ, instead of pretending there are none', async () => {
    const inner = shelfFor();
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    await inner.save({
      label: 'Before the AI rewrite',
      ts: 1_700_000_000_000,
      seq: 0,
      document: kernel.getDocument(),
    });
    const shelf: SnapshotShelf = {
      save: (entry) => inner.save(entry),
      list: () => Promise.reject(new Error('shelf read failed')),
      read: (id) => inner.read(id),
      clear: () => inner.clear(),
    };

    render(<HistoryPanel kernel={kernel} shelf={shelf} />);
    const region = await panel();

    // The restore point is still on disk. Telling a person it is not — while
    // offering "Clear history" beside the claim — is the worst of both.
    await waitFor(() => {
      expect(within(region).getByText(/could not be read/i)).toBeInTheDocument();
    });
    expect(within(region).queryByText(/nothing kept yet/i)).not.toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Clear history' })).toBeDisabled();
  });

  it('announces a restore storage refused, rather than doing nothing at all', async () => {
    const user = userEvent.setup();
    const inner = shelfFor();
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    await inner.save({
      label: 'Before the AI rewrite',
      ts: 1_700_000_000_000,
      seq: 0,
      document: kernel.getDocument(),
    });
    const shelf: SnapshotShelf = {
      save: (entry) => inner.save(entry),
      list: () => inner.list(),
      read: () => Promise.reject(new Error('shelf read failed')),
      clear: () => inner.clear(),
    };

    render(<HistoryPanel kernel={kernel} shelf={shelf} />);
    const region = await panel();
    await waitFor(() => {
      expect(within(region).getAllByRole('listitem')).toHaveLength(1);
    });

    await user.click(within(region).getByRole('button', { name: 'Restore Before the AI rewrite' }));
    // A button that silently does nothing is indistinguishable from a broken
    // one; every other action in this panel already says what happened.
    await waitFor(() => {
      expect(within(region).getByText(/could not be read/i)).toBeInTheDocument();
    });
  });

  it('reads in Arabic with the Arabic labels, ages agreeing in number', async () => {
    const time = clock(1_700_000_000_000);
    const user = userEvent.setup();
    render(
      <HistoryPanel
        kernel={createPlaygroundKernel({ fixture: 'empty' })}
        shelf={shelfFor()}
        now={time.now}
        labels={HISTORY_PANEL_LABELS_AR}
      />,
    );
    const region = await screen.findByRole('region', { name: 'السجل' });
    // The region keeps the destination's name; its heading names the section (restore points).
    expect(within(region).getByRole('heading', { name: 'نقاط الاستعادة' })).toBeVisible();
    expect(region).toHaveTextContent('لا شيء محفوظ بعد.');
    const name = within(region).getByRole('textbox', { name: 'الاسم' });
    expect(name).toHaveAttribute('placeholder', 'قبل إعادة الكتابة');
    expect(within(region).getByRole('button', { name: 'مسح السجل' })).toBeDisabled();

    await user.click(within(region).getByRole('button', { name: 'حفظ نقطة استعادة' }));
    await waitFor(() => {
      expect(within(region).getAllByRole('listitem')).toHaveLength(1);
    });
    expect(within(region).getByRole('status', { name: 'حالة السجل' })).toHaveTextContent(
      'حُفظت «نقطة استعادة 1».',
    );
    time.advance(2 * 60_000);
    await user.type(name, 'المسودة الثانية');
    await user.click(within(region).getByRole('button', { name: 'حفظ نقطة استعادة' }));
    await waitFor(() => {
      expect(within(region).getAllByRole('listitem')).toHaveLength(2);
    });
    const rows = within(region).getAllByRole('listitem');
    expect(rows[0]?.textContent).toContain('الآن');
    expect(rows[1]?.textContent).toContain('قبل دقيقتين');
    expect(rows[1]?.textContent).toMatch(/\d+ (بايت|كيلوبايت)/);
    expect(
      within(region).getByRole('button', { name: 'استعادة نقطة استعادة 1' }),
    ).toHaveTextContent('استعادة');
    expect(rows[0]?.textContent ?? '').not.toMatch(/[A-Za-z]/);

    expect(HISTORY_PANEL_LABELS_AR.minutesAgo(1)).toBe('قبل دقيقة');
    expect(HISTORY_PANEL_LABELS_AR.minutesAgo(3)).toBe('قبل 3 دقائق');
    expect(HISTORY_PANEL_LABELS_AR.minutesAgo(11)).toBe('قبل 11 دقيقة');
    expect(HISTORY_PANEL_LABELS_AR.daysAgo(11)).toBe('قبل 11 يومًا');

    await user.click(within(region).getByRole('button', { name: 'مسح السجل' }));
    await waitFor(() => {
      expect(within(region).getByRole('status', { name: 'حالة السجل' })).toHaveTextContent(
        'مُسح السجل.',
      );
    });
  });
});
