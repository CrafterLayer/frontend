import type { BuilderSiteKernel } from '@craftkit/builder-core';
import type { ClockPort, IdPort } from '@craftkit/builder-schema';

import type { RunAiAgentOptions } from '../agent/types';
import type { AiBatchCallOptions, AiBatchClient } from '../provider/batch-client';
import type { AiBatchWireCounts } from '../provider/batch-wire';
import type { AiPlanValidationIssue, AiProviderUsage } from '../types';

/** The version of a stored job record; a store hands back only records it understands. */
export const AI_BATCH_JOB_VERSION = 1;

/**
 * What a job does. `page-request`: one request, the same on each of the named pages of a
 * site — "translate every page", "add an FAQ to every service page". Each page is asked as
 * a live run on that page would ask, and answered on that page alone.
 */
export type AiBatchJobKind = 'page-request';

/**
 * Where a job is: the batch is answering (`in_progress`), stopping (`canceling`), done and
 * ready to apply (`ended`), or applied — every page's outcome recorded (`applied`).
 */
export type AiBatchJobStatus = 'in_progress' | 'canceling' | 'ended' | 'applied';

/** Which batch item answers which page. */
export interface AiBatchJobTarget {
  readonly itemId: string;
  readonly pageId: string;
}

/** A page that never reached the batch, and why: the UI offers it a live run instead. */
export interface AiBatchSkippedPage {
  readonly pageId: string;
  readonly message: string;
}

/**
 * What became of one page when its answer was applied. Everything but `applied` is a page
 * the UI may offer a live retry for: the same request, on that page, now.
 *
 * - `applied`: the plan passed the live door and landed as one transaction — one Undo.
 *   `salvaged` when the door kept only part of it, as a live run would.
 * - `refused`: the model declined (its sentence); `invalid`: the server could not read a
 *   plan out of the answer; `rejected`: the plan failed the door (its issues).
 * - `error`: no answer (the item errored, expired or was cancelled) or the apply failed.
 * - `missing`: the page is no longer in the site.
 */
export type AiBatchPageOutcome =
  | {
      readonly pageId: string;
      readonly status: 'applied';
      readonly transactionIds: readonly string[];
      readonly salvaged?: { readonly kept: number; readonly dropped: number };
      readonly usage?: AiProviderUsage;
    }
  | {
      readonly pageId: string;
      readonly status: 'refused' | 'invalid';
      readonly message: string;
      readonly usage?: AiProviderUsage;
    }
  | {
      readonly pageId: string;
      readonly status: 'rejected';
      readonly message: string;
      readonly issues: readonly AiPlanValidationIssue[];
      readonly usage?: AiProviderUsage;
    }
  | {
      readonly pageId: string;
      readonly status: 'error';
      readonly message: string;
      readonly retryable: boolean;
    }
  | { readonly pageId: string; readonly status: 'missing'; readonly message: string };

/** A background job as its store keeps it: plain JSON, nothing a page or a kernel owns. */
export interface AiBatchJobRecord {
  readonly version: typeof AI_BATCH_JOB_VERSION;
  readonly id: string;
  readonly kind: AiBatchJobKind;
  /** The person's request, as a live run would have been sent it. */
  readonly request: string;
  /** Every page the job was asked for, in the order asked. */
  readonly pageIds: readonly string[];
  /** The pages that went into the batch, by item id. */
  readonly targets: readonly AiBatchJobTarget[];
  /** The pages that could not be asked (see `AiBatchSkippedPage`). */
  readonly skipped: readonly AiBatchSkippedPage[];
  readonly batchId: string;
  readonly status: AiBatchJobStatus;
  /** From the job's clock port. */
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly counts: AiBatchWireCounts;
  /** The batch's own end time (ISO 8601), once it ended. */
  readonly endedAt: string | null;
  /** The model the person picked for the job, when they picked one. */
  readonly model?: string;
  /**
   * What the one live call that warmed the pages' shared prompt prefix cost (2026-10-13), when
   * the server sent one before the batch: it is part of what the job cost.
   */
  readonly warmUsage?: AiProviderUsage;
  /** Every target's outcome, in target order, once the job was applied. */
  readonly outcomes?: readonly AiBatchPageOutcome[];
}

/** Where job records live between visits: a panel's IndexedDB, a server's table, a test's map. */
export interface AiBatchJobStore {
  list(): Promise<readonly AiBatchJobRecord[]>;
  get(id: string): Promise<AiBatchJobRecord | undefined>;
  put(record: AiBatchJobRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

/** The site a job runs on: its pages, each a full kernel lens (`BuilderSiteKernel.page`). */
export type AiBatchSite = Pick<BuilderSiteKernel, 'pages' | 'page'>;

/**
 * How each page is asked and judged: the options a LIVE run on that page would take
 * (`runAiAgent`), minus what the runner owns — the page's kernel, the provider, the request,
 * the run id and clock, cancellation — and minus what belongs to one page only (a selection,
 * that page's summary, a script's site). The same options must be given to submit and to
 * apply: they decide the context the model is shown and the door its answer meets.
 */
export type AiBatchAgentOptions = Omit<
  RunAiAgentOptions,
  | 'runId'
  | 'clock'
  | 'kernel'
  | 'provider'
  | 'request'
  | 'apply'
  | 'signal'
  | 'selection'
  | 'document'
  | 'site'
  | 'directEdits'
  | 'onEvent'
  | 'isCurrentRun'
>;

export interface AiBatchRunnerOptions {
  readonly client: AiBatchClient;
  readonly store: AiBatchJobStore;
  /** Job ids (Law D: identity is injected). */
  readonly ids: IdPort;
  /** Job times (Law D: time is injected). */
  readonly clock: ClockPort;
}

export interface SubmitPageRequestJobOptions {
  readonly site: AiBatchSite;
  /** The pages to ask, in order; 1 to `AI_BATCH_MAX_ITEMS`, no repeats. */
  readonly pageIds: readonly string[];
  readonly request: string;
  readonly agent: AiBatchAgentOptions;
  /** The person's model pick for every page; the server holds it to its allowlist. */
  readonly model?: string;
  readonly signal?: AbortSignal;
}

export interface ApplyBatchJobOptions {
  readonly site: AiBatchSite;
  /** The options the job was submitted with (see `AiBatchAgentOptions`). */
  readonly agent: AiBatchAgentOptions;
  /** The Undo label for each page's transaction; the plan's rationale when omitted. */
  readonly label?: string;
  readonly signal?: AbortSignal;
}

/**
 * A headless runner for background jobs — what a panel drives: `submit…` sends one batch,
 * `refresh` polls it once (the panel owns the timer), `list`/`get` read the store, `apply`
 * lands every answer through the live door, `cancel` stops the batch, `remove` forgets a job.
 */
export interface AiBatchRunner {
  submitPageRequest(options: SubmitPageRequestJobOptions): Promise<AiBatchJobRecord>;
  refresh(jobId: string, options?: AiBatchCallOptions): Promise<AiBatchJobRecord>;
  list(): Promise<readonly AiBatchJobRecord[]>;
  get(jobId: string): Promise<AiBatchJobRecord | undefined>;
  apply(jobId: string, options: ApplyBatchJobOptions): Promise<AiBatchJobRecord>;
  cancel(jobId: string, options?: AiBatchCallOptions): Promise<AiBatchJobRecord>;
  remove(jobId: string): Promise<void>;
}
