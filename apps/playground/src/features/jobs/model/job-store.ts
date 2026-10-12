/**
 * Background job records kept per site in the browser (2026-10-12): the `AiBatchJobStore`
 * port the batch runner writes through, over `localStorage`, so a job sent before a reload
 * is found again after it.
 *
 * Every read and write is guarded: a private window, a full quota or a sandboxed frame never
 * breaks the panel. A write that fails keeps the records in memory for this visit, and a
 * stored value this version cannot read is skipped, record by record, rather than trusted.
 * Records are plain JSON the runner made (the request, page ids, the batch id, counts and
 * per-page outcomes); no token, header or endpoint is ever part of one.
 */
import {
  AI_BATCH_JOB_VERSION,
  type AiBatchJobRecord,
  type AiBatchJobStore,
} from '@craftkit/builder';

/** The two calls the store makes on `window.localStorage`, so tests can hand in a map. */
export interface JobStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

/** Where a site's jobs live: one key per site, versioned with the record format. */
export const BATCH_JOBS_KEY_PREFIX = 'ck-agent-batch-jobs:v1:';

/** At most this many jobs are kept per site; the oldest are forgotten first. */
export const BATCH_JOBS_MAX = 50;

const STATUSES: ReadonlySet<unknown> = new Set(['in_progress', 'canceling', 'ended', 'applied']);
const OUTCOMES: ReadonlySet<unknown> = new Set([
  'applied',
  'refused',
  'invalid',
  'rejected',
  'error',
  'missing',
]);
const COUNTS = ['processing', 'succeeded', 'errored', 'canceled', 'expired'] as const;

type Json = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): boolean =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isTime = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);

const listOf = (value: unknown, each: (entry: unknown) => boolean): boolean =>
  Array.isArray(value) && value.every(each);

const isTarget = (entry: unknown): boolean =>
  isRecord(entry) && typeof entry['itemId'] === 'string' && typeof entry['pageId'] === 'string';

const isSkipped = (entry: unknown): boolean =>
  isRecord(entry) && typeof entry['pageId'] === 'string' && typeof entry['message'] === 'string';

const isOutcome = (entry: unknown): boolean =>
  isRecord(entry) && typeof entry['pageId'] === 'string' && OUTCOMES.has(entry['status']);

/** The site key a store is opened with, as the storage key it reads and writes. */
export function batchJobsKey(siteKey: string): string {
  return `${BATCH_JOBS_KEY_PREFIX}${siteKey}`;
}

/** A stored value, when it is a job record this version understands; otherwise nothing. */
export function readJobRecord(value: unknown): AiBatchJobRecord | undefined {
  if (!isRecord(value) || value['version'] !== AI_BATCH_JOB_VERSION) return undefined;
  const counts = value['counts'];
  const endedAt = value['endedAt'];
  const shaped =
    typeof value['id'] === 'string' &&
    value['kind'] === 'page-request' &&
    typeof value['request'] === 'string' &&
    typeof value['batchId'] === 'string' &&
    STATUSES.has(value['status']) &&
    listOf(value['pageIds'], (entry) => typeof entry === 'string') &&
    listOf(value['targets'], isTarget) &&
    listOf(value['skipped'], isSkipped) &&
    isTime(value['createdAt']) &&
    isTime(value['updatedAt']) &&
    isRecord(counts) &&
    COUNTS.every((name) => isCount(counts[name])) &&
    (endedAt === null || typeof endedAt === 'string') &&
    (value['model'] === undefined || typeof value['model'] === 'string') &&
    (value['outcomes'] === undefined || listOf(value['outcomes'], isOutcome));
  return shaped ? (value as unknown as AiBatchJobRecord) : undefined;
}

/** Newest first, and no more than `BATCH_JOBS_MAX`. */
function kept(records: readonly AiBatchJobRecord[]): AiBatchJobRecord[] {
  return [...records]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, BATCH_JOBS_MAX);
}

/**
 * The job store for one site (`siteKey`: the document the vault keeps it under). Without a
 * storage it keeps the records in memory only, as it does after a write the browser refused.
 */
export function createLocalBatchJobStore(
  storage: JobStorage | undefined,
  siteKey: string,
): AiBatchJobStore {
  const key = batchJobsKey(siteKey);
  // Set when the browser would not keep a write: the records live here for this visit.
  let fallback: AiBatchJobRecord[] | null = storage === undefined ? [] : null;

  const read = (): AiBatchJobRecord[] => {
    if (fallback !== null || storage === undefined) return fallback ?? [];
    try {
      const text = storage.getItem(key);
      if (text === null) return [];
      const parsed: unknown = JSON.parse(text);
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((entry) => {
        const record = readJobRecord(entry);
        return record === undefined ? [] : [record];
      });
    } catch {
      return [];
    }
  };

  const write = (records: readonly AiBatchJobRecord[]): void => {
    const next = kept(records);
    if (storage === undefined) {
      fallback = next;
      return;
    }
    try {
      storage.setItem(key, JSON.stringify(next));
      fallback = null;
    } catch {
      // A full quota or a private window: the jobs stay known until the tab closes.
      fallback = next;
    }
  };

  return {
    list: () => Promise.resolve(read()),
    get: (id) => Promise.resolve(read().find((record) => record.id === id)),
    put: (record) => {
      write([record, ...read().filter((other) => other.id !== record.id)]);
      return Promise.resolve();
    },
    remove: (id) => {
      write(read().filter((record) => record.id !== id));
      return Promise.resolve();
    },
  };
}
