import {
  createOfflineSiteStageProvider,
  createSiteBuilder,
  defaultDesignSystem,
  emptyDocument,
  type BuilderSite,
  defineBlockSchema,
  imagePropSchema,
  type AssetEntry,
  type AssetLibraryPort,
  type BuilderSiteKernel,
  type StageRequest,
  type TrustedExtensionManifest,
} from '@craftkit/builder';
import {
  createScriptedSiteStageProvider,
  fixedClock,
  fixtureBlocks,
  seededIds,
} from '@craftkit/builder/testing';
import { createFixedAssetLibrary } from '@craftkit/builder/testing';

import { createLocalAssetLibrary } from '../../local-asset-library';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

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

/*
  The pictures. Kept apart because they need a registry with a block that
  actually holds an image prop — the shared fixtures have none — and a scripted
  assembly that places one, which the offline provider never does.
*/
describe('runSiteGeneration — pictures (FR-045, FR-051)', () => {
  const KILN: AssetEntry = {
    id: 'kiln',
    url: 'https://assets.example.test/kiln.jpg',
    description: 'A ceramics kiln glowing in a workshop',
    mood: ['warm'],
    palette: ['#c2410c'],
    alt: 'A kiln glowing orange in a dim ceramics workshop',
    width: 1600,
    height: 1067,
  };

  const pictureBlocks: TrustedExtensionManifest = {
    tier: 1,
    name: 'picture-blocks',
    version: '0.0.1',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'Test page root.',
            props: z.object({ title: z.string().default('') }),
            slots: { default: { allow: ['shot'] } },
            examples: [],
          }),
          render: () => null,
        },
        {
          schema: defineBlockSchema({
            type: 'shot',
            description: 'Test block carrying an image prop.',
            props: z.object({ asset: imagePropSchema.optional() }),
            examples: [],
          }),
          render: () => null,
        },
      ],
    },
  };

  const pictureHost = (
    library: AssetLibraryPort | undefined,
    assetId: string,
  ): { host: SiteRunHost; kernel: BuilderSiteKernel } => {
    const make = (site: BuilderSite, seed: string): BuilderSiteKernel =>
      createSiteBuilder({
        site,
        extensions: [pictureBlocks],
        ports: { clock: fixedClock(), ids: seededIds(seed) },
      });
    const kernel = make(oneHomePage(), 'live');
    let drafts = 0;

    return {
      kernel,
      host: {
        kernel,
        createDraft: (site) => {
          drafts += 1;
          return make(site, `draft-${String(drafts)}`);
        },
        ...(library === undefined ? {} : { library }),
        allowedCommands: ['addPage', 'insertNode'],
        provider: createScriptedSiteStageProvider({
          stages: {
            assembly: {
              response: () => ({
                stage: 'assembly',
                commands: [
                  {
                    command: 'insertNode',
                    args: {
                      parentId: 'root',
                      slot: 'default',
                      type: 'shot',
                      props: { asset: { assetId } },
                    },
                  },
                ],
              }),
            },
          },
          fallback: createOfflineSiteStageProvider(),
        }),
      },
    };
  };

  it('lands a chosen picture in the SITE asset table, and the site stays valid', async () => {
    const { host, kernel } = pictureHost(createFixedAssetLibrary({ entries: [KILN] }), 'kiln');

    const outcome = await run(host);

    if (!outcome.ok) throw new Error(`the run was refused: ${outcome.reason}`);
    /*
      The whole chain in one assertion: the catalogue reached the stage, the
      stage's reference survived validation, and the applier copied the entry in
      before the command that used it.
    */
    expect(kernel.getSite().assets['kiln']).toEqual(KILN);
    expect(kernel.validate().ok).toBe(true);
    /* Still ONE transaction — the registration rode in with the rest. */
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('REFUSES a reference to a picture that was never in the library', async () => {
    const { host, kernel } = pictureHost(createFixedAssetLibrary({ entries: [KILN] }), 'ghost');

    const outcome = await run(host);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('expected a refusal');
    expect(outcome.reason).toContain('ghost');
    /* And nothing of the person's site moved. */
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('completes with NO library wired, because a text site is a site (FR-051)', async () => {
    /*
      The scripted assembly still asks for a picture, so this run must be
      refused — but refused by the stage, cleanly, with nothing written. What
      must never happen is a crash or an invented address.
    */
    const { host, kernel } = pictureHost(undefined, 'kiln');

    const outcome = await run(host);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('expected a refusal');
    expect(outcome.reason).toContain('no asset library');
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('survives a library that will not answer', async () => {
    const { host, kernel } = pictureHost(
      createFixedAssetLibrary({ unavailable: 'the store is down' }),
      'kiln',
    );

    const outcome = await run(host);

    /*
      Degraded, not crashed: the catalogue is empty, so the stage's picture is
      refused for the same reason an unwired library gives. The run ends with a
      sentence and an untouched site.
    */
    expect(outcome.ok).toBe(false);
    expect(kernel.transactions()).toHaveLength(0);
  });
});

/*
  The offline path, end to end, with the playground's own library. Kept separate
  from the scripted tests above because nothing here is scripted: the provider
  chooses the pictures itself, through the same `selectFrom` a host would use.
*/
describe('runSiteGeneration — the offline provider places real pictures', () => {
  const pictureBlocks: TrustedExtensionManifest = {
    tier: 1,
    name: 'image-blocks',
    version: '0.0.1',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'Test page root.',
            props: z.object({ title: z.string().default('') }),
            slots: { default: { allow: ['image'] } },
            examples: [],
          }),
          render: () => null,
        },
        {
          schema: defineBlockSchema({
            type: 'image',
            description: 'Test image block.',
            props: z.object({ asset: imagePropSchema.optional() }),
            examples: [],
          }),
          render: () => null,
        },
      ],
    },
  };

  const imageHost = (
    library: AssetLibraryPort | undefined,
  ): { host: SiteRunHost; kernel: BuilderSiteKernel } => {
    const make = (site: BuilderSite, seed: string): BuilderSiteKernel =>
      createSiteBuilder({
        site,
        extensions: [pictureBlocks],
        ports: { clock: fixedClock(), ids: seededIds(seed) },
      });
    const kernel = make(oneHomePage(), 'live');
    let drafts = 0;

    return {
      kernel,
      host: {
        kernel,
        createDraft: (site) => {
          drafts += 1;
          return make(site, `draft-${String(drafts)}`);
        },
        ...(library === undefined ? {} : { library }),
        allowedCommands: ['addPage', 'insertNode', 'setDesignSystem'],
        provider: createOfflineSiteStageProvider(),
      },
    };
  };

  const assetRefs = (kernel: BuilderSiteKernel): readonly string[] =>
    kernel
      .getSite()
      .pages.flatMap((page) => Object.values(page.document.nodes))
      .map((node) => node.props['asset'])
      .filter(
        (value): value is { assetId: string } =>
          typeof value === 'object' && value !== null && 'assetId' in value,
      )
      .map((ref) => ref.assetId);

  it('fills image sections from the library, and registers every one it used', async () => {
    const { host, kernel } = imageHost(createLocalAssetLibrary());

    const outcome = await run(host);

    if (!outcome.ok) throw new Error(`the run was refused: ${outcome.reason}`);
    const refs = assetRefs(kernel);
    expect(refs.length).toBeGreaterThan(0);
    /* Every reference resolves in the site's own table — that IS the invariant. */
    for (const assetId of refs) {
      expect(kernel.getSite().assets[assetId]).toBeDefined();
    }
    expect(kernel.validate().ok).toBe(true);
  });

  it('never uses the same photograph twice across the whole site', async () => {
    /*
      Chosen in one pass over every page, because the no-repeat rule is a
      property of the SITE: the same picture on the home page and the about page
      reads as a mistake, and choosing per page could not see it.
    */
    const { host, kernel } = imageHost(createLocalAssetLibrary());

    await run(host);

    const refs = assetRefs(kernel);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('builds the SAME site twice from the same seed (SC-013)', async () => {
    const first = imageHost(createLocalAssetLibrary());
    const second = imageHost(createLocalAssetLibrary());

    await run(first.host);
    await run(second.host);

    expect(assetRefs(first.kernel)).toEqual(assetRefs(second.kernel));
  });

  it('completes with LABELLED absences when the library is empty (FR-051)', async () => {
    const { host, kernel } = imageHost(createLocalAssetLibrary({ entries: [] }));

    const outcome = await run(host);

    if (!outcome.ok) throw new Error(`the run was refused: ${outcome.reason}`);
    /*
      A site with no pictures is a site. Every position that wanted one carries
      a sentence instead — never a blank box, never an invented address.
    */
    expect(assetRefs(kernel)).toEqual([]);
    const reasons = kernel
      .getSite()
      .pages.flatMap((page) => Object.values(page.document.nodes))
      .map((node) => node.props['asset'])
      .filter(
        (value): value is { absent: true; reason: string } =>
          typeof value === 'object' && value !== null && 'absent' in value,
      );
    expect(reasons.length).toBeGreaterThan(0);
    for (const value of reasons) expect(value.reason).toContain('empty');
    expect(kernel.validate().ok).toBe(true);
  });
});
