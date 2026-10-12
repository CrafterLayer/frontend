/**
 * BatchOutcomeList (2026-10-12): one row per page, named by its title, with what became of
 * it — applied (one Undo each; in part when salvaged), declined (the model's sentence),
 * unreadable, failed the checks (the door's first issues), no answer (and whether sending it
 * again may work), never sent, page removed — and Retry live for every miss but a lost page.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { jobResults } from '../../../jobs';
import { jobsLabels } from '../../copy/jobs-labels';
import { JOB_APPLIED, SAMPLE_PAGES, SAMPLE_PAGES_AR } from '../../testing/batch-fixtures';

import { BatchOutcomeList } from './BatchOutcomeList';

const EN = jobsLabels('en');
const RESULTS = jobResults(JOB_APPLIED);

function rowOf(title: string): HTMLElement {
  const row = screen.getByText(title).closest('li');
  if (row === null) throw new Error(`no row for ${title}`);
  return row;
}

describe('BatchOutcomeList', () => {
  it('says what became of every page, with a one-line summary', () => {
    render(<BatchOutcomeList locale="en" results={RESULTS} pages={SAMPLE_PAGES} />);
    expect(screen.getByText(EN.row.summary(2, 5))).toBeInTheDocument();
    expect(within(rowOf('Home')).getByText(EN.outcome.status.applied)).toBeInTheDocument();
    expect(within(rowOf('Home')).getByText(EN.outcome.appliedHint)).toBeInTheDocument();
    expect(within(rowOf('Menu')).getByText(EN.outcome.salvaged(3, 1))).toBeInTheDocument();
    expect(within(rowOf('About us')).getByText(/legal notice/u)).toBeInTheDocument();
    const rejected = within(rowOf('Private events'));
    expect(rejected.getByText(EN.outcome.status.rejected)).toBeInTheDocument();
    expect(
      rejected.getByText(
        `Unknown command "moveSectionUp". setProp needs a node id. ${EN.outcome.moreIssues(1)}`,
      ),
    ).toBeInTheDocument();
    expect(
      within(rowOf('Contact')).getByText(
        `The assistant service was overloaded. ${EN.outcome.retryable}`,
      ),
    ).toBeInTheDocument();
  });

  it('offers Retry live for every page that did not land, named for its page', async () => {
    const user = userEvent.setup();
    const onRetryLive = vi.fn();
    render(
      <BatchOutcomeList
        locale="en"
        results={RESULTS}
        pages={SAMPLE_PAGES}
        onRetryLive={onRetryLive}
      />,
    );
    const retries = screen.getAllByRole('button', { name: /^Retry “.+” live$/u });
    expect(retries.map((button) => button.getAttribute('aria-label'))).toEqual([
      EN.outcome.retryLiveLabel('About us'),
      EN.outcome.retryLiveLabel('Private events'),
      EN.outcome.retryLiveLabel('Contact'),
    ]);
    expect(retries[0]).toHaveTextContent(EN.outcome.retryLive);
    await user.click(screen.getByRole('button', { name: EN.outcome.retryLiveLabel('Contact') }));
    expect(onRetryLive).toHaveBeenCalledWith('contact');
  });

  it('says a page was sent again instead of offering it twice', () => {
    render(
      <BatchOutcomeList
        locale="en"
        results={RESULTS}
        pages={SAMPLE_PAGES}
        retried={['about']}
        onRetryLive={vi.fn()}
      />,
    );
    expect(within(rowOf('About us')).getByText(EN.outcome.retried)).toBeInTheDocument();
    expect(within(rowOf('About us')).queryByRole('button')).toBeNull();
  });

  it('offers nothing for a page the site lost, and lists pages never sent', () => {
    render(
      <BatchOutcomeList
        locale="en"
        results={[
          { pageId: 'events', status: 'skipped', message: 'No model call here.' },
          { pageId: 'blog', status: 'missing', message: 'Gone.' },
        ]}
        pages={SAMPLE_PAGES}
        onRetryLive={vi.fn()}
      />,
    );
    expect(
      within(rowOf('Private events')).getByText(EN.outcome.status.skipped),
    ).toBeInTheDocument();
    expect(within(rowOf('Private events')).getByRole('button')).toBeInTheDocument();
    expect(within(rowOf('blog')).getByText(EN.outcome.status.missing)).toBeInTheDocument();
    expect(within(rowOf('blog')).queryByRole('button')).toBeNull();
  });

  it('speaks Arabic, page titles in their own direction', () => {
    render(
      <BatchOutcomeList
        locale="ar"
        results={RESULTS}
        pages={SAMPLE_PAGES_AR}
        onRetryLive={vi.fn()}
      />,
    );
    const words = jobsLabels('ar');
    expect(screen.getByText(words.row.summary(2, 5))).toBeInTheDocument();
    expect(screen.getByText('الرئيسية')).toHaveAttribute('dir', 'auto');
    expect(
      screen.getByRole('button', { name: words.outcome.retryLiveLabel('اتصل بنا') }),
    ).toBeInTheDocument();
  });
});
