/**
 * Background jobs, headless (2026-10-12): `useBackgroundJobs` over a real site kernel, the
 * real runner and job store, and a batch client from memory — no network anywhere.
 *
 * Start → list → poll (only while watched, never while the tab is hidden) → apply (one Undo
 * per page, every miss reported per page) → Retry live (the request on that page as the
 * panel's own run, once the panel edits that page). A server that cannot batch leaves its
 * sentence and Submit waits; jobs survive a reload; the bearer token never reaches storage.
 */
import { act, render, waitFor } from '@testing-library/react';
import {
  createSiteBuilder,
  type AiBatchAgentOptions,
  type BuilderSiteKernel,
} from '@craftkit/builder';
import { fivePageSite, fixedClock, fixtureBlocks, seededIds } from '@craftkit/builder/testing';
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  batchClientFromEnv,
  batchJobsKey,
  createLocalBatchJobStore,
  type BackgroundJobsHost,
} from '../../jobs';
import type { BackgroundJobsView } from '../model/background-jobs';
import { createFakeBatchClient, introPlan, type BatchAnswers } from '../testing/batch-fixtures';

import { useBackgroundJobs } from './use-background-jobs';

const NOW = Date.UTC(2026, 9, 12, 14, 0);
const REQUEST = 'Rewrite the intro in French';
const agent = (): AiBatchAgentOptions => ({
  validationPorts: { clock: fixedClock(), ids: seededIds('jobs-plan') },
});

function siteKernel(): BuilderSiteKernel {
  return createSiteBuilder({
    site: fivePageSite(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('jobs-site') },
  });
}

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

interface HarnessProps {
  readonly host: BackgroundJobsHost;
  readonly model?: string;
  readonly live: { readonly setDraft: (text: string) => void; readonly send: () => void };
  readonly seen: { current: BackgroundJobsView | undefined };
}

/** Hands the test each view the hook returns, after the render commits. */
function keep(seen: HarnessProps['seen'], view: BackgroundJobsView | undefined): void {
  seen.current = view;
}

/** The hook as LiveAgentPanel runs it: the panel edits whichever page the site has open. */
function Harness({ host, model, live, seen }: HarnessProps) {
  const open = useSyncExternalStore(
    (listener) => host.site.subscribe(listener),
    () => host.site.currentPage(),
  );
  const view = useBackgroundJobs({
    host,
    locale: 'en',
    agentOptions: agent,
    model,
    kernel: host.site.page(open),
    live,
  });
  useLayoutEffect(() => {
    keep(seen, view);
  });
  return null;
}

function setup(answers: BatchAnswers = () => [], storage: Storage = memory()) {
  const site = siteKernel();
  const fake = createFakeBatchClient(answers);
  const host: BackgroundJobsHost = {
    client: fake.client,
    site,
    store: createLocalBatchJobStore(storage, 'playground/site'),
    ids: seededIds('job'),
    clock: { now: () => NOW },
  };
  const live = { setDraft: vi.fn(), send: vi.fn() };
  const seen: { current: BackgroundJobsView | undefined } = { current: undefined };
  const view = render(<Harness host={host} live={live} seen={seen} />);
  const jobs = (): BackgroundJobsView => {
    if (seen.current === undefined) throw new Error('no jobs view');
    return seen.current;
  };
  return { site, fake, host, live, seen, jobs, storage, view };
}

