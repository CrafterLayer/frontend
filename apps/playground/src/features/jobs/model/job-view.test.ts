/**
 * What a job record means to a person (2026-10-12): its phase, how far the batch has got,
 * which actions make sense, and which pages may be sent again live.
 */
import { AI_BATCH_JOB_VERSION, type AiBatchJobRecord } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import {
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
} from './job-view';

const ZERO = { processing: 0, succeeded: 0, errored: 0, canceled: 0, expired: 0 };

function job(overrides: Partial<AiBatchJobRecord> = {}): AiBatchJobRecord {
  return {
    version: AI_BATCH_JOB_VERSION,
    id: 'job',
    kind: 'page-request',
    request: 'Translate',
    pageIds: ['a', 'b', 'c'],
    targets: [
      { itemId: 'p0', pageId: 'a' },
      { itemId: 'p1', pageId: 'b' },
      { itemId: 'p2', pageId: 'c' },
    ],
    skipped: [],
    batchId: 'msgbatch_1',
    status: 'in_progress',
    createdAt: 1,
    updatedAt: 1,
    counts: { ...ZERO, processing: 3 },
    endedAt: null,
    ...overrides,
  };
}

describe('jobPhase', () => {
  it('names where a job is, telling an ended batch with answers from one without', () => {
    expect(jobPhase(job())).toBe('in-progress');
    expect(jobPhase(job({ status: 'canceling' }))).toBe('canceling');
    expect(jobPhase(job({ status: 'ended', counts: { ...ZERO, succeeded: 1, canceled: 2 } }))).toBe(
      'ready',
    );
    expect(jobPhase(job({ status: 'ended', counts: { ...ZERO, canceled: 3 } }))).toBe('canceled');
    expect(jobPhase(job({ status: 'ended', counts: { ...ZERO, errored: 2, expired: 1 } }))).toBe(
      'failed',
    );
    expect(jobPhase(job({ status: 'applied' }))).toBe('applied');
  });
});

describe('jobProgress', () => {
  it('counts every page with a result as answered', () => {
    expect(
      jobProgress(job({ counts: { ...ZERO, processing: 1, succeeded: 1, expired: 1 } })),
    ).toEqual({ answered: 2, total: 3, succeeded: 1, missed: 1, canceled: 0 });
  });
});

describe('actions', () => {
  it('offers each action only when it makes sense', () => {
    const answering = job();
    const ended = job({ status: 'ended' });
    const applied = job({ status: 'applied' });
    expect([canCancel(answering), canApply(answering), canRemove(answering)]).toEqual([
      true,
      false,
      false,
    ]);
    expect([canCancel(ended), canApply(ended), canRemove(ended)]).toEqual([false, true, true]);
    expect([canCancel(applied), canApply(applied), canRemove(applied)]).toEqual([
      false,
      false,
      true,
    ]);
    expect(isActive(job({ status: 'canceling' }))).toBe(true);
    expect(jobCounts([answering, ended, job({ status: 'ended', counts: ZERO })])).toEqual({
      ready: 0,
      active: 1,
    });
    expect(jobCounts([job({ status: 'ended', counts: { ...ZERO, succeeded: 1 } })])).toEqual({
      ready: 1,
      active: 0,
    });
  });
});

describe('results', () => {
  it('lists pages never sent first, and offers a live retry for every miss but a lost page', () => {
    const results = jobResults(
      job({
        skipped: [{ pageId: 'z', message: 'No model call on this page.' }],
        outcomes: [
          { pageId: 'a', status: 'applied', transactionIds: ['t'] },
          { pageId: 'b', status: 'refused', message: 'No.' },
          { pageId: 'c', status: 'missing', message: 'Gone.' },
        ],
      }),
    );
    expect(results.map(({ pageId, status }) => `${pageId}:${status}`)).toEqual([
      'z:skipped',
      'a:applied',
      'b:refused',
      'c:missing',
    ]);
    expect(results.map(canRetryLive)).toEqual([true, false, true, false]);
    expect(resultCounts(results)).toEqual({ applied: 1, retry: 2, missing: 1 });
  });

  it('sums what the pages and the warm call measured, unknown where a report did not say', () => {
    const usage = (input: number, read: number, write: number | null) => ({
      inputTokens: input,
      outputTokens: 40,
      cacheReadTokens: read,
      cacheWriteTokens: write,
      costUsd: null,
    });
    expect(jobUsage(job())).toBeUndefined();
    const warmed = job({
      warmUsage: usage(4, 0, 6_100),
      outcomes: [
        { pageId: 'a', status: 'applied', transactionIds: ['t'], usage: usage(120, 6_100, 0) },
        { pageId: 'b', status: 'refused', message: 'No.', usage: usage(110, 6_100, 0) },
        { pageId: 'c', status: 'error', message: 'Lost.', retryable: true },
      ],
    });
    expect(jobUsage(warmed)).toEqual({
      inputTokens: 234,
      outputTokens: 120,
      cacheReadTokens: 12_200,
      cacheWriteTokens: 6_100,
    });
    const unknown = job({
      outcomes: [{ pageId: 'a', status: 'invalid', message: '?', usage: usage(1, 2, null) }],
    });
    expect(jobUsage(unknown)).toMatchObject({ inputTokens: 1, cacheWriteTokens: null });
  });

  it("sums up the door's issues in a line or two", () => {
    const issue = (message: string) => ({ code: 'invalid-args' as const, message });
    expect(issueSummary([issue('One.'), issue('Two.'), issue('One.'), issue('Three.')])).toEqual({
      lines: ['One.', 'Two.'],
      more: 1,
    });
    expect(issueSummary([])).toEqual({ lines: [], more: 0 });
  });
});
