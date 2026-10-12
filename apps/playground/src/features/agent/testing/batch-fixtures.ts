/**
 * Fixtures for background jobs (2026-10-12): job records in every state, the site's pages as
 * the form lists them, a hand-built view for the presentational stories, and a scriptable
 * batch client that never touches the network — it answers submit, status, results and
 * cancel from memory, and a test ends the batch or makes the server refuse when it wants.
 */
import {
  AI_BATCH_JOB_VERSION,
  type AiBatchClient,
  type AiBatchItemResult,
  type AiBatchJobRecord,
  type AiBatchState,
  type AiBatchWireItem,
  type AiPlan,
  RemoteAiProviderError,
} from '@craftkit/builder';

import type { BackgroundJobsView, BatchPageOption } from '../model/background-jobs';

/** 12 Oct 2026, 14:00 UTC: every story's "now". */
export const JOBS_NOW = Date.UTC(2026, 9, 12, 14, 0);
const MINUTE = 60_000;

export const SAMPLE_PAGES: readonly BatchPageOption[] = [
  { id: 'home', title: 'Home', address: '/', current: true },
  { id: 'menu', title: 'Menu', address: '/menu', current: false },
  { id: 'about', title: 'About us', address: '/about', current: false },
  { id: 'events', title: 'Private events', address: '/events', current: false },
  { id: 'contact', title: 'Contact', address: '/contact', current: false },
];

export const SAMPLE_PAGES_AR: readonly BatchPageOption[] = [
  { id: 'home', title: 'الرئيسية', address: '/', current: true },
  { id: 'menu', title: 'قائمة الطعام', address: '/menu', current: false },
  { id: 'about', title: 'من نحن', address: '/about', current: false },
  { id: 'events', title: 'المناسبات الخاصة', address: '/events', current: false },
  { id: 'contact', title: 'اتصل بنا', address: '/contact', current: false },
];

const ZERO = { processing: 0, succeeded: 0, errored: 0, canceled: 0, expired: 0 } as const;

/** A job record on the sample pages; every field may be overridden. */
export function jobRecord(overrides: Partial<AiBatchJobRecord> = {}): AiBatchJobRecord {
  const pageIds = overrides.pageIds ?? SAMPLE_PAGES.map((page) => page.id);
  return {
    version: AI_BATCH_JOB_VERSION,
    id: 'job-1',
    kind: 'page-request',
    request: 'Translate every page into French',
    pageIds,
    targets: pageIds.map((pageId, index) => ({ itemId: `p${String(index)}`, pageId })),
    skipped: [],
    batchId: 'msgbatch_01',
    status: 'in_progress',
    createdAt: JOBS_NOW - 4 * MINUTE,
    updatedAt: JOBS_NOW - 4 * MINUTE,
    counts: { ...ZERO, processing: pageIds.length },
    endedAt: null,
    ...overrides,
  };
}

const ALL = SAMPLE_PAGES.map((page) => page.id);

/** Still answering: 3 of 5. */
export const JOB_IN_PROGRESS = jobRecord({
  id: 'job-progress',
  counts: { ...ZERO, processing: 2, succeeded: 3 },
});

/** Ended with answers: ready to apply. */
export const JOB_READY = jobRecord({
  id: 'job-ready',
  request: 'Add a short FAQ section to every page',
  status: 'ended',
  createdAt: JOBS_NOW - 3 * 60 * MINUTE,
  counts: { ...ZERO, succeeded: 4, expired: 1 },
  endedAt: '2026-10-12T11:20:00Z',
});

/** Applied: every way a page can land or miss. */
export const JOB_APPLIED = jobRecord({
  id: 'job-applied',
  request: 'Rewrite every page in a warmer, friendlier voice',
  status: 'applied',
  createdAt: JOBS_NOW - 26 * 60 * MINUTE,
  counts: { ...ZERO, succeeded: 4, errored: 1 },
  endedAt: '2026-10-11T12:30:00Z',
  outcomes: [
    { pageId: 'home', status: 'applied', transactionIds: ['tx-1'] },
    {
      pageId: 'menu',
      status: 'applied',
      transactionIds: ['tx-2'],
      salvaged: { kept: 3, dropped: 1 },
    },
    {
      pageId: 'about',
      status: 'refused',
      message: 'I cannot rewrite a page that only holds a legal notice.',
    },
    {
      pageId: 'events',
      status: 'rejected',
      message: 'The plan failed validation.',
      issues: [
        { code: 'unknown-command', message: 'Unknown command "moveSectionUp".' },
        { code: 'invalid-args', message: 'setProp needs a node id.' },
        { code: 'door-rejected', message: 'The page would lose its only heading.' },
      ],
    },
    {
      pageId: 'contact',
      status: 'error',
      message: 'The assistant service was overloaded.',
      retryable: true,
    },
  ],
});

/** Ended with no answers: the person canceled it. */
export const JOB_CANCELED = jobRecord({
  id: 'job-canceled',
  request: 'Add opening hours to the footer of every page',
  pageIds: ALL.slice(0, 3),
  status: 'ended',
  createdAt: JOBS_NOW - 50 * MINUTE,
  counts: { ...ZERO, canceled: 3 },
  endedAt: '2026-10-12T13:20:00Z',
});

