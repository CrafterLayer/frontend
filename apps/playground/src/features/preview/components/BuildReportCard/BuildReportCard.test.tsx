import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { BuildProgress, BuildTask } from '../AssistantPanel/AssistantPanel.build';
import type { BuiltTurn } from '../AssistantPanel/AssistantPanel.turns';
import { BuildReportCard } from './BuildReportCard';

const task = (position: number, title: string, status: BuildTask['status']): BuildTask => ({
  id: `t${String(position)}`,
  position,
  title,
  status,
  attempts: 1,
});

function report(overrides: Partial<BuiltTurn> = {}, tasks?: readonly BuildTask[]): BuiltTurn {
  const rows = tasks ?? [
    task(1, 'Hero', 'applied'),
    task(2, 'Proof', 'applied'),
    task(3, 'Contact', 'applied'),
  ];
  const progress: BuildProgress = {
    runId: 'run',
    phase: 'completed',
    direction: 'A calm clinic page.',
    tasks: rows,
    startedAt: 0,
    applied: rows.filter((row) => row.status === 'applied').length,
    skipped: rows.filter((row) => row.status === 'skipped').length,
    run: null,
  };
  return {
    id: 'turn-1',
    from: 'assistant',
    kind: 'built',
    progress,
    undoable: true,
    ...overrides,
  };
}

function renderCard(turn = report(), props: Partial<Parameters<typeof BuildReportCard>[0]> = {}) {
  const onUndoTask = vi.fn();
  const onRetrySkipped = vi.fn();
  render(
    <BuildReportCard
      report={turn}
      turnId={turn.id}
      busy={false}
      canUndo
      onUndoTask={onUndoTask}
      onRetrySkipped={onRetrySkipped}
      {...props}
    />,
  );
  return { onUndoTask, onRetrySkipped, user: userEvent.setup() };
}

describe('BuildReportCard', () => {
  it('says how many sections landed', () => {
    renderCard();
    expect(screen.getByText('3/3')).toBeVisible();
  });

  it('undoes ONE section, naming which — not the whole build', () => {
    /*
      Each section landed as its own transaction, which is the fact that made
      pressing Build safe. The report is where that promise is kept.
    */
    const { onUndoTask, user } = renderCard();

    return user.click(screen.getByRole('button', { name: 'Undo Proof' })).then(() => {
      expect(onUndoTask).toHaveBeenCalledWith(2, 3, 'Proof', 0);
    });
  });

  it('withholds every Undo when the panel may not write', () => {
    /*
      Plan mode is a promise about this panel, and this button loops
      `kernel.undo()` — it writes MORE than the others, not less.
    */
    renderCard(report(), { canUndo: false });
    expect(screen.queryByRole('button', { name: /^Undo / })).not.toBeInTheDocument();
  });

  it('offers to retry ONLY the sections that were skipped', async () => {
    // `request` is what a retry re-sends, so a report without one offers none.
    const skipped = report({ request: 'build a clinic page' }, [
      task(1, 'Hero', 'applied'),
      task(2, 'Proof', 'skipped'),
      task(3, 'Contact', 'skipped'),
    ]);
    const { onRetrySkipped, user } = renderCard(skipped);

    await user.click(screen.getByRole('button', { name: 'Retry skipped' }));

    expect(onRetrySkipped).toHaveBeenCalledExactlyOnceWith(['Proof', 'Contact']);
  });

  it('does not offer a retry when nothing was skipped', () => {
    renderCard(report({ request: 'build a clinic page' }));
    expect(screen.queryByRole('button', { name: 'Retry skipped' })).not.toBeInTheDocument();
  });

  it('does not offer a retry it could not send — a revived report has no request', () => {
    /*
      Persistence keeps the report as readable history and drops the request
      that produced it. A Retry button with nothing to re-send would be a
      button that does nothing.
    */
    const revived = report({}, [task(1, 'Hero', 'applied'), task(2, 'Proof', 'skipped')]);
    renderCard(revived);

    expect(screen.queryByRole('button', { name: 'Retry skipped' })).not.toBeInTheDocument();
  });

  it('does not start a retry while the assistant is already working', () => {
    const skipped = report({ request: 'build a clinic page' }, [
      task(1, 'Hero', 'applied'),
      task(2, 'Proof', 'skipped'),
    ]);
    renderCard(skipped, { busy: true });

    expect(screen.getByRole('button', { name: 'Retry skipped' })).toBeDisabled();
  });

  it('reads as STOPPED when the build was cut short, not as built', () => {
    renderCard(report({ stopped: true }));

    expect(screen.getByText('Stopped')).toBeVisible();
    expect(screen.queryByText('Built')).not.toBeInTheDocument();
  });
});
