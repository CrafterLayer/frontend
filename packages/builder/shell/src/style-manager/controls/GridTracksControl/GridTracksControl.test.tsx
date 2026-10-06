import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StyleValue } from '@craftkit/builder-schema';

import { GridTracksControl } from './GridTracksControl';
import { GRID_TRACKS_CONTROL_LABELS_AR } from './GridTracksControl.labels';

afterEach(cleanup);

function setup(value: StyleValue | undefined, mode: 'free' | 'tokens' = 'free') {
  const onCommit = vi.fn();
  render(<GridTracksControl label="Grid columns" value={value} mode={mode} onCommit={onCommit} />);
  return onCommit;
}

describe('GridTracksControl', () => {
  it('edits one track and writes the exact template', async () => {
    const user = userEvent.setup();
    const onCommit = setup({ kind: 'token', token: '3' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Track 2 size' }), '2fr');
    expect(onCommit).toHaveBeenCalledWith({ kind: 'raw', css: '1fr 2fr 1fr' });
  });

  it('adds and removes tracks; equal tracks stay a count token', async () => {
    const user = userEvent.setup();
    const onCommit = setup({ kind: 'token', token: '2' });
    await user.click(screen.getByRole('button', { name: 'Add track' }));
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'token', token: '3' });
    await user.click(screen.getByRole('button', { name: 'Remove track 1' }));
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'token', token: '1' });
  });

  it('says no track is set instead of showing an empty box', () => {
    setup(undefined);
    expect(screen.getByText('Auto · no tracks set')).toBeVisible();
    expect(document.querySelector('.bldr-grid-tracks__preview')).toBeNull();
    cleanup();
    setup({ kind: 'token', token: '2' });
    expect(screen.queryByText('Auto · no tracks set')).toBeNull();
  });

  it('tokens mode edits the count only', () => {
    const onCommit = setup({ kind: 'token', token: '2' }, 'tokens');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Number of tracks: Grid columns' }), {
      target: { value: '4' },
    });
    expect(onCommit).toHaveBeenCalledWith({ kind: 'token', token: '4' });
  });

  it('labels in Arabic', () => {
    render(
      <GridTracksControl
        label="أعمدة الشبكة"
        value={{ kind: 'token', token: '2' }}
        onCommit={vi.fn()}
        labels={GRID_TRACKS_CONTROL_LABELS_AR}
      />,
    );
    expect(screen.getByRole('button', { name: 'إضافة مسار' })).toBeInTheDocument();
  });
});
