import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PersistenceStatus } from './PersistenceStatus';

describe('PersistenceStatus', () => {
  it('announces saving and durable acknowledgement in a polite live region', () => {
    const { rerender } = render(<PersistenceStatus value={{ kind: 'saving', sequence: 3 }} />);
    expect(screen.getByRole('status', { name: 'Project save status' })).toHaveTextContent(
      'Saving changes',
    );

    rerender(<PersistenceStatus value={{ kind: 'durable', sequence: 4 }} />);
    const status = screen.getByRole('status', { name: 'Project save status' });
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Saved to this device');
    expect(status).not.toHaveTextContent('revision 4');
    expect(status.querySelector('p')).toBeNull();
  });

  it('offers keyboard-accessible recovery and download in session-only mode', async () => {
    const onDownload = vi.fn();
    const onRetry = vi.fn();
    render(
      <div dir="rtl">
        <PersistenceStatus
          value={{ kind: 'session-only', sequence: 5, reason: 'IndexedDB is disabled.' }}
          onDownload={onDownload}
          onRetry={onRetry}
        />
      </div>,
    );
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Download project' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onDownload).toHaveBeenCalledOnce();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('session only');
  });

  it('uses an assertive alert for a failed acknowledgement and keeps source recovery visible', () => {
    render(
      <PersistenceStatus
        value={{
          kind: 'failed',
          sequence: 2,
          reason: 'Storage quota was exceeded.',
          recoverable: true,
        }}
        onDownload={() => undefined}
      />,
    );
    const alert = screen.getByRole('alert', { name: 'Project save status' });
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent('Changes are not saved');
    expect(alert).toHaveTextContent('source is still open');
    expect(screen.getByRole('button', { name: 'Download project' })).toBeEnabled();
  });

  it('does not render recovery actions for a durable acknowledgement', () => {
    render(
      <PersistenceStatus
        value={{ kind: 'durable', sequence: 8 }}
        onDownload={() => undefined}
        onRetry={() => undefined}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('pg-persistence-status');
  });
});
