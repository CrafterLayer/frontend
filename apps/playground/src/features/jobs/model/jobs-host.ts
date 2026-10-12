/**
 * What a host hands the agent panel for background jobs (2026-10-12): the batch client (or
 * none, and the panel says why it cannot send), the site the jobs run on, and the store their
 * records are kept in. Built once per opened document.
 */
import type {
  AiBatchClient,
  AiBatchJobStore,
  AiBatchRunnerOptions,
  BuilderSiteKernel,
} from '@craftkit/builder';

import { batchClientFromEnv } from './batch-client-from-env';
import { createLocalBatchJobStore, type JobStorage } from './job-store';

/**
 * The part of the site kernel jobs use: its pages (to ask, to name, to apply on) and the
 * current page, which "Retry live" moves to before the request runs.
 */
export type BatchJobSite = Pick<
  BuilderSiteKernel,
  'pages' | 'page' | 'getSite' | 'currentPage' | 'setCurrentPage' | 'subscribe'
>;

/** Every 30 seconds while the list is open and a batch is still answering. */
export const BATCH_POLL_MS = 30_000;

export interface BackgroundJobsHost {
  /** The server's batch routes; absent when no assistant server is configured. */
  readonly client: AiBatchClient | undefined;
  readonly site: BatchJobSite;
  readonly store: AiBatchJobStore;
  /** Job ids and times; the system's when absent (tests inject them). */
  readonly ids?: AiBatchRunnerOptions['ids'] | undefined;
  readonly clock?: AiBatchRunnerOptions['clock'] | undefined;
  /** How often an open list asks about a batch in progress (`BATCH_POLL_MS`). */
  readonly pollMs?: number | undefined;
}

export interface BackgroundJobsHostOptions {
  readonly site: BatchJobSite;
  /** `import.meta.env`: the assistant server's endpoint and token (`batchClientFromEnv`). */
  readonly env: Readonly<Record<string, unknown>>;
  /** Where records are kept; memory only when absent. */
  readonly storage: JobStorage | undefined;
  /** The document the records belong to (the vault's document id). */
  readonly siteKey: string;
}

export function createBackgroundJobsHost({
  site,
  env,
  storage,
  siteKey,
}: BackgroundJobsHostOptions): BackgroundJobsHost {
  return {
    client: batchClientFromEnv(env),
    site,
    store: createLocalBatchJobStore(storage, siteKey),
  };
}
