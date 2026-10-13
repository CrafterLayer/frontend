/**
 * What a background job looks like to a person (2026-10-12), read off its record: where it
 * is, how far the batch has got, which actions make sense now, and which pages may be sent
 * again as a live run. Pure, so a list, a header badge and a test all read the same answer.
 */
import type {
  AiBatchJobRecord,
  AiBatchPageOutcome,
  AiBatchSkippedPage,
  AiPlanValidationIssue,
  AiProviderUsage,
} from '@craftkit/builder';

/**
 * - `in-progress`: the batch is answering; `canceling`: it is stopping.
 * - `ready`: it ended with answers to apply. `canceled`: it ended with none, stopped by the
 *   person; `failed`: it ended with none, every page errored or expired.
 * - `applied`: every page's outcome is recorded.
 */
export type JobPhase = 'in-progress' | 'canceling' | 'ready' | 'canceled' | 'failed' | 'applied';

export function jobPhase(record: AiBatchJobRecord): JobPhase {
  switch (record.status) {
    case 'in_progress':
      return 'in-progress';
    case 'canceling':
      return 'canceling';
    case 'applied':
      return 'applied';
    case 'ended': {
      const { succeeded, canceled } = record.counts;
      if (succeeded > 0) return 'ready';
      return canceled > 0 ? 'canceled' : 'failed';
    }
  }
}

export interface JobProgress {
  /** Pages with a result of any kind. */
  readonly answered: number;
  /** Pages in the batch. */
  readonly total: number;
  readonly succeeded: number;
  /** Errored or expired: no answer, worth a live retry. */
  readonly missed: number;
  readonly canceled: number;
}

export function jobProgress(record: AiBatchJobRecord): JobProgress {
  const { processing, succeeded, errored, canceled, expired } = record.counts;
  const answered = succeeded + errored + canceled + expired;
  return {
    answered,
    total: Math.max(answered + processing, record.targets.length),
    succeeded,
    missed: errored + expired,
    canceled,
  };
}

/** The batch may still change: an open list asks about it again. */
export function isActive(record: AiBatchJobRecord): boolean {
  return record.status === 'in_progress' || record.status === 'canceling';
}

export function canCancel(record: AiBatchJobRecord): boolean {
  return record.status === 'in_progress';
}

/** Ended and not yet applied: apply lands the answers, or lists the pages to retry live. */
export function canApply(record: AiBatchJobRecord): boolean {
  return record.status === 'ended';
}

/** Forgetting a job loses nothing the server is still working on. */
export function canRemove(record: AiBatchJobRecord): boolean {
  return !isActive(record);
}

/** The header's counts: answers waiting to be applied, and batches still answering. */
export function jobCounts(records: readonly AiBatchJobRecord[]): {
  readonly ready: number;
  readonly active: number;
} {
  return {
    ready: records.filter((record) => jobPhase(record) === 'ready').length,
    active: records.filter(isActive).length,
  };
}

/**
 * One page's line in the results: an outcome of the apply, or a page that never reached the
 * batch (`skipped`, with why).
 */
export type JobPageResult =
  | AiBatchPageOutcome
  | { readonly pageId: string; readonly status: 'skipped'; readonly message: string };

export type JobPageStatus = JobPageResult['status'];

/** The skipped pages first (they were never asked), then each outcome in page order. */
export function jobResults(record: AiBatchJobRecord): readonly JobPageResult[] {
  const skipped = record.skipped.map(({ pageId, message }: AiBatchSkippedPage): JobPageResult => ({
    pageId,
    status: 'skipped',
    message,
  }));
  return [...skipped, ...(record.outcomes ?? [])];
}

/**
 * Whether "Retry live" makes sense: the same request on that page, now. Not for a page that
 * landed, and not for one that is no longer in the site.
 */
export function canRetryLive(result: JobPageResult): boolean {
  return result.status !== 'applied' && result.status !== 'missing';
}

/** How many pages ended each way, for the results' one-line summary. */
export function resultCounts(
  results: readonly JobPageResult[],
): Readonly<Record<'applied' | 'retry' | 'missing', number>> {
  return {
    applied: results.filter((result) => result.status === 'applied').length,
    retry: results.filter(canRetryLive).length,
    missing: results.filter((result) => result.status === 'missing').length,
  };
}

/** What a job's model calls measured, summed: `null` where a report left a count unknown. */
export interface JobUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
}

/**
 * What a job cost in tokens (2026-10-13): every answered page's usage, and the one live call
 * that warmed the pages' shared prompt before the batch — so the cache reads it bought show
 * beside the write that paid for them. Undefined until something was measured; a count any
 * report left unknown stays unknown, never a silent zero.
 */
export function jobUsage(record: AiBatchJobRecord): JobUsage | undefined {
  const reports = [
    record.warmUsage,
    ...(record.outcomes ?? []).map((outcome) => ('usage' in outcome ? outcome.usage : undefined)),
  ].filter((usage): usage is AiProviderUsage => usage !== undefined);
  if (reports.length === 0) return undefined;
  const sum = (key: keyof JobUsage): number | null =>
    reports.reduce<number | null>((total, usage) => {
      const count = usage[key];
      return total === null || count === null ? null : total + count;
    }, 0);
  return {
    inputTokens: sum('inputTokens'),
    outputTokens: sum('outputTokens'),
    cacheReadTokens: sum('cacheReadTokens'),
    cacheWriteTokens: sum('cacheWriteTokens'),
  };
}

/** The door's first issues, short enough for one line, and how many more there were. */
export function issueSummary(
  issues: readonly AiPlanValidationIssue[],
  shown = 2,
): { readonly lines: readonly string[]; readonly more: number } {
  const lines = [...new Set(issues.map((issue) => issue.message.trim()).filter(Boolean))];
  return { lines: lines.slice(0, shown), more: Math.max(0, lines.length - shown) };
}
