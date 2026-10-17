import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { RunRecord, RunUnitRecord, RunUnitStatus } from '../../../vault/run-journal';
import type { InterruptedCardProps } from './InterruptedCard';
import { InterruptedCard } from './InterruptedCard';

const unit = (
  position: number,
  title: string,
  status: RunUnitStatus,
  reason?: string,
): RunUnitRecord => ({
  position,
  id: `n${String(position)}`,
  title,
  status,
  attempts: 1,
  ...(reason === undefined ? {} : { reason }),
});

function recordWith(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    runId: 'run-1',
    docId: 'doc',
    pageId: 'home',
    request: 'ابنِ لي صفحة استوديو خزف',
    mode: 'ask',
    providerKind: 'offline',
    baseFingerprint: 'doc-v1-sha256-abc',
    limits: { maxTasks: 12, taskTimeoutMs: 240_000, buildBudgetMs: 900_000 },
    status: 'stopped',
    stage: 'planned',
    units: [
      unit(1, 'Hero', 'applied'),
      unit(2, 'Work', 'skipped', 'refused on landing'),
      unit(3, 'Contact', 'waiting'),
    ],
    spent: { elapsedMs: 4000, tasksStarted: 2 },
    createdAt: 0,
    updatedAt: 1,
    heartbeatAt: 1,
    ...overrides,
  };
}

function renderCard(overrides: Partial<InterruptedCardProps> = {}) {
  const props: InterruptedCardProps = {
    record: recordWith(),
    locale: 'en',
    onResume: vi.fn(),
    onRestart: vi.fn(),
    onKeep: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides,
  };
  render(<InterruptedCard {...props} />);
  return props;
}

describe('InterruptedCard', () => {
  it('says what was asked for, in the person’s own words', () => {
    renderCard();
    expect(screen.getByText('ابنِ لي صفحة استوديو خزف')).toHaveAttribute('dir', 'auto');
  });

  it('counts what landed against what was planned', () => {
    renderCard();
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('names EVERY section and what happened to it — a count does not say which', () => {
    renderCard();
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Herowritten',
      'Workrefused on landing',
      'Contactnot written',
    ]);
  });

  describe('the four actions', () => {
    it('offers all four when the run can be continued', async () => {
      const props = renderCard();
      await userEvent.click(screen.getByRole('button', { name: /Resume/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Keep what worked' }));
      await userEvent.click(screen.getByRole('button', { name: 'Start over' }));
      await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(props.onResume).toHaveBeenCalledOnce();
      expect(props.onKeep).toHaveBeenCalledOnce();
      expect(props.onRestart).toHaveBeenCalledOnce();
      expect(props.onDiscard).toHaveBeenCalledOnce();
    });

    it('names the section a resume would start from, skipping one already refused', () => {
      renderCard();
      /*
        Not "Work". That section was attempted and refused twice; continuing
        means going on to the first section nobody has tried yet. Retrying the
        refused ones is a different action with a different request.
      */
      expect(screen.getByRole('button', { name: 'Resume — Contact' })).toBeInTheDocument();
    });

    it('offers no Keep when nothing landed — there is nothing to keep', () => {
      renderCard({
        record: recordWith({ units: [unit(1, 'Hero', 'skipped', 'refused')] }),
      });
      expect(screen.queryByRole('button', { name: 'Keep what worked' })).toBeNull();
    });

    it('closes every action while another run owns the panel', () => {
      renderCard({ busy: true });
      for (const button of screen.getAllByRole('button')) {
        expect(button).toBeDisabled();
      }
    });
  });

  describe('when a resume is impossible', () => {
    it('withdraws Resume rather than showing a control that could never light up', () => {
      renderCard({
        record: recordWith({
          units: [unit(1, 'Hero', 'applied'), unit(2, 'Work', 'skipped', 'refused')],
        }),
      });
      expect(screen.queryByRole('button', { name: /Resume/ })).toBeNull();
      expect(
        screen.getByText('Nothing to continue: every section was either written or refused.'),
      ).toBeInTheDocument();
    });

    it('withdraws it for a run that never reached a section list', () => {
      renderCard({ record: recordWith({ stage: 'scaffolding', units: [] }) });
      expect(screen.queryByRole('button', { name: /Resume/ })).toBeNull();
    });

    it('withdraws it when the host cannot resume even though the record could', () => {
      renderCard({ onResume: undefined });
      expect(screen.queryByRole('button', { name: /Resume/ })).toBeNull();
    });
  });

  it('warns that a skeleton is already on the page, so Start over does not lay a second', () => {
    renderCard({ record: recordWith({ stage: 'scaffolding', units: [] }) });
    expect(
      screen.getByText('A skeleton is already on the page — starting over removes it first.'),
    ).toBeInTheDocument();
  });

  it('does not warn once the section list exists', () => {
    renderCard();
    expect(screen.queryByText(/skeleton is already on the page/u)).toBeNull();
  });

  it('speaks Arabic when the panel does', () => {
    renderCard({ locale: 'ar' });
    expect(screen.getByText('تشغيل لم يكتمل')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'احتفظ بما نجح' })).toBeInTheDocument();
  });
});
