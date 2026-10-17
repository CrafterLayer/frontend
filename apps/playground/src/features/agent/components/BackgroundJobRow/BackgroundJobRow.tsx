import type { AiBatchJobRecord } from '@craftkit/builder';
import { useId, useState } from 'react';

import {
  canApply,
  canCancel,
  canRemove,
  canRetryLive,
  isActive,
  jobPhase,
  jobProgress,
  jobResults,
  jobUsage,
} from '../../../jobs';
import { formatWhen } from '../../copy/format';
import { jobsLabels } from '../../copy/jobs-labels';
import type { BatchPageOption } from '../../model/background-jobs';
import type { Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { BatchOutcomeList } from '../BatchOutcomeList';
import { InlineConfirm } from '../InlineConfirm';

import '../knowledge-form.css';
import './BackgroundJobRow.css';

export interface BackgroundJobRowProps {
  readonly locale: Locale;
  readonly job: AiBatchJobRecord;
  /** What "2 minutes ago" is measured from (the list's last read). */
  readonly now: number;
  /** The site's pages, for the results' titles. */
  readonly pages: readonly BatchPageOption[];
  /** Whether the host has a batch client: without one only Remove is offered. */
  readonly connected: boolean;
  /** A call about this job is in flight: its actions wait. */
  readonly busy?: boolean | undefined;
  /** Why the last call about this job failed. */
  readonly notice?: string | undefined;
  /** This job's pages already sent again as a live run. */
  readonly retried?: readonly string[] | undefined;
  readonly onRefresh: () => void;
  readonly onCancel: () => void;
  readonly onApply: () => void;
  readonly onRemove: () => void;
  readonly onRetryLive: (pageId: string) => void;
}

/**
 * One background job in the list (2026-10-12): the request, how many pages and when it was
 * sent, its state as a tag (In progress, Canceling, Ready to apply, Canceled, Failed,
 * Applied), how far the batch has got as a bar with "3 of 5 answered", then the actions that
 * make sense now — Refresh and Cancel job while it answers, Apply results once it ended (Show
 * pages when no page got an answer), Remove once nothing is still answering, behind an
 * in-place confirm. Results open by themselves when a page needs a live retry.
 */
export function BackgroundJobRow({
  locale,
  job,
  now,
  pages,
  connected,
  busy = false,
  notice,
  retried = [],
  onRefresh,
  onCancel,
  onApply,
  onRemove,
  onRetryLive,
}: BackgroundJobRowProps) {
  const id = useId();
  const labels = jobsLabels(locale);
  const words = labels.row;
  const phase = jobPhase(job);
  const progress = jobProgress(job);
  const results = jobResults(job);
  const [shown, setShown] = useState<boolean | undefined>(undefined);
  const resultsOpen = shown ?? results.some(canRetryLive);
  const waiting = busy || !connected;
  const percent = progress.total === 0 ? 0 : Math.round((progress.answered / progress.total) * 100);

  return (
    <article
      className="ck-agent-job"
      data-phase={phase}
      aria-labelledby={`${id}-request`}
      aria-busy={busy ? true : undefined}
    >
      <div className="ck-agent-job__head">
        <h4 id={`${id}-request`} className="ck-agent-job__request" dir="auto">
          {job.request}
        </h4>
        <span className="ck-agent-job__phase" data-phase={phase}>
          {words.phase[phase]}
        </span>
      </div>
      <p className="ck-agent-job__meta">
        <span>{words.pages(job.pageIds.length)}</span>
        <time dateTime={new Date(job.createdAt).toISOString()}>
          {formatWhen(locale, job.createdAt, Math.max(now, job.createdAt))}
        </time>
        {job.model === undefined ? null : (
          <bdi className="ck-agent-job__model" dir="ltr">
            {job.model}
          </bdi>
        )}
      </p>

      {phase === 'applied' ? null : (
        <div className="ck-agent-job__progress">
          <div
            className="ck-agent-job__bar"
            role="progressbar"
            aria-label={words.progressLabel}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.answered}
            aria-valuetext={words.progress(progress.answered, progress.total)}
          >
            <span className="ck-agent-job__fill" style={{ inlineSize: `${String(percent)}%` }} />
          </div>
          <p className="ck-agent-job__counts">
            <span>{words.progress(progress.answered, progress.total)}</span>
            {progress.missed === 0 ? null : <span>{words.missed(progress.missed)}</span>}
            {progress.canceled === 0 ? null : <span>{words.canceled(progress.canceled)}</span>}
          </p>
        </div>
      )}

      {notice === undefined ? null : (
        <p className="ck-agent-kn-refusal" role="alert" dir="auto">
          {notice}
        </p>
      )}

      <div className="ck-agent-job__actions">
        {canApply(job) ? (
          <button
            type="button"
            className="ck-agent-kn-button"
            data-variant={progress.succeeded > 0 ? 'primary' : undefined}
            aria-disabled={waiting ? true : undefined}
            onClick={() => {
              if (!waiting) onApply();
            }}
          >
            {busy ? words.applying : progress.succeeded > 0 ? words.apply : words.review}
          </button>
        ) : null}
        {isActive(job) ? (
          <button
            type="button"
            className="ck-agent-kn-button"
            aria-label={words.refresh(job.request)}
            aria-disabled={waiting ? true : undefined}
            onClick={() => {
              if (!waiting) onRefresh();
            }}
          >
            {labels.refreshAll}
          </button>
        ) : null}
        {canCancel(job) ? (
          <button
            type="button"
            className="ck-agent-kn-button"
            data-variant="quiet"
            aria-disabled={waiting ? true : undefined}
            onClick={() => {
              if (!waiting) onCancel();
            }}
          >
            {words.cancel}
          </button>
        ) : null}
        {canRemove(job) ? (
          <InlineConfirm
            message={words.removeMessage}
            confirmLabel={words.remove}
            cancelLabel={words.keep}
            tone="danger"
            onConfirm={onRemove}
            className="ck-agent-job__confirm"
            renderOpener={({ open }) => (
              <button
                type="button"
                className="ck-agent-kn-button"
                data-variant="quiet"
                aria-label={words.removeLabel(job.request)}
                aria-disabled={busy ? true : undefined}
                onClick={() => {
                  if (!busy) open();
                }}
              >
                {words.remove}
              </button>
            )}
          />
        ) : null}
      </div>

      {results.length === 0 ? null : (
        <div className="ck-agent-job__results">
          <button
            type="button"
            className="ck-agent-job__disclosure"
            aria-expanded={resultsOpen}
            aria-controls={`${id}-results`}
            onClick={() => {
              setShown(!resultsOpen);
            }}
          >
            <AgentIcon name="disclosure" className="ck-agent-job__chevron" />
            {words.results}
          </button>
          <div id={`${id}-results`} hidden={!resultsOpen}>
            <BatchOutcomeList
              locale={locale}
              results={results}
              pages={pages}
              retried={retried}
              onRetryLive={onRetryLive}
              usage={jobUsage(job)}
            />
          </div>
        </div>
      )}
    </article>
  );
}
