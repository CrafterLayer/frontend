import { describe, expect, it, vi } from 'vitest';

import { createSiteBuilder } from '@craftkit/builder-core';
import { fixtureBlocks } from '@craftkit/builder-core/testing';
import { defaultDesignSystem, emptyDocument, type BuilderSite } from '@craftkit/builder-schema';

import { createScriptedSiteStageProvider } from '../testing/scripted-stage-provider';
import { applySiteCommands, commitGeneratedSite } from './apply-site';
import { generateSite, type StageEvent } from './generate-site';
import { createOfflineSiteStageProvider } from './offline/offline-stage-provider';
import type { SiteStageProvider } from './stage-provider';
import { StageRejectedError } from './stages/errors';
import { SITE_STAGES, type StageLimits, type StageRequest } from './wire';

const LIMITS: StageLimits = { maxPages: 4, maxSectionsPerPage: 6, maxTokens: 20_000 };
const BLOCK_TYPES = ['hero', 'text', 'pricing'];
const COMMANDS = ['addPage', 'insertNode', 'setProp', 'setDesignSystem'];

function run(overrides: Partial<Parameters<typeof generateSite>[0]> = {}) {
  return generateSite({
    runId: 'run-1',
    brief: 'a ceramics studio in Amman',
    provider: createOfflineSiteStageProvider(),
    seed: 'seed-1',
    baseFingerprint: 'site-v1-sha256-abc',
    dir: 'ltr',
    limits: LIMITS,
    blockTypes: BLOCK_TYPES,
    allowedCommands: COMMANDS,
    ...overrides,
  });
}

