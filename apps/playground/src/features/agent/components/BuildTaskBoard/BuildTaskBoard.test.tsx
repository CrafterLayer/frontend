import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { t } from '../../copy';
import type { BuildPhase, RowState, SpineRowView } from '../../model/view-types';

import { BuildTaskBoard } from './BuildTaskBoard';

function rows(states: readonly RowState[]): readonly SpineRowView[] {
  return states.map((state, index) => ({
    key: `section-${String(index + 1)}`,
    title: `Section ${String(index + 1)}`,
    position: index + 1,
    total: states.length,
    state,
    canRetry: false,
  }));
}

describe('BuildTaskBoard', () => {
  it('reports real active tasks separately from pool capacity and landed progress', () => {
    render(
      <BuildTaskBoard
        locale="en"
        phase="building"
        writers={6}
        rows={rows(['landed', 'writing', 'retrying', 'drafted', 'waiting', 'failed'])}
      />,
    );
    const board = screen.getByRole('region', { name: t('en', 'tasks.label') });
    expect(within(board).getByText(t('en', 'tasks.coordinator'))).toBeInTheDocument();
    expect(within(board).getByText(t('en', 'tasks.active', { n: 2 }))).toBeInTheDocument();
    expect(within(board).getByText(t('en', 'tasks.pool', { n: 6 }))).toBeInTheDocument();
    expect(within(board).getByText(t('en', 'tasks.queued', { n: 1 }))).toBeInTheDocument();
    expect(within(board).getByText(t('en', 'tasks.drafted', { n: 1 }))).toBeInTheDocument();
    expect(within(board).getByText(t('en', 'tasks.failed', { n: 1 }))).toBeInTheDocument();
    expect(within(board).getByRole('progressbar')).toHaveAttribute('value', '1');
    expect(within(board).getByRole('progressbar')).toHaveAttribute('max', '6');
    expect(within(board).queryByRole('list')).not.toBeInTheDocument();
  });

  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    'does not invent a capacity when the record stores %s',
    (writers) => {
      render(
        <BuildTaskBoard locale="en" phase="building" writers={writers} rows={rows(['writing'])} />,
      );
      expect(screen.getByText(t('en', 'tasks.active', { n: 1 }))).toBeInTheDocument();
      expect(screen.queryByText(/^Up to /u)).not.toBeInTheDocument();
    },
  );

  it.each<BuildPhase>(['done', 'partial', 'stopped', 'interrupted', 'failed', 'undone'])(
    'never claims active or queued workers in a terminal %s record',
    (phase) => {
      render(
        <BuildTaskBoard
          locale="en"
          phase={phase}
          writers={3}
          rows={rows(['landed', 'writing', 'waiting', 'drafted'])}
        />,
      );
      expect(screen.queryByText(t('en', 'tasks.active', { n: 1 }))).not.toBeInTheDocument();
      expect(screen.queryByText(t('en', 'tasks.pool', { n: 3 }))).not.toBeInTheDocument();
      expect(screen.queryByText(t('en', 'tasks.queued', { n: 1 }))).not.toBeInTheDocument();
      expect(screen.queryByText(t('en', 'tasks.drafted', { n: 1 }))).not.toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
    },
  );

  it('counts neither drafts nor undone sections as applied and localizes Arabic', () => {
    render(
      <BuildTaskBoard
        locale="ar"
        phase="stopping"
        writers={3}
        rows={rows(['drafted', 'undone', 'retrying'])}
      />,
    );
    expect(screen.getByRole('region', { name: t('ar', 'tasks.label') })).toBeInTheDocument();
    expect(screen.getByText(t('ar', 'tasks.active', { n: 1 }))).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: t('ar', 'tasks.progress', { n: 0, total: 3 }) }),
    ).toHaveAttribute('value', '0');
  });

  it('renders nothing before the engine has real tasks', () => {
    render(<BuildTaskBoard locale="en" phase="skeleton" writers={3} rows={[]} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
