import type { AiBatchItemResult, AiBatchState } from '../provider/batch-client';
import { AI_BATCH_MAX_ITEMS, type AiBatchWireItem } from '../provider/batch-wire';
import { answerPage, askPage, pageRunId } from './page-run';
import {
  AI_BATCH_JOB_VERSION,
  type AiBatchJobRecord,
  type AiBatchJobTarget,
  type AiBatchPageOutcome,
  type AiBatchRunner,
  type AiBatchRunnerOptions,
  type AiBatchSkippedPage,
  type ApplyBatchJobOptions,
} from './types';

/** Why the runner refused a call; `code` is what a panel branches on. */
export type AiBatchJobErrorCode =
  'unknown-job' | 'invalid-job' | 'nothing-to-send' | 'not-ended' | 'already-applied' | 'busy';

export class AiBatchJobError extends Error {
  override readonly name = 'AiBatchJobError';
  readonly code: AiBatchJobErrorCode;
  /** With `nothing-to-send`: every page, and why it could not be asked. */
  readonly skipped: readonly AiBatchSkippedPage[];

  constructor(
    code: AiBatchJobErrorCode,
    message: string,
    skipped: readonly AiBatchSkippedPage[] = [],
  ) {
    super(message);
    this.code = code;
    this.skipped = skipped;
  }
}

export function isAiBatchJobError(
  value: unknown,
  code?: AiBatchJobErrorCode,
): value is AiBatchJobError {
  return value instanceof AiBatchJobError && (code === undefined || value.code === code);
}

/** What one page's batch result became, before or instead of the door. */
async function landTarget(
  target: AiBatchJobTarget,
  result: AiBatchItemResult | undefined,
  record: AiBatchJobRecord,
  options: ApplyBatchJobOptions & { readonly clock: AiBatchRunnerOptions['clock'] },
  index: number,
): Promise<AiBatchPageOutcome> {
  const { pageId } = target;
  if (!options.site.pages().includes(pageId)) {
    return { pageId, status: 'missing', message: 'This page is no longer in the site.' };
  }
  if (result === undefined) {
    return {
      pageId,
      status: 'error',
      message: 'The batch came back without an answer for this page.',
      retryable: true,
    };
  }
  const usage = 'usage' in result ? { usage: result.usage } : {};
  switch (result.outcome) {
    case 'error':
      return { pageId, status: 'error', message: result.message, retryable: result.retryable };
    case 'refusal':
      return { pageId, status: 'refused', message: result.message, ...usage };
    case 'invalid-output':
      return { pageId, status: 'invalid', message: result.message, ...usage };
    case 'page-plan':
    case 'scene-review': {
      const what = result.outcome === 'page-plan' ? 'a page plan' : 'a scene review';
      return {
        pageId,
        status: 'invalid',
        message: `The batch answered this page with ${what}, not a plan of changes.`,
        ...usage,
      };
    }
    case 'plan': {
      const outcome = await answerPage({
        kernel: options.site.page(pageId),
        pageId,
        request: record.request,
        plan: result.plan,
        agent: options.agent,
        clock: options.clock,
        runId: pageRunId(record.id, index, 'apply'),
        label: options.label,
        signal: options.signal,
      });
      return { ...outcome, ...usage };
    }
  }
}

/**
 * The background-job runner (types.ts says what each call is for).
 *
 * Applying is resumable and never doubles: each page's outcome is stored as soon as it
 * lands, a second `apply` skips every page that already has one, and a job whose pages all
 * have one is `applied` and refuses a third. Two `apply` calls at once on the same runner are
 * refused (`busy`) rather than raced.
 */
