/**
 * Background jobs (2026-10-12): one request on several pages of a site, sent as one Message
 * Batches job at half price and applied page by page through the live door. This feature is
 * the React-free half: the per-site record store, the client from the environment, what a
 * record means to a person, and what a failed call says. The agent panel draws it.
 */
export { batchClientFromEnv } from './model/batch-client-from-env';
export {
  batchFailureMessage,
  batchUnavailableOf,
  type BatchUnavailable,
} from './model/batch-errors';
export {
  BATCH_JOBS_KEY_PREFIX,
  BATCH_JOBS_MAX,
  batchJobsKey,
  createLocalBatchJobStore,
  readJobRecord,
  type JobStorage,
} from './model/job-store';
export {
  canApply,
  canCancel,
  canRemove,
  canRetryLive,
  isActive,
  issueSummary,
  jobCounts,
  jobPhase,
  jobProgress,
  jobResults,
  jobUsage,
  resultCounts,
  type JobPageResult,
  type JobPageStatus,
  type JobPhase,
  type JobProgress,
  type JobUsage,
} from './model/job-view';
export {
  BATCH_POLL_MS,
  createBackgroundJobsHost,
  type BackgroundJobsHost,
  type BackgroundJobsHostOptions,
  type BatchJobSite,
} from './model/jobs-host';