async function loaded(jobs: () => BackgroundJobsView): Promise<void> {
  await waitFor(() => {
    expect(jobs().jobs).toBeDefined();
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useBackgroundJobs', () => {
  it('sends a job for the chosen pages and lists it, newest first', async () => {
    const { jobs, fake, site } = setup();
    await loaded(jobs);
    expect(jobs().jobs).toEqual([]);
    expect(jobs().pages.map(({ id, current }) => `${id}${current ? '*' : ''}`)).toEqual([
      'work*',
      'home',
      'pricing',
      'about',
      'contact',
    ]);

    let ok = false;
    await act(async () => {
      ok = await jobs().submit(REQUEST, ['home', 'about']);
    });
    expect(ok).toBe(true);
    expect(fake.sent[0]?.items.map(({ id }) => id)).toEqual(['p0', 'p1']);
    expect(JSON.stringify(fake.sent[0]?.items[0]?.request)).toContain('Home');
    expect(
      jobs().jobs?.map(({ request, status, pageIds }) => ({ request, status, pageIds })),
    ).toEqual([{ request: REQUEST, status: 'in_progress', pageIds: ['home', 'about'] }]);
    expect(jobs().now).toBe(NOW);
    expect(site.transactions()).toHaveLength(0);
  });

  it('asks about batches in progress while watched, every 30 s, never while the tab is hidden', async () => {
    const { jobs, fake } = setup();
    await loaded(jobs);
    await act(async () => {
      await jobs().submit(REQUEST, ['home']);
    });
    vi.useFakeTimers();
    const advance = async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    };

    await advance(60_000);
    expect(fake.polls()).toBe(0);
    act(() => {
      jobs().watch(true);
    });
    await advance(1);
    expect(fake.polls()).toBe(1);
    await advance(30_000);
    expect(fake.polls()).toBe(2);

    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await advance(60_000);
    expect(fake.polls()).toBe(2);
    hidden.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fake.polls()).toBe(3);
    hidden.mockRestore();

    act(() => {
      jobs().watch(false);
    });
    await advance(90_000);
    expect(fake.polls()).toBe(3);

    // Once the batch ends nothing is in progress, and the list stops asking.
    fake.end();
    act(() => {
      jobs().watch(true);
    });
    await advance(1);
    expect(jobs().jobs?.[0]?.status).toBe('ended');
    const after = fake.polls();
    await advance(120_000);
    expect(fake.polls()).toBe(after);
  });

  it('applies: each answered page lands as its own Undo, every miss is reported per page', async () => {
    const { jobs, fake, site } = setup((items) => [
      { id: items[0]?.id ?? '', outcome: 'plan', plan: introPlan('Bonjour, voici la maison.') },
      { id: items[1]?.id ?? '', outcome: 'refusal', message: 'Not on this page.' },
      {
        id: items[2]?.id ?? '',
        outcome: 'plan',
        plan: { rationale: 'Bad', commands: [{ command: 'nope', args: {} }] },
      },
      {
        id: items[3]?.id ?? '',
        outcome: 'error',
        type: 'overloaded_error',
        message: 'Overloaded.',
        retryable: true,
      },
    ]);
    await loaded(jobs);
    await act(async () => {
      await jobs().submit(REQUEST, ['home', 'about', 'pricing', 'contact']);
    });
    fake.end();
    await act(async () => {
      jobs().refresh();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(jobs().jobs?.[0]?.status).toBe('ended');
    });
    const jobId = jobs().jobs?.[0]?.id ?? '';
    act(() => {
      jobs().apply(jobId);
    });
    expect(jobs().pending).toEqual([jobId]);
    await waitFor(() => {
      expect(jobs().jobs?.[0]?.status).toBe('applied');
    });
    expect(jobs().pending).toEqual([]);
    expect(jobs().jobs?.[0]?.outcomes?.map(({ pageId, status }) => `${pageId}:${status}`)).toEqual([
      'home:applied',
      'about:refused',
      'pricing:rejected',
      'contact:error',
    ]);
    expect(site.page('home').getDocument().nodes['intro']?.props['content']).toBe(
      'Bonjour, voici la maison.',
    );
    expect(site.transactions()).toHaveLength(1);
    expect(site.undo()).toBe(true);
    expect(site.page('home').getDocument().nodes['intro']?.props['content']).not.toContain(
      'Bonjour',
    );
  });

  it('retries a page live: at once on the page open now, after showing any other page', async () => {
    const { jobs, fake, live, site } = setup((items) =>
      items.map(({ id }) => ({ id, outcome: 'refusal' as const, message: 'No.' })),
    );
    await loaded(jobs);
    await act(async () => {
      await jobs().submit(REQUEST, ['work', 'about']);
    });
    const jobId = jobs().jobs?.[0]?.id ?? '';

    act(() => {
      jobs().retryLive(jobId, 'work');
    });
    expect(live.setDraft).toHaveBeenLastCalledWith(REQUEST);
    expect(live.send).toHaveBeenCalledTimes(1);

    act(() => {
      jobs().retryLive(jobId, 'about');
    });
    expect(site.currentPage()).toBe('about');
    await waitFor(() => {
      expect(live.send).toHaveBeenCalledTimes(2);
    });
    expect(jobs().retried).toEqual([`${jobId}/work`, `${jobId}/about`]);
    expect(fake.sent).toHaveLength(1);
  });

  it("shows a server's refusal to batch and holds Submit: a 501 for good, a 409 for that model", async () => {
    const { jobs, fake, host, live, seen, view } = setup();
    await loaded(jobs);
    fake.refuse(
      501,
      'Background batches are not configured on this server: they need the Anthropic Messages API (ANTHROPIC_API_KEY).',
    );
    let ok = true;
    await act(async () => {
      ok = await jobs().submit(REQUEST, ['home']);
    });
    expect(ok).toBe(false);
    expect(jobs().unavailable).toMatch(/^Background batches are not configured/u);
    expect(jobs().submitError).toBeUndefined();
    expect(jobs().jobs).toEqual([]);

    // A 409 is about the model asked for: another pick lifts it.
    const other = setup();
    await loaded(other.jobs);
    other.fake.refuse(409, 'openrouter/x cannot run background batches.');
    other.view.rerender(
      <Harness host={other.host} live={other.live} seen={other.seen} model="openrouter/x" />,
    );
    await act(async () => {
      await other.jobs().submit(REQUEST, ['home']);
    });
    expect(other.jobs().unavailable).toBe('openrouter/x cannot run background batches.');
    other.view.rerender(
      <Harness host={other.host} live={other.live} seen={other.seen} model="api:claude" />,
    );
    expect(other.jobs().unavailable).toBeUndefined();
    view.rerender(<Harness host={host} live={live} seen={seen} model="api:claude" />);
    expect(jobs().unavailable).toMatch(/^Background batches/u);
  });

  it('finds its jobs again after a reload, and lists them without a server', async () => {
    const storage = memory();
    const first = setup(() => [], storage);
    await loaded(first.jobs);
    await act(async () => {
      await first.jobs().submit(REQUEST, ['home']);
    });
    first.view.unmount();

    const site = siteKernel();
    const seen: { current: BackgroundJobsView | undefined } = { current: undefined };
    const host: BackgroundJobsHost = {
      client: undefined,
      site,
      store: createLocalBatchJobStore(storage, 'playground/site'),
    };
    render(<Harness host={host} live={{ setDraft: vi.fn(), send: vi.fn() }} seen={seen} />);
    await waitFor(() => {
      expect(seen.current?.jobs?.map(({ request }) => request)).toEqual([REQUEST]);
    });
    expect(seen.current?.connected).toBe(false);
    expect(await seen.current?.submit(REQUEST, ['home'])).toBe(false);
  });

  it('never writes the bearer token where jobs are kept', async () => {
    const storage = memory();
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            version: 1,
            id: 'msgbatch_live',
            status: 'in_progress',
            counts: { processing: 1, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
            createdAt: '2026-10-12T14:00:00Z',
            endedAt: null,
          }),
          { status: 200 },
        ),
      );
    const client = batchClientFromEnv(
      {
        VITE_AI_PLAN_ENDPOINT: 'https://assistant.example.test/plan',
        VITE_AI_PLAN_TOKEN: 'sk-sekret',
      },
      fetchImpl,
    );
    const seen: { current: BackgroundJobsView | undefined } = { current: undefined };
    const host: BackgroundJobsHost = {
      client,
      site: siteKernel(),
      store: createLocalBatchJobStore(storage, 'playground/site'),
    };
    render(<Harness host={host} live={{ setDraft: vi.fn(), send: vi.fn() }} seen={seen} />);
    await waitFor(() => {
      expect(seen.current?.jobs).toBeDefined();
    });
    await act(async () => {
      await seen.current?.submit(REQUEST, ['home']);
    });
    const stored = storage.getItem(batchJobsKey('playground/site')) ?? '';
    expect(stored).toContain('msgbatch_live');
    expect(stored).not.toContain('sk-sekret');
    expect(stored).not.toMatch(/bearer|authorization|endpoint/iu);
  });
});
