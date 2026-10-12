/**
 * BackgroundJobRow (2026-10-12): one job — its request as the row's name, page count, when it
 * was sent, its state, the batch's progress — and only the actions its state allows: Refresh
 * and Cancel job while it answers, Apply results (or Show pages) once it ended, Remove (asked
 * in place) once nothing is answering. Its results open by themselves when a page needs a
 * live retry, and the last failed call is said under it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { jobsLabels } from '../../copy/jobs-labels';
import {
  JOB_APPLIED,
  JOB_CANCELED,
  JOB_IN_PROGRESS,
  JOB_READY,
  JOBS_NOW,
  SAMPLE_PAGES,
  SAMPLE_PAGES_AR,
  jobRecord,
} from '../../testing/batch-fixtures';

import { BackgroundJobRow, type BackgroundJobRowProps } from './BackgroundJobRow';

const EN = jobsLabels('en');
const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'BackgroundJobRow',
    'BackgroundJobRow.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

function setup(overrides: Partial<BackgroundJobRowProps> = {}) {
  const actions = {
    onRefresh: vi.fn(),
    onCancel: vi.fn(),
    onApply: vi.fn(),
    onRemove: vi.fn(),
    onRetryLive: vi.fn(),
  };
  render(
    <BackgroundJobRow
      locale="en"
      job={JOB_IN_PROGRESS}
      now={JOBS_NOW}
      pages={SAMPLE_PAGES}
      connected
      {...actions}
      {...overrides}
    />,
  );
  return { user: userEvent.setup(), ...actions };
}

const buttons = () => screen.getAllByRole('button').map((button) => button.textContent);

describe('BackgroundJobRow', () => {
  it('names itself by its request and says pages, time, state and progress', () => {
    setup();
    const row = screen.getByRole('article', { name: JOB_IN_PROGRESS.request });
    expect(within(row).getByText(EN.row.pages(5))).toBeInTheDocument();
    expect(within(row).getByText('4 minutes ago')).toHaveAttribute(
      'datetime',
      new Date(JOB_IN_PROGRESS.createdAt).toISOString(),
    );
    expect(within(row).getByText(EN.row.phase['in-progress'])).toBeInTheDocument();
    const bar = within(row).getByRole('progressbar', { name: EN.row.progressLabel });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar).toHaveAttribute('aria-valuetext', EN.row.progress(3, 5));
  });

  it('offers Refresh and Cancel job while the batch answers, and nothing to apply or remove', async () => {
    const { user, onRefresh, onCancel } = setup();
    expect(buttons()).toEqual([EN.refreshAll, EN.row.cancel]);
    await user.click(screen.getByRole('button', { name: EN.row.refresh(JOB_IN_PROGRESS.request) }));
    await user.click(screen.getByRole('button', { name: EN.row.cancel }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('offers Apply results once the batch ended with answers, and says what was missed', async () => {
    const { user, onApply } = setup({ job: JOB_READY });
    expect(screen.getByText(EN.row.phase.ready)).toBeInTheDocument();
    expect(screen.getByText(EN.row.missed(1))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: EN.row.apply }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('offers Show pages for a batch that ended without answers', () => {
    setup({ job: JOB_CANCELED });
    expect(screen.getByText(EN.row.phase.canceled)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: EN.row.review })).toBeInTheDocument();
  });

  it('waits while a call is in flight, and without a server', async () => {
    const busy = setup({ job: JOB_READY, busy: true });
    const apply = screen.getByRole('button', { name: EN.row.applying });
    expect(apply).toHaveAttribute('aria-disabled', 'true');
    await busy.user.click(apply);
    expect(busy.onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'true');
  });

  it('asks in place before removing, and Keep changes nothing', async () => {
    const { user, onRemove } = setup({ job: JOB_READY });
    await user.click(screen.getByRole('button', { name: EN.row.removeLabel(JOB_READY.request) }));
    const confirm = screen.getByRole('group', { name: EN.row.removeMessage });
    await user.click(within(confirm).getByRole('button', { name: EN.row.keep }));
    expect(onRemove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: EN.row.removeLabel(JOB_READY.request) }));
    await user.click(screen.getByRole('button', { name: EN.row.remove }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('opens its results by itself when a page needs a live retry, and retries one', async () => {
    const { user, onRetryLive } = setup({ job: JOB_APPLIED, retried: ['about'] });
    const disclosure = screen.getByRole('button', { name: EN.row.results });
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText(EN.outcome.retried)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: EN.outcome.retryLiveLabel('Contact') }));
    expect(onRetryLive).toHaveBeenCalledWith('contact');
    await user.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Retry/u })).toBeNull();
  });

  it('keeps the results closed when every page landed', () => {
    setup({
      job: jobRecord({
        status: 'applied',
        pageIds: ['home'],
        outcomes: [{ pageId: 'home', status: 'applied', transactionIds: ['t'] }],
      }),
    });
    expect(screen.getByRole('button', { name: EN.row.results })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('says the last failed call under the job', () => {
    setup({ notice: 'The assistant server could not be reached.' });
    expect(screen.getByRole('alert')).toHaveTextContent('could not be reached');
  });

  it('speaks Arabic with Latin digits and an agreeing page count', () => {
    render(
      <BackgroundJobRow
        locale="ar"
        job={JOB_IN_PROGRESS}
        now={JOBS_NOW}
        pages={SAMPLE_PAGES_AR}
        connected
        onRefresh={vi.fn()}
        onCancel={vi.fn()}
        onApply={vi.fn()}
        onRemove={vi.fn()}
        onRetryLive={vi.fn()}
      />,
    );
    const words = jobsLabels('ar');
    expect(screen.getByText('5 صفحات')).toBeInTheDocument();
    expect(screen.getByText(words.row.phase['in-progress'])).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[٠-٩]/u);
  });

  it('styles with logical properties and builder tokens only', () => {
    expect(CSS).not.toMatch(/\b(?:margin|padding|border)-(?:left|right|top|bottom)\b/u);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/iu);
    expect(CSS).toMatch(/:focus-visible/u);
  });
});
