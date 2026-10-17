import {
  createAiBatchRunner,
  systemClock,
  systemIds,
  type AiBatchAgentOptions,
  type AiBatchJobRecord,
  type AiBatchJobStore,
  type BuilderKernel,
} from '@craftkit/builder';
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import {
  BATCH_POLL_MS,
  batchFailureMessage,
  batchUnavailableOf,
  isActive,
  type BackgroundJobsHost,
  type BatchJobSite,
  type BatchUnavailable,
} from '../../jobs';
import { jobsLabels } from '../copy/jobs-labels';
import {
  retriedKey,
  type BackgroundJobsView,
  type BatchPageOption,
} from '../model/background-jobs';
import type { AgentController, Locale } from '../model/view-types';

export interface UseBackgroundJobsOptions {
  /** The host's client, site and store; absent, there are no background jobs. */
  readonly host: BackgroundJobsHost | undefined;
  readonly locale: Locale;
  /** The options a live run on a page would take for this request (`batchAgentOptions`). */
  readonly agentOptions: (request: string) => AiBatchAgentOptions;
  /** The person's model pick, sent as every page's model; the server holds it to its list. */
  readonly model?: string | undefined;
  /** The page the panel edits: Retry live waits until the host hands it the page it showed. */
  readonly kernel: BuilderKernel;
  /** The live panel: Retry live puts the request in the composer and sends it. */
  readonly live: Pick<AgentController, 'setDraft' | 'send'>;
}

interface SitePages {
  readonly pages: readonly {
    readonly id: string;
    readonly title: string;
    readonly address: string;
  }[];
}

const NO_SITE: SitePages = { pages: [] };
const noSubscribe = (): (() => void) => () => undefined;

interface Down extends BatchUnavailable {
  /** The model it was said for: a 409 is about that model only. */
  readonly model: string;
}

function pageOptions(site: SitePages, current: string): readonly BatchPageOption[] {
  return site.pages.map(({ id, title, address }) => ({
    id,
    title,
    address,
    current: id === current,
  }));
}

/** The store's records, newest first (as the runner lists them). */
async function listNewestFirst(store: AiBatchJobStore): Promise<readonly AiBatchJobRecord[]> {
  const records = await store.list();
  return [...records].sort((left, right) => right.createdAt - left.createdAt);
}

/** Whether the panel already edits this page (`page()` throws for one the site lost). */
function edits(site: BatchJobSite, kernel: BuilderKernel, pageId: string): boolean {
  return site.pages().includes(pageId) && kernel === site.page(pageId);
}

/**
 * Background jobs for the panel (2026-10-12): one request on several pages, sent as one batch
 * at half price (`createAiBatchRunner`), its records kept by the host's store.
 *
 * - The list is read when the panel mounts, and again after every call.
 * - While the list is open (`watch(true)`) and a batch is still answering, every batch in
 *   progress is asked about at once and then every 30 s; never while the tab is hidden.
 * - A server that cannot batch (501, or 409 for the model picked) leaves its sentence in
 *   `unavailable`, and Submit waits until the model changes or the server says otherwise.
 * - Retry live shows the page, puts the job's request in the composer and sends it as the
 *   panel's own run, once the host has handed the panel that page's kernel.
 */
