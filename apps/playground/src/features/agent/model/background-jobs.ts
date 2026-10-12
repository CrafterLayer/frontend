/**
 * The panel's view of background jobs (2026-10-12): what `useBackgroundJobs` hands
 * AgentPanel, and what the jobs dialog draws and calls. A story or a test builds one by hand.
 */
import type { AiBatchJobRecord } from '@craftkit/builder';

/** A page a job may run on, as the form lists it. */
export interface BatchPageOption {
  readonly id: string;
  readonly title: string;
  readonly address: string;
  /** The page open on the canvas now. */
  readonly current: boolean;
}

export interface BackgroundJobsView {
  /** Newest first; `undefined` while the store is read. */
  readonly jobs: readonly AiBatchJobRecord[] | undefined;
  /** The site's pages, in site order, the open one marked. */
  readonly pages: readonly BatchPageOption[];
  /** When the list was last read: what "2 minutes ago" is measured from. */
  readonly now: number;
  /** Whether the host has a batch client at all; without one nothing can be sent or asked. */
  readonly connected: boolean;
  /** Why Submit waits: the server's own sentence when it cannot batch (501, or 409 for this model). */
  readonly unavailable: string | undefined;
  readonly submitting: boolean;
  /** Why the last submit failed, in the server's or the runner's words. */
  readonly submitError: string | undefined;
  /** Jobs with a call in flight. */
  readonly pending: readonly string[];
  /** The last failed call about a job, by job id. */
  readonly notices: Readonly<Record<string, string>>;
  /** Pages already sent again as a live run (`retriedKey`). */
  readonly retried: readonly string[];
  /** Sends a job; resolves `true` once it is in the list. */
  readonly submit: (request: string, pageIds: readonly string[]) => Promise<boolean>;
  /** Asks about one batch, or every batch still answering. */
  readonly refresh: (jobId?: string) => void;
  readonly cancel: (jobId: string) => void;
  /** Lands every answer through the live door: one Undo per page. */
  readonly apply: (jobId: string) => void;
  readonly remove: (jobId: string) => void;
  /** The job's request on that page, now, as a live run of the panel. */
  readonly retryLive: (jobId: string, pageId: string) => void;
  /** The list is in front of the person: batches in progress are asked about every 30 s. */
  readonly watch: (watching: boolean) => void;
}

/** How a page sent again is remembered: one key per job and page. */
export function retriedKey(jobId: string, pageId: string): string {
  return `${jobId}/${pageId}`;
}

/** A page's title, or its id once it is gone from the site. */
export function pageTitleOf(pages: readonly BatchPageOption[], pageId: string): string {
  return pages.find((page) => page.id === pageId)?.title ?? pageId;
}
