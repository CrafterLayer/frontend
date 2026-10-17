import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AgentRunCard } from './AgentRunCard';

describe('AgentRunCard', () => {
  it('shows one task and clamps invalid progress values', () => {
    render(<AgentRunCard status="running" title="Build landing page" currentTask="Writing Hero" completed={9} total={3} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('Writing Hero')).toBeInTheDocument();
  });

  it('keeps tool and file detail collapsed by default', () => {
    render(<AgentRunCard status="done" title="Updated Hero" completed={1} total={1} details={['pages/home.tsx']} />);
    expect(screen.getByText('Tools and files').closest('details')).not.toHaveAttribute('open');
  });

  it('leads with review and undo after completion', async () => {
    const onReviewDiff = vi.fn();
    const onUndo = vi.fn();
    render(<AgentRunCard status="done" title="Updated Hero" completed={1} total={1} onReviewDiff={onReviewDiff} onUndo={onUndo} />);
    await userEvent.click(screen.getByRole('button', { name: 'Review changes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onReviewDiff).toHaveBeenCalledOnce();
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('offers Stop and revise only for a running card', async () => {
    const onStop = vi.fn();
    render(<AgentRunCard status="running" title="Building" completed={1} total={4} onStop={onStop} />);
    await userEvent.click(screen.getByRole('button', { name: 'Stop and revise' }));
    expect(onStop).toHaveBeenCalledOnce();
  });
});
