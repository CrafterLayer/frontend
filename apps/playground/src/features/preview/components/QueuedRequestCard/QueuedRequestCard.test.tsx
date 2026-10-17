import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { QueuedRequestCard } from './QueuedRequestCard';

describe('QueuedRequestCard', () => {
  it('keeps the captured target visible while the request is edited', async () => {
    const onChange = vi.fn();
    render(<QueuedRequestCard request="Make it larger" context="Home · Hero heading" onChange={onChange} onRemove={() => undefined} />);
    expect(screen.getByText('Target · Home · Hero heading')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Edit queued request' }), '!');
    expect(onChange).toHaveBeenCalledWith('Make it larger!');
  });

  it('removes the one queued request', async () => {
    const onRemove = vi.fn();
    render(<QueuedRequestCard request="Change CTA" context="Home" onChange={() => undefined} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('requires reselection when the captured target disappeared', () => {
    render(<QueuedRequestCard request="Change CTA" context="Deleted CTA" state="missing-target" onChange={() => undefined} onRemove={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a new target');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('requires an explicit continuation after Stop', async () => {
    const onRun = vi.fn();
    render(<QueuedRequestCard request="Change CTA" context="Home" paused onRun={onRun} onChange={() => undefined} onRemove={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onRun).toHaveBeenCalledOnce();
  });
});