describe('generateSite', () => {
  it('runs every stage, in order, and returns COMMANDS', async () => {
    const seen: StageEvent[] = [];
    const site = await run({ onStage: (event) => seen.push(event) });

    expect(
      seen.filter((event) => event.type === 'stage.started').map((event) => event.stage),
    ).toEqual([...SITE_STAGES]);
    expect(site.commands.length).toBeGreaterThan(0);
    expect(site.pages.length).toBeGreaterThan(0);
  });

  it('never touches a kernel — it is handed none, and returns steps', async () => {
    const site = await run();
    /*
      This is what makes "a failure at stage 4 leaves the workspace
      byte-identical" trivially true: stage 4 could never have written to it.
    */
    for (const command of site.commands) {
      expect(COMMANDS).toContain(command.command);
    }
  });

  it('is DETERMINISTIC: the same brief and seed produce the same site', async () => {
    const first = await run();
    const second = await run();
    expect(second.commands).toEqual(first.commands);
    expect(second.pages).toEqual(first.pages);
  });

  it('produces a different site for a different brief', async () => {
    /*
      Two briefs whose hashes land on different page counts. The offline
      provider derives the COUNT from the brief so two briefs are not always the
      same site — but a fixed plan means many briefs do share a shape, and a
      test asserting they never do would be asserting something the provider
      does not promise.
    */
    const first = await run({ brief: 'a' });
    const second = await run({ brief: 'abc' });
    expect(second.pages.length).not.toBe(first.pages.length);
  });

  it('carries the seed on EVERY stage envelope, so a stage can be re-run alone', async () => {
    const seeds: string[] = [];
    const provider = createScriptedSiteStageProvider({
      fallback: createOfflineSiteStageProvider(),
    });
    const spy = vi.spyOn(provider, 'run');
    await run({ provider });
    for (const call of spy.mock.calls) {
      seeds.push((call[0] as { seed: string }).seed);
    }
    expect(new Set(seeds)).toEqual(new Set(['seed-1']));
  });

  describe('validating between stages', () => {
    it('stops at the stage that failed, and never asks the next one', async () => {
      const provider = createScriptedSiteStageProvider({
        stages: {
          structure: {
            failFirst: Infinity,
            error: () => new StageRejectedError('structure', ['made it up'], false),
          },
        },
        fallback: createOfflineSiteStageProvider(),
      });

      await expect(run({ provider })).rejects.toThrow(StageRejectedError);
      // Content, design and assembly were never asked for.
      expect(provider.calls()['content']).toBeUndefined();
      expect(provider.calls()['assembly']).toBeUndefined();
    });

    it('asks a repairable stage ONCE more, and no third time', async () => {
      const provider = createScriptedSiteStageProvider({
        stages: {
          sitemap: {
            failFirst: 1,
            error: () => new StageRejectedError('sitemap', ['no pages'], true),
          },
        },
        fallback: createOfflineSiteStageProvider(),
      });

      await run({ provider });
      expect(provider.calls()['sitemap']).toBe(2);
    });

    it('does NOT retry a rejection that asking again cannot fix', async () => {
      const provider = createScriptedSiteStageProvider({
        stages: {
          structure: {
            failFirst: Infinity,
            error: () => new StageRejectedError('structure', ['not a block'], false),
          },
        },
        fallback: createOfflineSiteStageProvider(),
      });

      await expect(run({ provider })).rejects.toThrow(StageRejectedError);
      /*
        The model was handed the list of types. A second call would be spending
        a round trip to be told the same thing.
      */
      expect(provider.calls()['structure']).toBe(1);
    });

    it('says which stage was rejected, why, and whether it will try again', async () => {
      const seen: StageEvent[] = [];
      const provider = createScriptedSiteStageProvider({
        stages: {
          sitemap: {
            failFirst: 1,
            error: () => new StageRejectedError('sitemap', ['It named no pages at all.'], true),
          },
        },
        fallback: createOfflineSiteStageProvider(),
      });

      await run({ provider, onStage: (event) => seen.push(event) });
      const rejection = seen.find((event) => event.type === 'stage.rejected');
      expect(rejection).toMatchObject({
        stage: 'sitemap',
        reasons: ['It named no pages at all.'],
        retrying: true,
      });
    });

    it('refuses a structure naming a block this build does not have', async () => {
      const provider = createScriptedSiteStageProvider({
        stages: {
          structure: {
            response: (request) => ({
              stage: 'structure',
              pages: (request as unknown as { pages: { id: string }[] }).pages.map((page) => ({
                pageId: page.id,
                sections: [{ id: 'made-up', type: 'carousel', intent: 'Show things.' }],
              })),
            }),
          },
        },
        fallback: createOfflineSiteStageProvider(),
      });

      await expect(run({ provider })).rejects.toThrow(/carousel/u);
    });

    it('refuses content that is still filler', async () => {
      const provider = createScriptedSiteStageProvider({
        stages: {
          content: {
            response: (request) => ({
              stage: 'content',
              pageId: (request as unknown as { page: { id: string } }).page.id,
              sections: (request as unknown as { sections: { id: string }[] }).sections.map(
                (section) => ({
                  sectionId: section.id,
                  props: { heading: 'Lorem ipsum dolor sit amet' },
                }),
              ),
            }),
          },
        },
        fallback: createOfflineSiteStageProvider(),
      });

      await expect(run({ provider })).rejects.toThrow(/placeholder copy/u);
    });
  });

  describe('cancellation', () => {
    it('stops at the stage in flight and never reaches the next', async () => {
      const controller = new AbortController();
      const provider = createScriptedSiteStageProvider({
        stages: { structure: { hang: true } },
        fallback: createOfflineSiteStageProvider(),
      });

      const pending = run({ provider, signal: controller.signal });
      await vi.waitFor(() => {
        expect(provider.calls()['structure']).toBe(1);
      });
      controller.abort();

      await expect(pending).rejects.toThrow(/aborted/iu);
      expect(provider.calls()['content']).toBeUndefined();
    });

    it('does not start at all when the signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const provider = createScriptedSiteStageProvider({
        fallback: createOfflineSiteStageProvider(),
      });

      await expect(run({ provider, signal: controller.signal })).rejects.toThrow(/aborted/iu);
      expect(provider.calls()).toEqual({});
    });
  });

  /**
   * A provider whose content stage finishes the LAST page first.
   *
   * Without it the page-order test proves nothing: the offline provider is
   * arithmetic, so a pool started in page order also finishes in page order,
   * and a `generateSite` that had no sort at all would pass. This one inverts
   * the finishing order on purpose, which is the only condition under which the
   * sort is doing any work.
   */
  function finishesBackwards(): SiteStageProvider {
    const offline = createOfflineSiteStageProvider();
    return {
      async run(request, options) {
        const widened: StageRequest = request;
        if (widened.stage === 'content') {
          const rank = Number.parseInt(widened.page.id.replace(/\D/gu, ''), 10);
          const wait = Number.isNaN(rank) ? widened.page.title.length : rank;
          await new Promise((resolve) => setTimeout(resolve, 20 - Math.min(wait, 18)));
        }
        return offline.run(request, options);
      },
    };
  }

  it('returns content in PAGE order even when the pool finishes backwards', async () => {
    const site = await run({ contentConcurrency: 4, provider: finishesBackwards() });
    expect(site.pages.length).toBeGreaterThan(1);
    expect(site.content.map((entry) => entry.pageId)).toEqual(site.pages.map((page) => page.id));
  });

  it('writes content one page at a time when asked to', async () => {
    const site = await run({ contentConcurrency: 1, provider: finishesBackwards() });
    expect(site.content.map((entry) => entry.pageId)).toEqual(site.pages.map((page) => page.id));
  });

  it('refuses a sitemap that exceeds the page limit rather than truncating it', async () => {
    const provider = createScriptedSiteStageProvider({
      stages: {
        sitemap: {
          response: () => ({
            stage: 'sitemap',
            dir: 'ltr',
            pages: Array.from({ length: 9 }, (_unused, index) => ({
              id: `page-${String(index)}`,
              title: `Page ${String(index)}`,
              purpose: 'A page.',
            })),
          }),
        },
      },
    });

    /*
      A site cut down to the limit lies about what was asked for, and a person
      who asked for nine pages and received four cannot tell which five went.
    */
    await expect(run({ provider })).rejects.toThrow(/allows 4/u);
  });

  /* ── Bounds: reported, never truncated (T062, FR-025) ────────────────────── */

  describe('bounds', () => {
    it('refuses a page whose sections exceed the limit, and says by how much', async () => {
      const provider = createScriptedSiteStageProvider({
        stages: {
          structure: {
            response: (request) => ({
              stage: 'structure',
              pages: (request as unknown as { pages: readonly { id: string }[] }).pages.map(
                (page) => ({
                  pageId: page.id,
                  sections: Array.from({ length: 9 }, (_unused, index) => ({
                    id: `section-${String(index)}`,
                    type: 'text',
                    intent: 'Say something.',
                  })),
                }),
              ),
            }),
          },
        },
        fallback: createOfflineSiteStageProvider(),
      });

      /*
        Both numbers, in one sentence. "Too many sections" tells a person they
        have a problem; "9 sections; this run allows 6" tells them what to do
        about it, and is the difference between a bound that is REPORTED and one
        that is merely enforced.
      */
      await expect(run({ provider })).rejects.toThrow(/9 sections; this run allows 6/u);
    });

    it('returns NOTHING when a bound is exceeded — no truncated site comes back', async () => {
      const provider = createScriptedSiteStageProvider({
        stages: {
          sitemap: {
            response: () => ({
              stage: 'sitemap',
              dir: 'ltr',
              pages: Array.from({ length: 9 }, (_unused, index) => ({
                id: `page-${String(index)}`,
                title: `Page ${String(index)}`,
                purpose: 'A page.',
              })),
            }),
          },
        },
        fallback: createOfflineSiteStageProvider(),
      });

      await expect(run({ provider })).rejects.toThrow(StageRejectedError);
      /* Not "four of the nine pages" — the run stopped, and nothing downstream ran. */
      expect(provider.calls()['structure']).toBeUndefined();
    });

    it('carries the token bound on every envelope, which only a server can enforce', async () => {
      const provider = createScriptedSiteStageProvider({
        fallback: createOfflineSiteStageProvider(),
      });
      const spy = vi.spyOn(provider, 'run');
      await run({ provider });

      /*
        `maxTokens` is the one bound this side cannot check: a client does not
        see the model's token count, and a byte length is not one. So it travels
        on every envelope and its enforcement belongs to the server — which is a
        real division of labour, not a gap, and is stated here so nobody looks
        for a check that could not exist.
      */
      for (const call of spy.mock.calls) {
        expect((call[0] as { limits: StageLimits }).limits.maxTokens).toBe(LIMITS.maxTokens);
      }
      expect(spy.mock.calls.length).toBeGreaterThan(0);
    });
  });

  /**
   * A site with the one page every valid site has, in whichever direction the
   * caller asks for. Shared by the door tests and the direction tests, because
   * both need a real site to write into and neither should invent its own idea
   * of what one looks like.
   */
  const seedSite = (dir: BuilderSite['dir'] = 'ltr'): BuilderSite => ({
    siteVersion: 1,
    dir,
    pages: [
      {
        id: 'p-home',
        address: '/',
        title: 'Home',
        purpose: 'The page that was already here.',
        audience: 'anyone',
        document: emptyDocument('site', dir),
        regions: [],
      },
    ],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  });

  const kernelFor = (site: BuilderSite) => {
    const kernel = createSiteBuilder({ site });
    kernel.extensions.register(fixtureBlocks);
    return kernel;
  };

  /* ── The door (T063, SC-002) and one undo (T064, SC-011) ─────────────────── */

  describe('the door is the only writer', () => {
    /*
      The two codec-shaped things the commit takes as PORTS, supplied here in
      their simplest correct form. Neither is under test: the product passes the
      site codec's own `projectSite`/`parseSite`, whose round-trip and diff laws
      run at a thousand cases each in `@craftkit/builder-transforms`. What IS
      under test is the promise on this side — one transaction, one undo, and no
      write at all onto a site that moved.
    */
    const fingerprint = (site: BuilderSite): string => JSON.stringify(site);

    const patchesFor = (draft: BuilderSite, live: BuilderSite) => [
      { op: 'replace' as const, path: ['designSystem'], value: draft.designSystem },
      ...draft.pages
        .filter((page) => !live.pages.some((existing) => existing.id === page.id))
        .map((page, index) => ({
          op: 'add' as const,
          path: ['pages', live.pages.length + index],
          value: page,
        })),
    ];

    it('refuses a provider that answers with a SITE where commands were asked for', async () => {
      const provider = createScriptedSiteStageProvider({
        stages: {
          assembly: {
            response: () => ({
              stage: 'assembly',
              /* The whole finished thing, which is the one answer this stage must never take. */
              site: { siteVersion: 1, dir: 'ltr', pages: [], sharedRegions: {} },
            }),
          },
        },
        fallback: createOfflineSiteStageProvider(),
      });

      await expect(run({ provider })).rejects.toThrow(/not a finished site/u);
    });

    it('names what arrived instead of failing on a property of undefined', async () => {
      const provider = createScriptedSiteStageProvider({
        stages: { assembly: { response: () => ({ stage: 'assembly' }) } },
        fallback: createOfflineSiteStageProvider(),
      });

      /*
        Before the shape guards, this produced "Cannot read properties of
        undefined (reading 'length')" — a message about JavaScript at the moment
        a person needs one about the model, and a TypeError rather than a
        `StageRejectedError`, so it escaped the retry and the `stage.rejected`
        event entirely.
      */
      await expect(run({ provider })).rejects.toThrow(StageRejectedError);
      await expect(run({ provider })).rejects.toThrow(/It sent nothing there at all/u);
    });

    it('produces commands the real site door ACCEPTS, every one of them', async () => {
      const site = await run({ blockTypes: ['section', 'text'] });
      const kernel = kernelFor(seedSite());
      const before = kernel.transactions().length;

      const result = applySiteCommands({ kernel, commands: site.commands });
      if (!result.ok) {
        throw new Error(`the door refused a generated command: ${result.refusal.reason}`);
      }

      /*
        SC-002, measured rather than asserted: the count of writes that reached
        the site without passing the door is zero, because every write here IS a
        door call — one transaction per accepted command, and no other path
        exists into the store.
      */
      expect(result.applied).toHaveLength(site.commands.length);
      expect(kernel.transactions().length - before).toBe(site.commands.length);
      expect(kernel.validate().ok).toBe(true);
      /* And it built what was generated, not a subset of it. */
      expect(kernel.getSite().pages.length).toBe(site.pages.length + 1);
    });

    it('builds a SECOND time into the same site, and says what it renamed', async () => {
      const site = await run({ blockTypes: ['section', 'text'] });
      const kernel = kernelFor(seedSite());

      const first = applySiteCommands({ kernel, commands: site.commands });
      expect(first.ok).toBe(true);
      const second = applySiteCommands({ kernel, commands: site.commands });

      /*
        The addresses a run derives are the only names it has, so a second build
        into the same site collides on every one of them. Losing the whole run
        to a collision nobody could have avoided is the wrong answer; so is
        renaming silently, because a person who asked for /home and got /home-2
        will look for a page that is not there.
      */
      if (!second.ok) throw new Error(`the second build was refused: ${second.refusal.reason}`);
      expect(second.renamed.length).toBeGreaterThan(0);
      for (const rename of second.renamed) {
        expect(rename.used).not.toBe(rename.asked);
        expect(rename.used.startsWith(rename.asked)).toBe(true);
      }
      expect(kernel.validate().ok).toBe(true);
      /* Every address distinct, which is what `validateSite` would refuse. */
      const addresses = kernel.getSite().pages.map((page) => page.address);
      expect(new Set(addresses).size).toBe(addresses.length);
    });

    it('STOPS at the first command the door refuses rather than assembling what fits', async () => {
      const site = await run({ blockTypes: ['section', 'text'] });
      const kernel = kernelFor(seedSite());
      const poisoned = [
        ...site.commands.slice(0, 1),
        /*
          An empty title, not a duplicate address: the applier now makes
          addresses unique on purpose, so a duplicate is no longer a refusal and
          would have made this test pass for the wrong reason.
        */
        { command: 'addPage', args: { address: '/second', title: '' } },
        ...site.commands.slice(1),
      ];

      const result = applySiteCommands({ kernel, commands: poisoned });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.refusal.index).toBe(1);
      /*
        A site assembled from the commands that happened to pass is a site
        nobody designed: what survived was chosen by which commands were
        acceptable, not by anyone's judgement.
      */
      expect(result.applied).toHaveLength(1);
    });

    it('reverses a whole generation in ONE undo (SC-011)', async () => {
      const live = kernelFor(seedSite());
      const baseFingerprint = fingerprint(live.getSite());
      const captured = JSON.stringify(live.getSite());

      /*
        The batch is applied to a DRAFT, whose history is nobody's, because a
        page command names a page `addPage` mints inside the batch and a group
        cannot read an id back halfway through itself. The one-undo promise then
        belongs to the COMMIT, which is a single `applySitePatches`.
      */
      const draft = kernelFor(seedSite());
      const site = await run({ blockTypes: ['section', 'text'] });
      const applied = applySiteCommands({ kernel: draft, commands: site.commands });
      expect(applied.ok).toBe(true);

      const commit = commitGeneratedSite({
        live,
        patches: patchesFor(draft.getSite(), live.getSite()),
        fingerprint,
        baseFingerprint,
        label: 'Built a site',
      });
      expect(commit.ok).toBe(true);
      if (!commit.ok) return;

      expect(live.transactions()).toHaveLength(1);
      expect(commit.transaction.author).toBe('ai');
      expect(live.getSite().pages.length).toBe(site.pages.length + 1);

      expect(live.undo()).toBe(true);
      expect(JSON.stringify(live.getSite())).toBe(captured);
    });

    it('refuses to commit onto a site that moved, and writes nothing (SC-010)', async () => {
      const live = kernelFor(seedSite());
      const baseFingerprint = fingerprint(live.getSite());
      const draft = kernelFor(seedSite());
      const site = await run({ blockTypes: ['section', 'text'] });
      applySiteCommands({ kernel: draft, commands: site.commands });

      live.dispatch('addPage', { address: '/meanwhile', title: 'Meanwhile' }, 'user');
      const captured = JSON.stringify(live.getSite());
      const transactions = live.transactions().length;

      const commit = commitGeneratedSite({
        live,
        patches: patchesFor(draft.getSite(), live.getSite()),
        fingerprint,
        baseFingerprint,
        label: 'Built a site',
      });
      expect(commit).toMatchObject({ ok: false, refusal: 'stale' });
      expect(live.transactions()).toHaveLength(transactions);
      expect(JSON.stringify(live.getSite())).toBe(captured);
    });
  });

  /* ── Direction follows the brief's language (T127, FR-043) ──────────────── */

  describe('reading direction', () => {
    /*
      The direction is decided ONCE, by the caller, and carried on every stage
      envelope. It is not re-detected per stage: a five-stage run that sniffed
      the language independently five times could disagree with itself, and a
      site whose sitemap is right-to-left and whose content is not is a site
      nobody can read.
    */
    it('carries the site direction to every stage, unchanged', async () => {
      const provider = createScriptedSiteStageProvider({
        fallback: createOfflineSiteStageProvider(),
      });
      const spy = vi.spyOn(provider, 'run');

      await run({ provider, dir: 'rtl', brief: 'مشغل خزف في عمّان' });

      expect(spy.mock.calls.length).toBeGreaterThan(4);
      for (const call of spy.mock.calls) {
        expect((call[0] as { dir: string }).dir).toBe('rtl');
      }
    });

    it('builds every page of an Arabic site right-to-left', async () => {
      /*
        The vocabulary the fixture registry actually admits under a page root.
        In the product this list is DERIVED (`sectionTypesFor`) precisely so a
        run is never given a type its own door would refuse; a test that
        hardcodes one has to hardcode the right one.
      */
      const site = await run({
        dir: 'rtl',
        brief: 'مشغل خزف في عمّان',
        blockTypes: ['section', 'text'],
      });
      const kernel = kernelFor(seedSite('rtl'));

      const applied = applySiteCommands({ kernel, commands: site.commands });
      if (!applied.ok) throw new Error(`the door refused: ${applied.refusal.reason}`);

      expect(kernel.getSite().pages.length).toBeGreaterThan(1);
      for (const page of kernel.getSite().pages) {
        /*
          `page-direction-mismatch` is a site validation code precisely because
          a page that disagrees with its site is the failure this prevents. A
          new page is born in the site's direction; this asserts nothing undid
          that.
        */
        expect(page.document.dir).toBe('rtl');
      }
      expect(kernel.validate().ok).toBe(true);
    });

    it('keeps an Arabic brief and its Latin twin structurally identical', async () => {
      const arabic = await run({ dir: 'rtl', brief: 'مشغل خزف في عمّان' });
      const latin = await run({ dir: 'ltr', brief: 'مشغل خزف في عمّان' });

      /*
        Direction is a LAYOUT decision, not a content one. The same brief must
        produce the same pages and the same sections either way — anything else
        would mean the pipeline quietly designs differently for Arabic, which is
        the opposite of respecting it.
      */
      expect(arabic.pages).toEqual(latin.pages);
      expect(arabic.structure).toEqual(latin.structure);
      expect(arabic.content).toEqual(latin.content);
    });
  });
});
