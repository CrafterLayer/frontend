/*
  Background batches (2026-10-12): the agent's big jobs — the same request on every page of a
  site — sent as one Message Batches job at half price and applied, page by page, through the
  live door. The runner is headless; a panel drives it (submit, refresh, list, apply, cancel).
*/
export { createMemoryBatchJobStore } from './memory-store';
export {
  AiBatchJobError,
  createAiBatchRunner,
  isAiBatchJobError,
  type AiBatchJobErrorCode,
} from './runner';
export {
  AI_BATCH_JOB_VERSION,
  type AiBatchAgentOptions,
  type AiBatchJobKind,
  type AiBatchJobRecord,
  type AiBatchJobStatus,
  type AiBatchJobStore,
  type AiBatchJobTarget,
  type AiBatchPageOutcome,
  type AiBatchRunner,
  type AiBatchRunnerOptions,
  type AiBatchSite,
  type AiBatchSkippedPage,
  type ApplyBatchJobOptions,
  type SubmitPageRequestJobOptions,
} from './types';
export {
  createRemoteBatchClient,
  type AiBatchCallOptions,
  type AiBatchClient,
  type AiBatchItemResult,
  type AiBatchResultsOptions,
  type AiBatchResultsTask,
  type AiBatchState,
  type AiBatchSubmitOptions,
  type RemoteBatchClientOptions,
} from '../provider/batch-client';
export {
  AI_BATCH_ITEM_ID_PATTERN,
  AI_BATCH_MAX_ITEMS,
  AI_BATCH_PATH,
  type AiBatchWireCounts,
  type AiBatchWireItem,
  type AiBatchWireRequest,
  type AiBatchWireResultItem,
  type AiBatchWireResults,
  type AiBatchWireReviewItem,
  type AiBatchWireState,
  type AiBatchWireStatus,
} from '../provider/batch-wire';