export function createAiBatchRunner(options: AiBatchRunnerOptions): AiBatchRunner {
  const { client, store, ids, clock } = options;
  const applying = new Set<string>();

  async function load(jobId: string): Promise<AiBatchJobRecord> {
    const record = await store.get(jobId);
    if (record === undefined) {
      throw new AiBatchJobError('unknown-job', `There is no background job "${jobId}".`);
    }
    return record;
  }

  async function save(record: AiBatchJobRecord): Promise<AiBatchJobRecord> {
    await store.put(record);
    return record;
  }

  /** The batch's latest state on the record; an applied job stays applied. */
  function stamped(record: AiBatchJobRecord, state: AiBatchState): AiBatchJobRecord {
    return {
      ...record,
      status: record.status === 'applied' ? 'applied' : state.status,
      counts: state.counts,
      endedAt: state.endedAt,
      updatedAt: clock.now(),
    };
  }

  return {
    async submitPageRequest(job) {
      const request = job.request.trim();
      if (request === '') {
        throw new AiBatchJobError('invalid-job', 'A background job needs a request.');
      }
      const pages = new Set(job.site.pages());
      const unique = new Set(job.pageIds);
      if (job.pageIds.length === 0 || job.pageIds.length > AI_BATCH_MAX_ITEMS) {
        throw new AiBatchJobError(
          'invalid-job',
          `A background job asks 1 to ${String(AI_BATCH_MAX_ITEMS)} pages.`,
        );
      }
      if (unique.size !== job.pageIds.length) {
        throw new AiBatchJobError('invalid-job', 'A background job names each page once.');
      }
      const unknown = job.pageIds.find((pageId) => !pages.has(pageId));
      if (unknown !== undefined) {
        throw new AiBatchJobError('invalid-job', `The site has no page "${unknown}".`);
      }

      const jobId = ids.newId();
      const items: AiBatchWireItem[] = [];
      const targets: AiBatchJobTarget[] = [];
      const skipped: AiBatchSkippedPage[] = [];
      for (const [index, pageId] of job.pageIds.entries()) {
        job.signal?.throwIfAborted();
        const asked = await askPage({
          kernel: job.site.page(pageId),
          request,
          agent: job.agent,
          clock,
          runId: pageRunId(jobId, index, 'ask'),
          signal: job.signal,
        });
        if ('message' in asked) {
          skipped.push({ pageId, message: asked.message });
          continue;
        }
        const itemId = `p${String(index)}`;
        items.push({ id: itemId, request: asked.wire });
        targets.push({ itemId, pageId });
      }
      if (items.length === 0) {
        throw new AiBatchJobError(
          'nothing-to-send',
          `No page could be asked: ${skipped[0]?.message ?? 'nothing to send.'}`,
          skipped,
        );
      }

      const model = job.model?.trim() ?? '';
      const state = await client.submit(items, {
        ...(model === '' ? {} : { model }),
        signal: job.signal,
      });
      const now = clock.now();
      return save({
        version: AI_BATCH_JOB_VERSION,
        id: jobId,
        kind: 'page-request',
        request,
        pageIds: [...job.pageIds],
        targets,
        skipped,
        batchId: state.batchId,
        status: state.status,
        createdAt: now,
        updatedAt: now,
        counts: state.counts,
        endedAt: state.endedAt,
        ...(model === '' ? {} : { model }),
        ...(state.warmUsage === undefined ? {} : { warmUsage: state.warmUsage }),
      });
    },

    async refresh(jobId, live) {
      const record = await load(jobId);
      if (record.status === 'applied') return record;
      return save(stamped(record, await client.status(record.batchId, live)));
    },

    async list() {
      const records = await store.list();
      return [...records].sort((left, right) => right.createdAt - left.createdAt);
    },

    get: (jobId) => store.get(jobId),

    async apply(jobId, job) {
      if (applying.has(jobId)) {
        throw new AiBatchJobError('busy', 'This background job is being applied already.');
      }
      applying.add(jobId);
      try {
        const live = { signal: job.signal };
        let record = await load(jobId);
        if (record.status === 'applied') {
          throw new AiBatchJobError('already-applied', 'This background job was applied already.');
        }
        if (record.status !== 'ended') {
          record = await save(stamped(record, await client.status(record.batchId, live)));
          if (record.status !== 'ended') {
            throw new AiBatchJobError(
              'not-ended',
              'The batch is still being answered; apply it once it has ended.',
            );
          }
        }
        const results = await client.results(record.batchId, live);
        const byItem = new Map(results.map((result) => [result.id, result]));
        const outcomes = [...(record.outcomes ?? [])];
        const landed = new Set(outcomes.map(({ pageId }) => pageId));
        for (const [index, target] of record.targets.entries()) {
          if (landed.has(target.pageId)) continue;
          job.signal?.throwIfAborted();
          const outcome = await landTarget(
            target,
            byItem.get(target.itemId),
            record,
            { ...job, clock },
            index,
          );
          outcomes.push(outcome);
          // Stored as each page lands, so an interrupted apply never lands a page twice.
          record = await save({ ...record, outcomes: [...outcomes], updatedAt: clock.now() });
        }
        const order = new Map(record.targets.map(({ pageId }, at) => [pageId, at]));
        outcomes.sort(
          (left, right) => (order.get(left.pageId) ?? 0) - (order.get(right.pageId) ?? 0),
        );
        return await save({ ...record, status: 'applied', outcomes, updatedAt: clock.now() });
      } finally {
        applying.delete(jobId);
      }
    },

    async cancel(jobId, live) {
      const record = await load(jobId);
      if (record.status === 'applied' || record.status === 'ended') return record;
      return save(stamped(record, await client.cancel(record.batchId, live)));
    },

    remove: (jobId) => store.remove(jobId),
  };
}
