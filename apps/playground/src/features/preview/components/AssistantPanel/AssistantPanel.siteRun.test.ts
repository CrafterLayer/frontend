import {
  createOfflineSiteStageProvider,
  createSiteBuilder,
  defaultDesignSystem,
  emptyDocument,
  type BuilderSite,
  type BuilderSiteKernel,
  type StageRequest,
} from '@craftkit/builder';
import {
  createScriptedSiteStageProvider,
  fixedClock,
  fixtureBlocks,
  seededIds,
} from '@craftkit/builder/testing';
import { describe, expect, it, vi } from 'vitest';

import { runSiteGeneration, siteRunLabel, type SiteRunHost } from './AssistantPanel.siteRun';

const oneHomePage = (): BuilderSite => ({
  siteVersion: 1,
  dir: 'ltr',
  pages: [
    {
      id: 'p-home',
      address: '/',
      title: 'Home',
      purpose: 'The page that was already here.',
      audience: 'anyone',
      document: emptyDocument('site', 'ltr'),
      regions: [],
    },
  ],
  sharedRegions: {},
  designSystem: defaultDesignSystem(),
  assets: {},
});

const kernelWith = (site: BuilderSite, seed: string): BuilderSiteKernel =>
  createSiteBuilder({
    site,
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds(seed) },
  });

function hostFor(overrides: Partial<SiteRunHost> = {}) {
  const kernel = kernelWith(oneHomePage(), 'live');
  let drafts = 0;
  const host: SiteRunHost = {
    kernel,
    createDraft: (site) => {
      drafts += 1;
      return kernelWith(site, `draft-${String(drafts)}`);
    },
    provider: createOfflineSiteStageProvider(),
    ...overrides,
  };
  return { host, kernel };
}

const run = (host: SiteRunHost, over: Record<string, unknown> = {}) =>
  runSiteGeneration({
    host,
    runId: 'run-1',
    brief: 'a ceramics studio in Amman',
    seed: 'seed-1',
    ...over,
  });

describe('runSiteGeneration', () => {
  it('builds a whole site and lands it as ONE transaction', async () => {
    const { host, kernel } = hostFor();

    const outcome = await run(host);

    if (!outcome.ok) throw new Error(`the run was refused: ${outcome.reason}`);
    expect(outcome.pages).toBeGreaterThan(1);
    /* One entry in history for a run that wrote several pages and their sections. */
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getSite().pages.length).toBe(outcome.pages + 1);
    expect(kernel.validate().ok).toBe(true);
  });

  it('reverses the whole generation in ONE undo (SC-011)', async () => {
    const { host, kernel } = hostFor();
    const captured = JSON.stringify(kernel.getSite());

    await run(host);

    expect(kernel.undo()).toBe(true);
    expect(JSON.stringify(kernel.getSite())).toBe(captured);
  });

  it('is deterministic: the same brief and seed land the same site (SC-013)', async () => {
    const first = hostFor();
    const second = hostFor();

    await run(first.host);
    await run(second.host);

    expect(JSON.stringify(second.kernel.getSite())).toBe(JSON.stringify(first.kernel.getSite()));
  });

  it('leaves the live site BYTE-IDENTICAL when a stage fails (SC-010)', async () => {
    const { host, kernel } = hostFor({
      provider: createScriptedSiteStageProvider({
        stages: { structure: { failFirst: Infinity } },
        fallback: createOfflineSiteStageProvider(),
      }),
    });
    const captured = JSON.stringify(kernel.getSite());

    const outcome = await run(host);

    expect(outcome.ok).toBe(false);
    /*
      Nothing to clean up, because nothing wrote: the failure happened while the
      run still had no kernel of the person's to write to.
    */
    expect(JSON.stringify(kernel.getSite())).toBe(captured);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('leaves the live site BYTE-IDENTICAL when a person presses Stop', async () => {
    const controller = new AbortController();
    const { host, kernel } = hostFor({
      provider: createScriptedSiteStageProvider({
        stages: { content: { hang: true } },
        fallback: createOfflineSiteStageProvider(),
      }),
    });
    const captured = JSON.stringify(kernel.getSite());

    const pending = run(host, { signal: controller.signal });
    await vi.waitFor(() => {
      expect(controller.signal.aborted).toBe(false);
    });
    controller.abort();

    const outcome = await pending;
    expect(outcome).toMatchObject({ ok: false, cancelled: true });
    expect(JSON.stringify(kernel.getSite())).toBe(captured);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('refuses to commit a run whose Stop landed after the last stage', async () => {
    const controller = new AbortController();
    const { host, kernel } = hostFor({
      provider: {
        /* Aborts on the way out of the final stage: everything succeeded, and
           the person changed their mind while it did. */
        async run(request, options) {
          const answer = await createOfflineSiteStageProvider().run(request, options);
          if (request.stage === 'assembly') controller.abort();
          return answer;
        },
      },
    });
    const captured = JSON.stringify(kernel.getSite());

    const outcome = await run(host, { signal: controller.signal });

    expect(outcome).toMatchObject({ ok: false, cancelled: true });
    expect(kernel.transactions()).toHaveLength(0);
    expect(JSON.stringify(kernel.getSite())).toBe(captured);
  });

  it('never writes into the live kernel while the run is going', async () => {
    const { host, kernel } = hostFor();
    const dispatch = vi.spyOn(kernel, 'dispatch');
    const group = vi.spyOn(kernel, 'dispatchGroup');

    await run(host);

    /*
      SC-002, measured: the live door is touched once, by the commit, and never
      command by command. Every other write in the run went into a throwaway.
    */
    expect(dispatch).toHaveBeenCalledTimes(0);
    expect(group).toHaveBeenCalledTimes(1);
    expect(group.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it('sends the LIVE registry vocabulary, so a commit cannot refuse what a stage allowed', async () => {
    const seen: string[][] = [];
    const { host } = hostFor({
      provider: {
        async run(request, options) {
          const widened: StageRequest = request;
          if (widened.stage === 'structure') seen.push([...widened.blockTypes]);
          return createOfflineSiteStageProvider().run(request, options);
        },
      },
    });

    await run(host);

    expect(seen).toHaveLength(1);
    expect(seen[0]?.length).toBeGreaterThan(0);
    expect(seen[0]).toContain('text');
  });

  it('names the run in history in the person own words', () => {
    expect(siteRunLabel('  a ceramics   studio in Amman ', 3)).toBe(
      'AI: a ceramics studio in Amman (3 pages)',
    );
    /* A brief long enough to fill the history panel is cut, and says it was. */
    expect(siteRunLabel('x'.repeat(200), 4)).toContain('…');
    expect(siteRunLabel('x'.repeat(200), 4).length).toBeLessThan(80);
  });
});
