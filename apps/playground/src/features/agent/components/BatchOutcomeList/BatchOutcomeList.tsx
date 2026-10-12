import { canRetryLive, issueSummary, resultCounts, type JobPageResult } from '../../../jobs';
import { jobsLabels, type JobsLabels } from '../../copy/jobs-labels';
import { pageTitleOf, type BatchPageOption } from '../../model/background-jobs';
import type { Locale } from '../../model/view-types';
import { RunGlyph, type RunGlyphState } from '../RunGlyph';

import '../knowledge-form.css';
import './BatchOutcomeList.css';

export interface BatchOutcomeListProps {
  readonly locale: Locale;
  /** Every page's result: the pages never sent first, then each outcome in page order. */
  readonly results: readonly JobPageResult[];
  /** The site's pages, for their titles; a page the site lost shows its id. */
  readonly pages: readonly BatchPageOption[];
  /** Pages already sent again as a live run: they say so instead of offering it twice. */
  readonly retried?: readonly string[] | undefined;
  /** Retry live: the same request on that page, now. Absent, no page offers it. */
  readonly onRetryLive?: ((pageId: string) => void) | undefined;
}

const GLYPH: Readonly<Record<JobPageResult['status'], RunGlyphState>> = {
  applied: 'landed',
  refused: 'absent',
  invalid: 'failed',
  rejected: 'failed',
  error: 'failed',
  missing: 'absent',
  skipped: 'absent',
};

/** The line under a page's name: what landed, or why it did not. */
function detailOf(result: JobPageResult, words: JobsLabels['outcome']): string | undefined {
  switch (result.status) {
    case 'applied':
      return result.salvaged === undefined
        ? words.appliedHint
        : words.salvaged(result.salvaged.kept, result.salvaged.dropped);
    case 'rejected': {
      const { lines, more } = issueSummary(result.issues);
      if (lines.length === 0) return result.message;
      return more === 0 ? lines.join(' ') : `${lines.join(' ')} ${words.moreIssues(more)}`;
    }
    case 'error':
      return result.retryable ? `${result.message} ${words.retryable}` : result.message;
    case 'missing':
      return undefined;
    case 'refused':
    case 'invalid':
    case 'skipped':
      return result.message;
  }
}

/**
 * A background job's results, page by page (2026-10-12), once it is applied. A page that
 * landed says one Undo takes it back (each page is its own transaction); a page the model
 * declined, whose answer could not be read, that failed the live door's checks (its first
 * issues), that got no answer (and whether sending it again may work) or that was never sent
 * offers Retry live: the job's request on that page, as the panel's own run. A page the site
 * no longer has offers nothing. The server's and the door's sentences keep their own
 * direction (`dir="auto"`).
 */
export function BatchOutcomeList({
  locale,
  results,
  pages,
  retried = [],
  onRetryLive,
}: BatchOutcomeListProps) {
  const labels = jobsLabels(locale);
  const words = labels.outcome;
  const counts = resultCounts(results);
  return (
    <div className="ck-agent-outcomes">
      <p className="ck-agent-outcomes__summary">
        {labels.row.summary(counts.applied, results.length)}
      </p>
      <ul className="ck-agent-outcomes__list" role="list">
        {results.map((result) => {
          const title = pageTitleOf(pages, result.pageId);
          const detail = detailOf(result, words);
          const retry = onRetryLive !== undefined && canRetryLive(result);
          return (
            <li
              key={`${result.status}-${result.pageId}`}
              className="ck-agent-outcome"
              data-status={result.status}
            >
              <RunGlyph state={GLYPH[result.status]} className="ck-agent-outcome__glyph" />
              <span className="ck-agent-outcome__text">
                <span className="ck-agent-outcome__head">
                  <span className="ck-agent-outcome__page" dir="auto">
                    {title}
                  </span>
                  <span className="ck-agent-outcome__status">{words.status[result.status]}</span>
                </span>
                {detail === undefined ? null : (
                  <span className="ck-agent-outcome__detail" dir="auto">
                    {detail}
                  </span>
                )}
              </span>
              {!retry ? null : retried.includes(result.pageId) ? (
                <span className="ck-agent-outcome__sent">{words.retried}</span>
              ) : (
                <button
                  type="button"
                  className="ck-agent-kn-button ck-agent-outcome__retry"
                  aria-label={words.retryLiveLabel(title)}
                  onClick={() => {
                    onRetryLive(result.pageId);
                  }}
                >
                  {words.retryLive}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