/** Ended with no answers: every page errored. */
export const JOB_FAILED = jobRecord({
  id: 'job-failed',
  request: 'Make every hero image full width',
  pageIds: ALL.slice(0, 2),
  status: 'ended',
  createdAt: JOBS_NOW - 2 * 60 * MINUTE,
  counts: { ...ZERO, errored: 2 },
  endedAt: '2026-10-12T12:10:00Z',
});

export const SAMPLE_JOBS: readonly AiBatchJobRecord[] = [
  JOB_IN_PROGRESS,
  JOB_CANCELED,
  JOB_READY,
  JOB_APPLIED,
];

const AR_REQUESTS: Readonly<Record<string, string>> = {
  'job-progress': 'ترجم كل الصفحات إلى الفرنسية',
  'job-ready': 'أضف قسم أسئلة شائعة قصيرًا إلى كل صفحة',
  'job-applied': 'أعد كتابة كل صفحة بنبرة أدفأ وأقرب',
  'job-canceled': 'أضف ساعات العمل إلى تذييل كل صفحة',
  'job-failed': 'اجعل صورة الواجهة بعرض الصفحة في كل صفحة',
};

/** The same jobs, asked in Arabic. */
export const SAMPLE_JOBS_AR: readonly AiBatchJobRecord[] = SAMPLE_JOBS.map((job) => ({
  ...job,
  request: AR_REQUESTS[job.id] ?? job.request,
}));

const noop = (): void => undefined;

/** A view for the presentational stories: the given jobs, every action a no-op. */
export function fakeJobsView(overrides: Partial<BackgroundJobsView> = {}): BackgroundJobsView {
  return {
    jobs: SAMPLE_JOBS,
    pages: SAMPLE_PAGES,
    now: JOBS_NOW,
    connected: true,
    unavailable: undefined,
    submitting: false,
    submitError: undefined,
    pending: [],
    notices: {},
    retried: [],
    submit: () => Promise.resolve(true),
    refresh: noop,
    cancel: noop,
    apply: noop,
    remove: noop,
    retryLive: noop,
    watch: noop,
    ...overrides,
  };
}

/** What every page's answer is, by the items the batch was sent. */
export type BatchAnswers = (items: readonly AiBatchWireItem[]) => readonly AiBatchItemResult[];

export interface FakeBatchClient {
  readonly client: AiBatchClient;
  /** Every submit, with the model it named. */
  readonly sent: { readonly items: readonly AiBatchWireItem[]; readonly model?: string }[];
  /** How many status calls were made (the panel's polls and refreshes). */
  readonly polls: () => number;
  /** Every page answered: the batch has ended. */
  readonly end: () => void;
  /** The server refuses every call from now on, as a 501 or 409 with its own sentence. */
  readonly refuse: (status: number, message: string) => void;
}

/**
 * A batch client from memory. The batch answers when `end()` is called; until then its state
 * is `in_progress` with every item processing. `answers` decides each page's result.
 */
export function createFakeBatchClient(answers: BatchAnswers = () => []): FakeBatchClient {
  const sent: { items: readonly AiBatchWireItem[]; model?: string }[] = [];
  let status: AiBatchState['status'] = 'in_progress';
  let statusCalls = 0;
  let refusal: RemoteAiProviderError | undefined;
  const items = (): readonly AiBatchWireItem[] => sent.at(-1)?.items ?? [];
  const state = (): AiBatchState => {
    const total = items().length;
    const results = status === 'ended' ? answers(items()) : [];
    const errored = results.filter((result) => result.outcome === 'error').length;
    return {
      batchId: 'msgbatch_fake',
      status,
      counts: {
        processing: status === 'ended' ? 0 : total,
        succeeded: status === 'ended' ? total - errored : 0,
        errored,
        canceled: 0,
        expired: 0,
      },
      createdAt: '2026-10-12T14:00:00Z',
      endedAt: status === 'ended' ? '2026-10-12T14:20:00Z' : null,
    };
  };
  const answer = <T>(value: () => T): Promise<T> =>
    refusal === undefined ? Promise.resolve(value()) : Promise.reject(refusal);
  return {
    client: {
      submit: (batch, options) => {
        if (refusal !== undefined) return Promise.reject(refusal);
        sent.push({
          items: batch,
          ...(options?.model === undefined ? {} : { model: options.model }),
        });
        return answer(state);
      },
      status: () => {
        statusCalls += 1;
        return answer(state);
      },
      results: () => answer(() => answers(items())),
      cancel: () => {
        status = 'canceling';
        return answer(state);
      },
    },
    sent,
    polls: () => statusCalls,
    end: () => {
      status = 'ended';
    },
    refuse: (code, message) => {
      refusal = new RemoteAiProviderError(message, {
        code: 'http-status',
        retryable: false,
        status: code,
      });
    },
  };
}

/** A plan that rewrites a fixture page's one line of text (`fivePageSite`'s `intro`). */
export function introPlan(content: string): AiPlan {
  return {
    rationale: 'Rewrite the intro',
    commands: [{ command: 'setProp', args: { id: 'intro', key: 'content', value: content } }],
  };
}