export function useBackgroundJobs({
  host,
  locale,
  agentOptions,
  model,
  kernel,
  live,
}: UseBackgroundJobsOptions): BackgroundJobsView | undefined {
  const site = host?.site;
  const store = host?.store;
  const client = host?.client;
  const ids = host?.ids ?? systemIds;
  const clock = host?.clock ?? systemClock;
  const pollMs = host?.pollMs ?? BATCH_POLL_MS;
  const fallback = jobsLabels(locale).fallback;
  const chosenModel = model?.trim() ?? '';

  const runner = useMemo(
    () =>
      client === undefined || store === undefined
        ? undefined
        : createAiBatchRunner({ client, store, ids, clock }),
    [client, store, ids, clock],
  );

  // The page list follows the site: a page added, renamed or opened elsewhere.
  const subscribe = useMemo(
    () => (site === undefined ? noSubscribe : (listener: () => void) => site.subscribe(listener)),
    [site],
  );
  const siteState = useSyncExternalStore<SitePages>(subscribe, () => site?.getSite() ?? NO_SITE);
  const openPage = useSyncExternalStore(subscribe, () => site?.currentPage() ?? '');
  const pages = useMemo(() => pageOptions(siteState, openPage), [siteState, openPage]);

  const [jobs, setJobs] = useState<readonly AiBatchJobRecord[] | undefined>(undefined);
  const [now, setNow] = useState(0);
  const [pending, setPending] = useState<readonly string[]>([]);
  const [notices, setNotices] = useState<Readonly<Record<string, string>>>({});
  const [down, setDown] = useState<Down | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [retried, setRetried] = useState<readonly string[]>([]);
  const [watching, setWatching] = useState(false);
  // The page a Retry live waits for (the host hands the panel its kernel on the next render).
  const retryFor = useRef<string | null>(null);

  const read = async (): Promise<void> => {
    if (store === undefined) return;
    try {
      setJobs(await listNewestFirst(store));
    } catch {
      setJobs((previous) => previous ?? []);
    }
    setNow(clock.now());
  };

  const noted = (jobId: string, message: string | undefined): void => {
    setNotices((previous) => {
      const rest = Object.fromEntries(Object.entries(previous).filter(([id]) => id !== jobId));
      return message === undefined ? rest : { ...rest, [jobId]: message };
    });
  };

  /** One call about one job: marked pending, its failure kept as the job's notice. */
  const act = async (jobId: string, call: () => Promise<unknown>): Promise<void> => {
    setPending((previous) => [...previous, jobId]);
    noted(jobId, undefined);
    try {
      await call();
    } catch (cause) {
      const unavailable = batchUnavailableOf(cause);
      if (unavailable?.status === 501) setDown({ ...unavailable, model: chosenModel });
      noted(jobId, batchFailureMessage(cause, fallback));
    } finally {
      setPending((previous) => previous.filter((id) => id !== jobId));
      await read();
    }
  };

  const refreshActive = async (): Promise<void> => {
    if (runner === undefined || jobs === undefined) return;
    for (const job of jobs.filter(isActive)) await act(job.id, () => runner.refresh(job.id));
  };

  // The store is the external system: its records arrive in a callback.
  useEffect(() => {
    if (store === undefined) return undefined;
    let live = true;
    listNewestFirst(store).then(
      (records) => {
        if (!live) return;
        setJobs(records);
        setNow(clock.now());
      },
      () => {
        if (live) setJobs([]);
      },
    );
    return () => {
      live = false;
    };
  }, [store, clock]);

  // Polling: while the list is open and a batch answers, and only while the tab is shown.
  const active = jobs?.some(isActive) ?? false;
  const poll = useEffectEvent(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    void refreshActive();
  });
  useEffect(() => {
    if (!watching || !active) return undefined;
    // Asked at once when the list opens (on the next tick), then every `pollMs`.
    const first = setTimeout(() => {
      poll();
    }, 0);
    const timer = setInterval(() => {
      poll();
    }, pollMs);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [watching, active, pollMs]);

  // Retry live on another page: sent once the panel edits that page.
  const sendRetry = useEffectEvent(() => {
    const pageId = retryFor.current;
    if (pageId === null || site === undefined || !edits(site, kernel, pageId)) return;
    retryFor.current = null;
    live.send();
  });
  useEffect(() => {
    sendRetry();
  }, [kernel]);

  if (host === undefined || site === undefined || store === undefined) return undefined;

  const unavailable =
    down !== undefined && (down.status === 501 || down.model === chosenModel)
      ? down.message
      : undefined;

  return {
    jobs,
    pages,
    now,
    connected: runner !== undefined,
    unavailable,
    submitting,
    submitError,
    pending,
    notices,
    retried,
    submit: async (request, pageIds) => {
      if (runner === undefined || submitting) return false;
      setSubmitting(true);
      setSubmitError(undefined);
      try {
        await runner.submitPageRequest({
          site,
          pageIds,
          request,
          agent: agentOptions(request.trim()),
          ...(chosenModel === '' ? {} : { model: chosenModel }),
        });
        setDown(undefined);
        await read();
        return true;
      } catch (cause) {
        const unavailableNow = batchUnavailableOf(cause);
        if (unavailableNow === undefined) setSubmitError(batchFailureMessage(cause, fallback));
        else setDown({ ...unavailableNow, model: chosenModel });
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    refresh: (jobId) => {
      if (runner === undefined) return;
      if (jobId === undefined) void refreshActive();
      else void act(jobId, () => runner.refresh(jobId));
    },
    cancel: (jobId) => {
      if (runner !== undefined) void act(jobId, () => runner.cancel(jobId));
    },
    apply: (jobId) => {
      const job = jobs?.find((candidate) => candidate.id === jobId);
      if (runner === undefined || job === undefined) return;
      void act(jobId, () => runner.apply(jobId, { site, agent: agentOptions(job.request) }));
    },
    remove: (jobId) => {
      void act(jobId, () => runner?.remove(jobId) ?? store.remove(jobId));
    },
    retryLive: (jobId, pageId) => {
      const job = jobs?.find((candidate) => candidate.id === jobId);
      if (job === undefined || !site.pages().includes(pageId)) return;
      const key = retriedKey(jobId, pageId);
      setRetried((previous) => (previous.includes(key) ? previous : [...previous, key]));
      live.setDraft(job.request);
      if (edits(site, kernel, pageId)) {
        live.send();
        return;
      }
      retryFor.current = pageId;
      site.setCurrentPage(pageId);
    },
    watch: setWatching,
  };
}
